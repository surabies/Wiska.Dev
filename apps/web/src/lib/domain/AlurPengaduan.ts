// lib/domain/AlurPengaduan.ts — aturan MURNI alur kerja tiket pengaduan air.
//
// Berisi "boleh/tidak boleh" tanpa akses database, React, atau HTTP, supaya:
//  - satu sumber kebenaran dipakai bersama oleh server (Alur.ts, service)
//    dan UI dashboard (menyembunyikan tombol yang pasti ditolak), dan
//  - setiap aturan bisa dites unit tanpa menyalakan Postgres.
//
// Eksekusi transisi (menulis baris + linimasa dalam transaksi) TETAP di
// server/modules/pengaduan/Alur.ts. File ini hanya memutuskan.
//
// Hanya `import type` dari @db: aman diimpor komponen client karena terhapus
// saat kompilasi dan tidak menyeret Prisma Client ke bundle browser.
import type { PrioritasPengaduan, StatusPengaduan } from "@db"

/// Transisi yang sah. Yang TIDAK terdaftar ditolak — daftar putih, bukan
/// daftar hitam: status baru otomatis tertutup sampai seseorang sadar
/// memikirkan dari mana ia boleh dicapai.
export const TRANSISI: Record<StatusPengaduan, readonly StatusPengaduan[]> = {
  // BARU tidak bisa langsung DIPROSES: penanganan tanpa petugas penanggung
  // jawab membuat tiket "dikerjakan" tapi tidak dimiliki siapa pun, dan
  // STAFF tidak pernah bisa menggerakkannya (aturan kepemilikan). Supervisor
  // yang ingin langsung bergerak cukup menugaskan — satu klik.
  BARU: ["TERVERIFIKASI", "DITUGASKAN", "DITOLAK"],
  TERVERIFIKASI: ["DITUGASKAN", "MENUNGGU_PELANGGAN", "DITOLAK"],
  // DITUGASKAN -> DITUGASKAN sah: penugasan ulang ke petugas lain.
  DITUGASKAN: [
    "DITUGASKAN",
    "MENUJU_LOKASI",
    "DIPROSES",
    "MENUNGGU_PELANGGAN",
    "DITOLAK",
  ],
  // Kembali ke DITUGASKAN sah: petugas batal berangkat / dialihkan.
  MENUJU_LOKASI: ["DIPROSES", "MENUNGGU_PELANGGAN", "DITUGASKAN"],
  DIPROSES: ["DITUGASKAN", "MENUNGGU_PELANGGAN", "SELESAI", "DITOLAK"],
  MENUNGGU_PELANGGAN: ["DIPROSES", "DITUGASKAN", "SELESAI", "DITOLAK"],
  // SELESAI belum final — pelapor mengonfirmasi (DITUTUP) atau membantah
  // (DIBUKA_KEMBALI). Itu inti pembedaan SELESAI/DITUTUP.
  SELESAI: ["DITUTUP", "DIBUKA_KEMBALI"],
  // Penolakan keliru bisa dihidupkan kembali oleh SUPERVISOR ke atas
  // (lihat transisiLewatPetugas) — supaya warga tidak dipaksa membuat tiket
  // baru dan riwayatnya terputus.
  DITOLAK: ["DIBUKA_KEMBALI"],
  DIBUKA_KEMBALI: ["DITUGASKAN", "DIPROSES", "DITOLAK"],
  // Terminal, sengaja buntu. Keluhan lanjutan adalah tiket baru.
  DITUTUP: [],
}

/// Transisi yang boleh dilakukan role STAFF pada tiket yang DITUGASKAN
/// KEPADANYA. Di luar ini STAFF hanya boleh memverifikasi (BARU ->
/// TERVERIFIKASI, peran operator). SUPERVISOR ke atas tidak dibatasi daftar
/// ini (tetap dalam batas TRANSISI).
export const TRANSISI_PETUGAS: readonly StatusPengaduan[] = [
  "MENUJU_LOKASI",
  "DIPROSES",
  "MENUNGGU_PELANGGAN",
  "SELESAI",
]

/// Status yang sudah keluar dari antrean kerja (jam SLA tidak lagi relevan).
export const STATUS_SELESAI: readonly StatusPengaduan[] = [
  "SELESAI",
  "DITUTUP",
  "DITOLAK",
]

/// Status yang masih menjadi pekerjaan rumah petugas. Ditulis LENGKAP —
/// versi lama tersebar di beberapa modul dan lupa TERVERIFIKASI serta
/// MENUJU_LOKASI, sehingga statistik "terbuka"/"melanggar SLA" diam-diam
/// lebih kecil dari kenyataan. Pemeriksaan kelengkapan di bawah membuat
/// typecheck gagal bila enum bertambah tanpa file ini diperbarui.
export const STATUS_TERBUKA: StatusPengaduan[] = [
  "BARU",
  "TERVERIFIKASI",
  "DITUGASKAN",
  "MENUJU_LOKASI",
  "DIPROSES",
  "MENUNGGU_PELANGGAN",
  "DIBUKA_KEMBALI",
]

type StatusTerdaftar =
  (typeof STATUS_TERBUKA)[number] | (typeof STATUS_SELESAI)[number]
// Bila StatusPengaduan mendapat nilai baru yang belum masuk salah satu
// daftar, `Exclude` tidak lagi `never` dan baris ini gagal dikompilasi.
const _statusLengkap: Exclude<StatusPengaduan, StatusTerdaftar> extends never
  ? true
  : false = true
void _statusLengkap

/// Belum punya penanggung jawab — dasar angka "belum ditugaskan".
export const STATUS_BELUM_DITUGASKAN: readonly StatusPengaduan[] = [
  "BARU",
  "TERVERIFIKASI",
]

/// Status yang hanya boleh dicapai bila tiket SUDAH punya petugas. Tiket
/// "sedang ditangani" tanpa nama penanggung jawab tidak bisa dimintai
/// pertanggungjawaban dan tidak muncul di antrean "milik saya" siapa pun.
export const STATUS_BUTUH_PETUGAS: readonly StatusPengaduan[] = [
  "MENUJU_LOKASI",
  "DIPROSES",
  "SELESAI",
]

/// Status yang wajib disertai catatan alasan, karena pelapor membaca
/// transisinya di halaman pelacakan:
///  - DITOLAK: warga berhak tahu kenapa aduannya ditolak;
///  - MENUNGGU_PELANGGAN: warga harus tahu apa yang ditunggu darinya —
///    tanpa itu jam SLA berhenti tanpa ada yang bisa ia lakukan;
///  - DIBUKA_KEMBALI (oleh supervisor): alasan membatalkan penolakan.
export const STATUS_WAJIB_CATATAN: readonly StatusPengaduan[] = [
  "DITOLAK",
  "MENUNGGU_PELANGGAN",
  "DIBUKA_KEMBALI",
]

export function bolehTransisi(
  dari: StatusPengaduan,
  ke: StatusPengaduan
): boolean {
  return TRANSISI[dari].includes(ke)
}

export function statusTerbuka(status: StatusPengaduan): boolean {
  return STATUS_TERBUKA.includes(status)
}

/// Konteks pelaku untuk aturan berbasis peran. `pengelola` = SUPERVISOR ke
/// atas; `milikSendiri` = tiket ditugaskan kepada pelaku ini. Dipetakan dari
/// role oleh server supaya file ini tidak bergantung pada modul RBAC.
export interface KonteksPelaku {
  pengelola: boolean
  milikSendiri: boolean
}

/// Status tujuan yang BENAR-BENAR bisa dieksekusi lewat PATCH /:id/status.
///  - DITUTUP selalu disaring: hak pelapor atau auto-close sistem.
///  - DITUGASKAN disaring: punya endpoint sendiri (/tugaskan) karena wajib
///    membawa petugas; lewat /status tiket akan "ditugaskan ke tidak ada".
///  - DIBUKA_KEMBALI: hanya pengelola, dan hanya dari DITOLAK. Dari SELESAI
///    itu hak pelapor (membantah klaim selesai).
///  - STAFF: verifikasi triase, atau TRANSISI_PETUGAS pada tiket miliknya.
export function transisiLewatPetugas(
  status: StatusPengaduan,
  pelaku: KonteksPelaku
): StatusPengaduan[] {
  return TRANSISI[status].filter((ke) => {
    if (ke === "DITUTUP" || ke === "DITUGASKAN") return false
    if (ke === "DIBUKA_KEMBALI") return pelaku.pengelola && status === "DITOLAK"
    if (pelaku.pengelola) return true
    if (ke === "TERVERIFIKASI") return true
    return pelaku.milikSendiri && TRANSISI_PETUGAS.includes(ke)
  })
}

/// Alasan penolakan sebuah perubahan status oleh petugas, atau null bila
/// sah. Dipakai service sebelum membuka transaksi supaya pesan galatnya
/// menyebut ATURAN BISNIS, bukan sekadar "transisi tidak valid".
export function periksaUbahStatus(opsi: {
  dari: StatusPengaduan
  ke: StatusPengaduan
  pelaku: KonteksPelaku
  punyaPetugas: boolean
  catatan?: string | null
}): string | null {
  const { dari, ke, pelaku, punyaPetugas } = opsi

  if (ke === "DITUTUP") {
    return "Tiket ditutup oleh pelapor lewat halaman pelacakan (atau otomatis oleh sistem), bukan oleh petugas. Tandai SELESAI — pelapor yang mengonfirmasi."
  }
  if (ke === "DITUGASKAN") {
    return "Gunakan aksi Tugaskan (PATCH /pengaduan/:id/tugaskan) supaya tiket selalu membawa nama petugas penanggung jawab."
  }
  if (ke === "DIBUKA_KEMBALI" && dari === "SELESAI") {
    return "Membantah klaim selesai adalah hak pelapor dari halaman pelacakan."
  }
  if (!bolehTransisi(dari, ke)) {
    const tersedia = TRANSISI[dari]
    return (
      `Tiket berstatus ${dari} tidak bisa diubah menjadi ${ke}.` +
      (tersedia.length
        ? ` Transisi yang tersedia: ${tersedia.join(", ")}.`
        : " Status ini sudah final.")
    )
  }
  if (!transisiLewatPetugas(dari, pelaku).includes(ke)) {
    return ke === "DIBUKA_KEMBALI"
      ? "Membuka kembali tiket yang ditolak memerlukan kewenangan Supervisor ke atas."
      : "Sebagai STAFF Anda hanya bisa memverifikasi tiket baru, atau mengubah status tiket yang ditugaskan kepada Anda."
  }
  if (STATUS_BUTUH_PETUGAS.includes(ke) && !punyaPetugas) {
    return "Tiket belum punya petugas penanggung jawab. Tugaskan petugas terlebih dahulu."
  }
  if (STATUS_WAJIB_CATATAN.includes(ke) && !opsi.catatan?.trim()) {
    return `Perubahan ke ${ke} wajib menyertakan catatan alasan yang dapat dibaca pelapor.`
  }
  return null
}

/// Urutan prioritas dari paling santai ke paling mendesak.
export const URUTAN_PRIORITAS: readonly PrioritasPengaduan[] = [
  "RENDAH",
  "NORMAL",
  "TINGGI",
  "DARURAT",
]

export function prioritasLebihTinggi(
  baru: PrioritasPengaduan,
  lama: PrioritasPengaduan
): boolean {
  return URUTAN_PRIORITAS.indexOf(baru) > URUTAN_PRIORITAS.indexOf(lama)
}

/// Aksi selain transisi status yang boleh ditawarkan UI untuk satu tiket.
export interface KewenanganTiket {
  /// Menugaskan / menugaskan ulang petugas.
  bisaTugaskan: boolean
  /// Eskalasi ke atasan (opsional menaikkan prioritas).
  bisaEskalasi: boolean
  /// Percakapan dengan pelapor.
  bisaChat: boolean
}

export function kewenanganTiket(
  status: StatusPengaduan,
  pelaku: KonteksPelaku
): KewenanganTiket {
  return {
    bisaTugaskan: pelaku.pengelola && bolehTransisi(status, "DITUGASKAN"),
    bisaEskalasi: pelaku.pengelola && statusTerbuka(status),
    bisaChat: status !== "DITUTUP",
  }
}
