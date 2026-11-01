import {
  kodeStatusPengaduan,
  NADA_STATUS_PENGADUAN,
  type StatusPengaduan,
  type StatusTagihanTampilan,
} from "@/features/public/lib/Format"

export const LABEL_PRIORITAS_PENGADUAN: Record<string, string> = {
  RENDAH: "Rendah",
  NORMAL: "Normal",
  TINGGI: "Tinggi",
  DARURAT: "Darurat",
}

/// Label status staf memakai sudut pandang orang ketiga. Status warga
/// ditulis kepada pelapor dan tidak tepat ditampilkan apa adanya kepada staf.
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

/// Versi ringkas untuk sel grid; status yang menunggu pelapor tetap menyebutnya.
export const LABEL_STATUS_PENGADUAN_STAF_RINGKAS: Record<
  StatusPengaduan,
  string
> = {
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

/// Label untuk aksi transisi status, bukan label keadaan.
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

export function statusPengaduanStaf(status: string): StatusTagihanTampilan {
  const kode = kodeStatusPengaduan(status)
  return {
    label: LABEL_STATUS_PENGADUAN_STAF[kode],
    ...NADA_STATUS_PENGADUAN[kode],
  }
}
