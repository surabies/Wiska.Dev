export interface BarisPratinjau {
  nomorLangganan: string
  nama: string
  alamat: string
  rt: string | null
  rw: string | null
  kodeRute: string
  ruteDikenal: boolean
  noUrutRute: number | null
  kodeGolongan: string | null
  golonganDikenal: boolean
  nomorMeter: string | null
  mutasian: string | null
  status: "BARU" | "SUDAH_ADA" | "METER_MENYUSUL"
}

export interface Hasil {
  diterapkan: boolean
  periode: number
  ringkas: {
    totalBaris: number
    akanDibuat: number
    sudahAda: number
    tanpaRute: number
    tanpaGolongan: number
    sudahDiDaftarCatat: number
  }
  contoh: {
    nomorLangganan: string
    jenis: "BARU" | "SUDAH_ADA" | "TANPA_RUTE"
    keterangan: string
  }[]
  baris: BarisPratinjau[]
  galat: string[]
  ditulis: {
    pelangganDibuat: number
    meterDibuat: number
    daftarCatatDibuat: number
  }
}
