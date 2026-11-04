// Mirror union types from the Prisma schema so pure seed-domain helpers do
// not need to import the generated database client at runtime.
//
// PENTING: kalau enum PrioritasPengaduan / StatusPengaduan di
// prisma/schema/operasional.prisma berubah (tambah/hapus nilai), update juga union
// di sini secara manual. Tidak ada mekanisme sync otomatis.

/// Cermin dari enum PrioritasPengaduan (prisma/schema/operasional.prisma)
export type PrioritasPengaduan = "RENDAH" | "NORMAL" | "TINGGI" | "DARURAT"

/// Cermin dari enum StatusPengaduan (prisma/schema/operasional.prisma).
/// Lihat komentar di schema asli untuk penjelasan SELESAI vs DITUTUP,
/// dan alasan DIBUKA_KEMBALI.
export type StatusPengaduan =
  | "BARU"
  | "DITUGASKAN"
  | "DIPROSES"
  | "SELESAI"
  | "DITOLAK"
  | "MENUNGGU_PELANGGAN"
  | "DITUTUP"
  | "DIBUKA_KEMBALI"
  | "TERVERIFIKASI"
  | "MENUJU_LOKASI"
