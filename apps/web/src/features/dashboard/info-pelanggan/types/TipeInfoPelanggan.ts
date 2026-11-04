// Model tampilan stabil untuk Info Pelanggan. Bentuk respons endpoint
// dinormalisasi pada adapter API sebelum dipakai komponen.

export type StatusInfo = "idle" | "memuat" | "galat" | "siap"

export type DataPelanggan = {
  nomorLangganan: string
  nama: string
  alamat: string | null
  /** Golongan tarif, mis. "2A3" (kolom "Trf" di aplikasi lama). */
  golongan: string | null
  /** Nomor water meter ("WM"). */
  nomorMeter: string | null
  ukuranMeter: string | null
  noHp: string | null
  /** Kode status: AKTIF, TUTUP_SEMENTARA, DISEGEL, TUTUP_SPT. */
  status: string | null
}

export type DataCatat = {
  /** Format YYYYMM, mis. "202609". */
  periode: string
  standLalu: number | null
  standAkhir: number | null
  pemakaianM3: number | null
  biaya: number | null
  /** Kode kondisi catat; dilabeli lewat LABEL_KONDISI_CATAT. */
  kondisi: string | null
  petugas: string | null
  kodeRute: string | null
  /** ISO 8601. */
  waktuCatat: string | null
  waktuUpload: string | null
}

export type BarisRiwayat = {
  periode: string
  standLalu: number | null
  standAkhir: number | null
  pemakaianM3: number | null
  tagihan: number | null
}

export type DataFoto = {
  segel: string | null
  stand: string | null
  rumah: string | null
}

export type InfoPelanggan = {
  pelanggan: DataPelanggan
  catat: DataCatat | null
  /** Tiga periode sebelum periode yang dicari. */
  riwayat: BarisRiwayat[]
  lokasi: { lat: number; lng: number } | null
  foto: DataFoto
}
