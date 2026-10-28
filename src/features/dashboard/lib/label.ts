// features/dashboard/lib/label.ts — label Indonesia untuk nilai enum yang
// tampil di grid dashboard. Satu tempat supaya ejaan konsisten antar halaman;
// nilai yang tak terdaftar jatuh kembali ke raw value (lebih baik kelihatan
// mentah daripada salah terjemah).
import {
  kodeStatusPengaduan,
  NADA_STATUS_PENGADUAN,
  type StatusPengaduan,
  type StatusTagihanTampilan,
} from "@/features/public/lib/format"

export const LABEL_STATUS_PELANGGAN: Record<string, string> = {
  AKTIF: "Aktif",
  TUTUP_SEMENTARA: "Tutup sementara",
  DISEGEL: "Disegel",
  TUTUP_SPT: "Tutup SPT",
}

export const LABEL_STATUS_LAPORAN_MANDIRI: Record<string, string> = {
  MENUNGGU: "Menunggu",
  DIVERIFIKASI: "Diverifikasi",
  DITOLAK: "Ditolak",
  // "Digunakan" tidak pernah terbaca sebagai apa pun oleh petugas: yang
  // sebenarnya terjadi pada status ini adalah laporannya sudah disetujui DAN
  // sudah menjelma jadi pembacaan resmi.
  DIGUNAKAN: "Jadi pembacaan resmi",
}

/// Pilihan dropdown status laporan mandiri — SENGAJA BUKAN turunan langsung
/// dari LABEL_STATUS_LAPORAN_MANDIRI.
///
/// Enum-nya punya empat nilai, tapi verify melompat dari MENUNGGU langsung ke
/// DIGUNAKAN (pembacaan resmi dibuat di transaksi yang sama), jadi
/// DIVERIFIKASI tidak pernah tertulis di tabel. Menawarkannya sebagai pilihan
/// terpisah berarti menawarkan tombol yang selalu memberi nol baris. Di sini
/// "Sudah diverifikasi" mewakili keduanya — server memperlakukan DIVERIFIKASI
/// sebagai "DIVERIFIKASI atau DIGUNAKAN" (lihat whereStatus() di
/// server/modules/laporan/laporan-mandiri.router.ts).
export const OPSI_STATUS_LAPORAN_MANDIRI = [
  { value: "MENUNGGU", label: "Menunggu" },
  { value: "DIVERIFIKASI", label: "Sudah diverifikasi" },
  { value: "DITOLAK", label: "Ditolak" },
]

export const LABEL_JENIS_MUTASI: Record<string, string> = {
  PB: "Pasang baru",
  PK: "Perubahan kontrak",
}

export const LABEL_JENIS_PEMUTUSAN: Record<string, string> = {
  TSM: "Tutup sementara",
  SPT: "Tutup SPT",
  LAINNYA: "Lainnya",
}

export const LABEL_STATUS_POTENSI: Record<string, string> = {
  PROSPEK: "Prospek",
  DITOLAK: "Ditolak",
  MENUNGGU_SURVEI: "Menunggu survei",
  VALIDASI: "Validasi",
}

export const LABEL_STATUS_PEMBAYARAN: Record<string, string> = {
  PENDING: "Pending",
  BERHASIL: "Berhasil",
  GAGAL: "Gagal",
  EXPIRED: "Kedaluwarsa",
}

export const LABEL_KANAL_PEMBAYARAN: Record<string, string> = {
  TELLER_KANTOR: "Teller kantor",
  PPOB_BANK: "PPOB bank",
  PPOB_MINIMARKET: "PPOB minimarket",
  VIRTUAL_ACCOUNT: "Virtual account",
  QRIS: "QRIS",
  AUTODEBET: "Autodebet",
}

export const LABEL_JENIS_TAGIHAN_LAIN: Record<string, string> = {
  PASANG_BARU: "Pasang baru",
  BALIK_NAMA: "Balik nama",
  GANTI_METER: "Ganti meter",
  BUKA_SEGEL: "Buka segel",
  DENDA_PELANGGARAN: "Denda pelanggaran",
  LAINNYA: "Lainnya",
}

export const LABEL_PRIORITAS_PENGADUAN: Record<string, string> = {
  RENDAH: "Rendah",
  NORMAL: "Normal",
  TINGGI: "Tinggi",
  DARURAT: "Darurat",
}

/// Label status pengaduan versi PETUGAS — sengaja BUKAN peta yang dipakai
/// halaman publik (LABEL_STATUS_PENGADUAN_WARGA di features/public/lib/format.ts).
///
/// Peta warga ditulis sebagai kalimat KEPADA pelapor: "Selesai — menunggu
/// konfirmasi Anda". Dipakai apa adanya di dashboard, "Anda" jadi menunjuk
/// operator yang sedang membaca layar, seolah dialah yang harus
/// mengonfirmasi. Yang benar sebaliknya: petugas menandai SELESAI, lalu
/// PELAPOR yang menutup tiketnya — backend menolak eksplisit petugas
/// menutup sendiri (server/modules/pengaduan/pengaduan.router.ts), dan bila
/// pelapor diam sampai batas waktu, sistemlah yang menutup otomatis
/// (server/modules/pengaduan/otomatis.ts).
///
/// Karena itu seluruh peta ini memakai orang ketiga dan tidak pernah menulis
/// "Anda": siapa yang ditunggu harus terbaca dari labelnya sendiri.
export const LABEL_STATUS_PENGADUAN_STAF: Record<StatusPengaduan, string> = {
  BARU: "Baru — perlu verifikasi",
  TERVERIFIKASI: "Terverifikasi — belum ditugaskan",
  DITUGASKAN: "Ditugaskan ke petugas",
  MENUJU_LOKASI: "Petugas menuju lokasi",
  DIPROSES: "Sedang ditangani",
  MENUNGGU_PELANGGAN: "Menunggu tanggapan pelapor",
  SELESAI: "Selesai — menunggu konfirmasi pelapor",
  DITUTUP: "Ditutup",
  DIBUKA_KEMBALI: "Dibuka kembali pelapor",
  DITOLAK: "Ditolak",
}

/// Versi RINGKAS untuk sel grid, di mana lebar kolom cuma ~160px dan kalimat
/// panjang terpotong jadi tak terbaca sama sekali. Tetap menyebut "pelapor"
/// di dua status yang memang soal siapa yang ditunggu — bagian itulah yang
/// tidak boleh hilang saat diringkas.
export const LABEL_STATUS_PENGADUAN_STAF_RINGKAS: Record<StatusPengaduan, string> = {
  BARU: "Baru",
  TERVERIFIKASI: "Terverifikasi",
  DITUGASKAN: "Ditugaskan",
  MENUJU_LOKASI: "Menuju lokasi",
  DIPROSES: "Ditangani",
  MENUNGGU_PELANGGAN: "Tunggu pelapor",
  SELESAI: "Tunggu konfirmasi",
  DITUTUP: "Ditutup",
  DIBUKA_KEMBALI: "Dibuka kembali",
  DITOLAK: "Ditolak",
}

/// Label TOMBOL transisi status di halaman detail tiket. Peta ketiga karena
/// tombol menyatakan PERBUATAN, bukan keadaan: tombol berbunyi "Menunggu
/// tanggapan pelapor" membaca seperti keterangan status, bukan seperti
/// sesuatu yang terjadi kalau ditekan.
///
/// Lengkap terhadap enum meski sebagian status tak pernah muncul sebagai
/// tombol generik (lihat BUKAN_TOMBOL_STATUS di detail-tiket.tsx) — union
/// yang lengkap lebih murah dijaga daripada peta yang bolong diam-diam.
export const LABEL_AKSI_STATUS_PENGADUAN: Record<StatusPengaduan, string> = {
  BARU: "Kembalikan ke baru",
  TERVERIFIKASI: "Verifikasi",
  DITUGASKAN: "Tugaskan",
  MENUJU_LOKASI: "Tandai menuju lokasi",
  DIPROSES: "Mulai tangani",
  MENUNGGU_PELANGGAN: "Tunggu tanggapan pelapor",
  SELESAI: "Selesaikan",
  DITUTUP: "Tutup tiket",
  DIBUKA_KEMBALI: "Buka kembali",
  DITOLAK: "Tolak",
}

/// Label staf + nada warna — padanan statusPengaduanWarga() untuk sisi
/// dashboard. Warnanya sengaja dipinjam dari peta yang sama supaya badge
/// hijau di layar petugas dan di layar warga berarti hal yang sama.
export function statusPengaduanStaf(status: string): StatusTagihanTampilan {
  const kode = kodeStatusPengaduan(status)
  return { label: LABEL_STATUS_PENGADUAN_STAF[kode], ...NADA_STATUS_PENGADUAN[kode] }
}

export const LABEL_ROLE: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  DIREKSI: "Direksi",
  SENIOR_MANAGER: "Senior manager",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  STAFF: "Staf",
  PELAKSANA: "Pelaksana",
  USER: "Pelanggan",
}

export const LABEL_STATUS_USER: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Non-aktif",
  SUSPENDED: "Ditangguhkan",
}

/// KondisiCatat — LENGKAP, seluruh 21 nilai enum (prisma/tagihan.prisma).
/// Sebagian adalah singkatan warisan sistem lama (BMK/BMB, TTB, MTA, DK, MB)
/// yang kepanjangannya tidak terdokumentasi di data sumber — ditampilkan
/// sebagai singkatannya sendiri, TIDAK dikarang kepanjangannya.
export const LABEL_KONDISI_CATAT: Record<string, string> = {
  NORMAL: "Normal",
  TIDAK_DIPAKAI: "Tidak dipakai",
  RUMAH_KOSONG: "Rumah kosong",
  STAND_TEMPEL: "Stand tempel",
  STAND_KONSUMEN: "Stand konsumen",
  METER_RUSAK: "Meter rusak",
  METER_MATI_ADA_AIR: "Meter mati, ada air",
  METER_MUNDUR: "Meter mundur",
  METER_TERBALIK: "Meter terbalik",
  METER_DALAM_AIR: "Meter dalam air",
  LOS_METER: "Los meter",
  BMK_BMB: "BMK/BMB",
  TTB: "TTB",
  MTA: "MTA",
  TERHALANG: "Terhalang",
  TIDAK_ADA_AIR: "Tidak ada air",
  ADA_ANJING: "Ada anjing",
  DK: "DK",
  MB: "MB",
  MUDA_KEMBALI: "Muda kembali",
  REV_PENCATAT: "Revisi pencatat",
  DICABUT: "Dicabut",
}

export function label(peta: Record<string, string>, nilai: string | null | undefined): string {
  if (!nilai) return "—"
  return peta[nilai] ?? nilai
}
