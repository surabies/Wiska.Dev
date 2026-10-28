// Shared service-level rules for complaint handling.
//
// SLA di sini punya DUA tenggat yang berbeda maksud, dan membedakannya
// penting: `respons` = berapa lama sampai aduan DISENTUH manusia (bukan
// mengendap di antrean), `selesai` = berapa lama sampai masalahnya BERES.
// Tiket yang cepat ditugaskan tapi berbulan-bulan tidak rampung tetap
// gagal, dan sebaliknya — satu angka saja tidak bisa menangkap keduanya.
//
// KENAPA MATRIKSNYA DI KODE, BUKAN DI TABEL `Konfigurasi`?
// Ini janji layanan, bukan tombol operasional. Mengubahnya mengubah arti
// "terlambat" untuk seluruh laporan kinerja, jadi perubahannya layak lewat
// review kode + riwayat git yang menjelaskan alasannya — bukan lewat
// seseorang mengetik angka di form admin tanpa jejak. Kalau kelak memang
// harus bisa diubah per-wilayah lewat UI, pindahkan ke tabel TERSENDIRI
// yang berversi, jangan ke key-value.
//
// TARGET DIHITUNG SEKALI SAAT TIKET DIBUAT lalu DISIMPAN di baris
// Pengaduan — tidak dihitung ulang saat dibaca. Sebabnya: kalau matriks di
// bawah berubah, tiket lama harus tetap dinilai memakai janji yang berlaku
// saat ia dibuat. Menghitung ulang saat baca akan diam-diam menulis ulang
// sejarah: tiket yang dulu "tepat waktu" bisa berubah jadi "terlambat"
// hanya karena angka di file ini diedit.
import type { PrioritasPengaduan, StatusPengaduan } from "@db"

export interface TargetSla {
  /// Jam sampai respons pertama (tiket ditugaskan / mulai ditangani).
  responsJam: number
  /// Jam sampai tiket dinyatakan selesai.
  selesaiJam: number
}

/// Dikunci ke PRIORITAS, bukan ke jenis aduan. Jenis hanya menentukan
/// prioritas AWAL (lihat `prioritasAwal()`); setelah itu supervisor boleh
/// menaikkan/menurunkan prioritas berdasar keadaan lapangan — dan SLA harus
/// ikut penilaian manusia itu, bukan terkunci pada label jenis yang dipilih
/// warga saat mengisi form.
export const MATRIKS_SLA: Record<PrioritasPengaduan, TargetSla> = {
  // Air mati total / semburan pipa besar: regu harus bergerak hari itu juga.
  DARURAT: { responsJam: 1, selesaiJam: 8 },
  TINGGI: { responsJam: 4, selesaiJam: 24 },
  NORMAL: { responsJam: 24, selesaiJam: 72 },
  RENDAH: { responsJam: 48, selesaiJam: 168 },
}

/// Prioritas awal dari jenis aduan yang dipilih pelapor.
///
/// BOCOR_PIPA_DINAS langsung TINGGI: air yang terbuang adalah kerugian yang
/// terus berjalan setiap jam (dan bisa merusak jalan), jadi ia tidak boleh
/// mengantre di belakang keluhan administratif. Aturan ini sudah berlaku di
/// versi pertama endpoint publik — dipindahkan ke sini supaya satu tempat
/// saja yang memutuskannya.
export function prioritasAwal(jenis: string): PrioritasPengaduan {
  switch (jenis) {
    case "BOCOR_PIPA_DINAS":
    case "TIDAK_ADA_AIR":
      return "TINGGI"
    default:
      // Sisanya — termasuk air keruh/bau dan seluruh keluhan seputar nilai
      // rekening — masuk antrean normal. Penilaian manusia saat verifikasi
      // tetap boleh menaikkannya (lihat catatan MATRIKS_SLA di atas).
      return "NORMAL"
  }
}

const JAM_MS = 60 * 60 * 1000

export function hitungTargetSla(
  prioritas: PrioritasPengaduan,
  mulai: Date = new Date(),
) {
  const target = MATRIKS_SLA[prioritas]
  return {
    targetResponsAt: new Date(mulai.getTime() + target.responsJam * JAM_MS),
    targetSelesaiAt: new Date(mulai.getTime() + target.selesaiJam * JAM_MS),
  }
}

/// Status yang TIDAK lagi menghitung waktu — tiket sudah keluar dari
/// antrean kerja. Dipakai untuk memutuskan apakah tenggat masih relevan
/// ditampilkan/dinilai.
const STATUS_SELESAI: readonly StatusPengaduan[] = [
  "SELESAI",
  "DITUTUP",
  "DITOLAK",
]

export function sudahTutup(status: StatusPengaduan): boolean {
  return STATUS_SELESAI.includes(status)
}

export interface RingkasanSla {
  targetResponsAt: Date | null
  targetSelesaiAt: Date | null
  /// Sisa waktu sampai tenggat penyelesaian. Negatif = sudah lewat.
  sisaMenit: number | null
  /// Tenggat penyelesaian terlampaui dan tiket BELUM tutup.
  melanggar: boolean
  /// Respons pertama datang setelah tenggat respons.
  responsTerlambat: boolean
  /// Jam SLA sedang berhenti (menunggu pelapor).
  terjeda: boolean
}

interface SumberSla {
  status: StatusPengaduan
  targetResponsAt: Date | null
  targetSelesaiAt: Date | null
  responsAt: Date | null
  jedaMulaiAt: Date | null
  selesaiAt: Date | null
}

/// Menerjemahkan kolom-kolom mentah jadi ringkasan siap tampil.
///
/// Sengaja fungsi murni (tanpa akses DB) supaya bisa dipakai di list, detail,
/// maupun kelak di pekerjaan latar eskalasi tanpa query tambahan.
export function ringkasSla(
  p: SumberSla,
  sekarang: Date = new Date(),
): RingkasanSla {
  const tutup = sudahTutup(p.status)
  const terjeda = p.status === "MENUNGGU_PELANGGAN" && !!p.jedaMulaiAt

  // Saat terjeda, jam berhenti: sisa waktu dibekukan pada nilainya ketika
  // jeda dimulai, bukan terus menyusut. Tanpa ini, tiket yang menunggu
  // jawaban warga akan tercatat melanggar SLA padahal bolanya bukan di kita.
  const acuan = terjeda && p.jedaMulaiAt ? p.jedaMulaiAt : sekarang

  const sisaMenit = p.targetSelesaiAt
    ? Math.round(
        (p.targetSelesaiAt.getTime() -
          (tutup && p.selesaiAt ? p.selesaiAt.getTime() : acuan.getTime())) /
          60000,
      )
    : null

  return {
    targetResponsAt: p.targetResponsAt,
    targetSelesaiAt: p.targetSelesaiAt,
    sisaMenit,
    melanggar: !tutup && sisaMenit !== null && sisaMenit < 0,
    responsTerlambat:
      !!p.targetResponsAt && !!p.responsAt && p.responsAt > p.targetResponsAt,
    terjeda,
  }
}
