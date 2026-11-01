export const LABEL_STATUS_LAPORAN_MANDIRI: Record<string, string> = {
  MENUNGGU: "Menunggu",
  DIVERIFIKASI: "Terverifikasi (belum resmi)",
  DITOLAK: "Ditolak",
  DIGUNAKAN: "Pembacaan resmi",
}

/// Pilihan dropdown status laporan mandiri — SENGAJA BUKAN turunan langsung
/// dari LABEL_STATUS_LAPORAN_MANDIRI.
///
/// "Terverifikasi" juga memuat status DIGUNAKAN lama agar data sebelum
/// pemisahan alur tetap dapat dicari.
export const OPSI_STATUS_LAPORAN_MANDIRI = [
  { value: "MENUNGGU", label: "Menunggu" },
  { value: "DIVERIFIKASI", label: "Terverifikasi" },
  { value: "DITOLAK", label: "Ditolak" },
]
