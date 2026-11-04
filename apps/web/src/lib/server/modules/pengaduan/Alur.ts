// server/modules/pengaduan/Alur.ts — mesin alur kerja tiket pengaduan.
//
// SATU-SATUNYA jalan yang boleh mengubah `Pengaduan.status`. Router TIDAK
// boleh memanggil `prisma.pengaduan.update({ data: { status } })` langsung.
// Dua alasan, keduanya sudah terbukti jadi masalah di versi pertama modul
// ini:
//
//  1. JEJAK. Versi lama hanya menimpa kolom status, sehingga "siapa mengubah
//     apa, kapan, kenapa" hilang total — pelapor melihat status berubah
//     tanpa penjelasan, dan supervisor tidak bisa menelusuri penanganan yang
//     buruk. Di sini setiap transisi WAJIB menulis RiwayatPengaduan dalam
//     transaksi yang sama, jadi baris tiket tanpa jejak menjadi mustahil.
//
//  2. EFEK SAMPING YANG BERPASANGAN. Sebuah transisi bukan cuma ganti label:
//     ia menyentuh responsAt, ditanganiMulai, selesaiAt, dan jam jeda SLA.
//     Kalau setiap router menghitungnya sendiri, cepat atau lambat ada satu
//     jalur yang lupa — dan data SLA jadi diam-diam salah, bukan gagal
//     terang-terangan.
import type { Prisma, StatusPengaduan, AksiPengaduan } from "@db"
import { BadRequestError, NotFoundError } from "../../lib/Galat"
import { hitungTargetSla } from "@/lib/domain/SLA"
import {
  TRANSISI,
  TRANSISI_PETUGAS,
  bolehTransisi,
  STATUS_BUTUH_PETUGAS,
} from "@/lib/domain/AlurPengaduan"

export { TRANSISI, TRANSISI_PETUGAS, bolehTransisi }

/// Siapa yang melakukan aksi. `id` null = pelapor lewat halaman publik (tidak
/// punya akun) atau sistem — `nama` tetap wajib supaya linimasa selalu bisa
/// dibaca (lihat catatan `olehNama` di prisma/operasional.prisma).
export interface Pelaku {
  id: string | null
  nama: string
}

export const PELAPOR: Pelaku = { id: null, nama: "Pelapor" }
export const SISTEM: Pelaku = { id: null, nama: "Sistem" }

export interface OpsiTransisi {
  pengaduanId: string
  ke: StatusPengaduan
  oleh: Pelaku
  aksi?: AksiPengaduan
  catatan?: string | null
  /// Ikut tampil di halaman pelacakan warga. Default false — catatan
  /// koordinasi internal tidak boleh bocor karena seseorang lupa menyetel
  /// flag; yang publik harus dinyatakan sadar.
  isPublik?: boolean
  fotoUrl?: string | null
  fotoPublicId?: string | null
  /// Diisi saat aksi penugasan.
  ditugaskanKeId?: string | null
  /// Ditulis ke Pengaduan.catatanPenyelesaian saat menutup/menyelesaikan.
  catatanPenyelesaian?: string | null
  /// Foto bukti hasil pekerjaan — ditulis ke Pengaduan.fotoPenyelesaian*
  /// saat transisi SELESAI (kewajibannya ditegakkan router, bukan di sini).
  fotoPenyelesaianUrl?: string | null
  fotoPenyelesaianPublicId?: string | null
  /// Batas konfirmasi pelapor — dihitung ROUTER dari konfigurasi
  /// `pengaduan.batasKonfirmasiJam` dan diisi saat transisi SELESAI. Alur
  /// tidak membaca Konfigurasi sendiri supaya tetap murni mesin transisi.
  konfirmasiBatasAt?: Date | null
}

const MENIT_MS = 60 * 1000

/// Menjalankan satu transisi + efek sampingnya + entri linimasa, ATOMIK.
///
/// WAJIB dipanggil di dalam `prisma.$transaction` — baris tiket dan barisnya
/// di linimasa harus jadi/gagal bersama. Kalau tidak, kegagalan di tengah
/// menyisakan tiket yang statusnya berubah tanpa jejak siapa pun.
export async function transisiPengaduan(
  tx: Prisma.TransactionClient,
  opsi: OpsiTransisi
) {
  const kini = await tx.pengaduan.findUnique({
    where: { id: opsi.pengaduanId },
    select: {
      id: true,
      status: true,
      prioritas: true,
      responsAt: true,
      ditanganiMulai: true,
      jedaMulaiAt: true,
      jedaTotalMenit: true,
      targetSelesaiAt: true,
      jumlahDibukaKembali: true,
      ditugaskanKeId: true,
    },
  })
  if (!kini) throw new NotFoundError("Pengaduan")

  const dari = kini.status
  const ke = opsi.ke

  if (!bolehTransisi(dari, ke)) {
    throw new BadRequestError(
      `Tiket berstatus ${dari} tidak bisa diubah menjadi ${ke}.` +
        (TRANSISI[dari].length
          ? ` Transisi yang tersedia: ${TRANSISI[dari].join(", ")}.`
          : " Status ini sudah final.")
    )
  }

  // Status operasional lapangan wajib memiliki petugas penanggung jawab
  if (
    STATUS_BUTUH_PETUGAS.includes(ke) &&
    !kini.ditugaskanKeId &&
    !opsi.ditugaskanKeId
  ) {
    throw new BadRequestError(
      `Tiket belum ditugaskan ke petugas lapangan. Status ${ke} membutuhkan petugas penanggung jawab.`
    )
  }

  const sekarang = new Date()
  const data: Prisma.PengaduanUpdateInput = { status: ke }

  // ── Respons pertama ────────────────────────────────────────────────
  // Diisi SEKALI dan tidak pernah ditimpa: penugasan ulang ke petugas lain
  // bukan "respons baru", dan me-reset jamnya akan membuat tiket yang
  // dioper-oper terlihat selalu responsif.
  if (
    !kini.responsAt &&
    (ke === "DITUGASKAN" || ke === "MENUJU_LOKASI" || ke === "DIPROSES")
  ) {
    data.responsAt = sekarang
  }

  if (ke === "TERVERIFIKASI") data.verifikasiAt = sekarang

  // Berangkat ke lokasi SUDAH dihitung mulai menangani — jam penanganan
  // tidak boleh menunggu petugas tiba dulu.
  if ((ke === "DIPROSES" || ke === "MENUJU_LOKASI") && !kini.ditanganiMulai) {
    data.ditanganiMulai = sekarang
  }

  // ── Jam jeda SLA ───────────────────────────────────────────────────
  if (ke === "MENUNGGU_PELANGGAN") {
    data.jedaMulaiAt = sekarang
  } else if (dari === "MENUNGGU_PELANGGAN" && kini.jedaMulaiAt) {
    // Keluar dari jeda: tenggat digeser maju sebesar lama menunggu, supaya
    // waktu yang dihabiskan menunggu jawaban warga tidak dihitung sebagai
    // keterlambatan kita.
    const jedaMenit = Math.max(
      0,
      Math.round((sekarang.getTime() - kini.jedaMulaiAt.getTime()) / MENIT_MS)
    )
    data.jedaMulaiAt = null
    data.jedaTotalMenit = kini.jedaTotalMenit + jedaMenit
    if (kini.targetSelesaiAt) {
      data.targetSelesaiAt = new Date(
        kini.targetSelesaiAt.getTime() + jedaMenit * MENIT_MS
      )
    }
  }

  if (ke === "SELESAI") {
    data.selesaiAt = sekarang
    if (opsi.konfirmasiBatasAt !== undefined)
      data.konfirmasiBatasAt = opsi.konfirmasiBatasAt
    if (opsi.fotoPenyelesaianUrl !== undefined)
      data.fotoPenyelesaianUrl = opsi.fotoPenyelesaianUrl
    if (opsi.fotoPenyelesaianPublicId !== undefined) {
      data.fotoPenyelesaianPublicId = opsi.fotoPenyelesaianPublicId
    }
  }

  // ── Pembukaan kembali ──────────────────────────────────────────────
  if (ke === "DIBUKA_KEMBALI") {
    data.jumlahDibukaKembali = kini.jumlahDibukaKembali + 1
    // Tenggat baru dihitung dari SEKARANG. Mempertahankan tenggat lama akan
    // membuat tiket lahir langsung dalam keadaan melanggar SLA — angka yang
    // tidak berarti apa-apa dan hanya membuat papan pemantauan berisik.
    data.selesaiAt = null
    // Hitungan mundur auto-close ikut batal — tiket hidup lagi.
    data.konfirmasiBatasAt = null
    data.targetSelesaiAt = hitungTargetSla(
      kini.prioritas,
      sekarang
    ).targetSelesaiAt
  }

  if (opsi.ditugaskanKeId !== undefined) {
    data.ditugaskanKe = opsi.ditugaskanKeId
      ? { connect: { id: opsi.ditugaskanKeId } }
      : { disconnect: true }
  }
  if (
    opsi.catatanPenyelesaian !== undefined &&
    opsi.catatanPenyelesaian !== null
  ) {
    data.catatanPenyelesaian = opsi.catatanPenyelesaian
  }

  const baris = await tx.pengaduan.update({
    where: { id: opsi.pengaduanId },
    data,
  })

  await tx.riwayatPengaduan.create({
    data: {
      pengaduanId: opsi.pengaduanId,
      aksi: opsi.aksi ?? "STATUS_DIUBAH",
      statusDari: dari,
      statusKe: ke,
      catatan: opsi.catatan ?? null,
      fotoUrl: opsi.fotoUrl ?? null,
      fotoPublicId: opsi.fotoPublicId ?? null,
      isPublik: opsi.isPublik ?? false,
      olehId: opsi.oleh.id,
      olehNama: opsi.oleh.nama,
    },
  })

  return baris
}

/// Menambah entri linimasa TANPA mengubah status — catatan tindak lanjut,
/// eskalasi, penilaian. Dipisah dari transisiPengaduan() supaya tidak ada
/// yang tergoda membuat status palsu hanya demi bisa mencatat sesuatu.
export async function catatRiwayat(
  tx: Prisma.TransactionClient,
  opsi: {
    pengaduanId: string
    aksi: AksiPengaduan
    oleh: Pelaku
    catatan?: string | null
    isPublik?: boolean
    fotoUrl?: string | null
    fotoPublicId?: string | null
  }
) {
  return tx.riwayatPengaduan.create({
    data: {
      pengaduanId: opsi.pengaduanId,
      aksi: opsi.aksi,
      catatan: opsi.catatan ?? null,
      fotoUrl: opsi.fotoUrl ?? null,
      fotoPublicId: opsi.fotoPublicId ?? null,
      isPublik: opsi.isPublik ?? false,
      olehId: opsi.oleh.id,
      olehNama: opsi.oleh.nama,
    },
  })
}
