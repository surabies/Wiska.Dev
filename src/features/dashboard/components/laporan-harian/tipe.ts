export type Status = "selesai" | "jalan" | "diam" | "belum"
export type JenisHari = "kerja" | "akhirpekan" | "libur" | "lembur"

export interface BarisPencatat {
  id: string
  nama: string
  target: number
  tersetor: number
  terakhirSetor: string | null
  hariDiam: number | null
  status: Status
  perTanggal: Record<string, number>
}

export interface Progres {
  periode: number
  tanggalAcuan: string | null
  ambangDiamHari: number
  hari: { tanggal: string; jenis: JenisHari }[]
  tanggal: string[]
  totalPerTanggal: { tanggal: string; jumlah: number }[]
  pencatat: BarisPencatat[]
}

export interface Ringkasan {
  setorAcuan: number
  orangAcuan: number
  target: number
  tersetor: number
  belumJalan: number
}

export interface TitikGrafik {
  tanggal: string
  jumlah: number
  jenis: JenisHari
}
