export type TabDrd =
  | "ringkasan"
  | "kelurahan"
  | "domestik"
  | "tarif"
  | "taa-kelurahan"
  | "cakupan"
  | "taa"
  | "tagihan"
  | "pelanggan"

export type TabDataDrd = Exclude<TabDrd, "ringkasan">

export const DAFTAR_TARIF_DRD = [
  { kode: "GOL_1A", label: "1A" },
  { kode: "GOL_1B", label: "1B" },
  { kode: "GOL_2A1", label: "2A1" },
  { kode: "GOL_2A2", label: "2A2" },
  { kode: "GOL_2A3", label: "2A3" },
  { kode: "GOL_2A4", label: "2A4" },
  { kode: "GOL_2A5", label: "2A5" },
  { kode: "GOL_2B", label: "2B" },
  { kode: "GOL_3A", label: "3A" },
  { kode: "GOL_3B", label: "3B" },
  { kode: "GOL_3C", label: "3C" },
  { kode: "GOL_4A", label: "4A" },
  { kode: "GOL_4B", label: "4B" },
] as const

export interface TitikKelurahanDrd {
  kelurahan: string
  jumlahPelanggan: number
  pemakaianM3: number
  totalTagihan: number
}

export interface TitikTarifDrd {
  kode: string
  nama: string
  jumlahPelanggan: number
  pemakaianM3: number
  totalTagihan: number
}

export interface TitikTaaKelurahanDrd {
  kelurahan: string
  jumlahTaa: number
  persentaseTaa: number
}

export interface TitikCakupanDrd {
  kelurahan: string
  sl: number
  pemakaianM3: number
  totalTagihan: number
}

export interface KomposisiTagihanDrd {
  hargaAir: number
  beaBeban: number
  beaAdmin: number
  airKotor: number
  lainLain: number
  totalTagihan: number
}

export interface RingkasanDrd {
  periode: number
  jumlahPelanggan: number
  pemakaianM3: number
  totalTagihan: number
  jumlahTaa: number
  jumlahDomestik: number
  jumlahKelurahan: number
  // Visualisasi analytics data
  dataKelurahan?: TitikKelurahanDrd[]
  dataDomestik?: TitikTarifDrd[]
  dataTarif?: TitikTarifDrd[]
  dataTaaKelurahan?: TitikTaaKelurahanDrd[]
  dataCakupan?: TitikCakupanDrd[]
  dataTaaStatus?: {
    normal: number
    taa: number
    persenTaa: number
    sebaranTarif: Array<{ kode: string; jumlahTaa: number }>
  }
  dataTagihanKomposisi?: KomposisiTagihanDrd
}

export interface TitikGrafikDrd {
  kategori: string
  jumlahPelanggan: number
  pemakaianM3: number
  totalTagihan: number
}

export interface BarisKelurahanDrd {
  id: string
  kelurahan: string
  jumlahPelanggan: number
  pemakaianM3: number
  totalTagihan: number
}

export interface BarisDomestikDrd {
  id: string
  tarif: string
  namaTarif: string
  jumlahPelanggan: number
  pemakaianM3: number
  totalTagihan: number
}

export type BarisTarifDrd = BarisDomestikDrd

export interface BarisTaaKelurahanDrd {
  id: string
  kelurahan: string
  jumlahPelanggan: number
  pemakaianM3: number
  totalTagihan: number
}

export interface BarisCakupanDrd {
  id: string
  kelurahan: string
  [kolom: string]: number | string
}

export interface BarisPelangganDrd {
  id: string
  nomorLangganan: string
  nama: string
  alamat: string
  tarif: string
  namaTarif: string
  kelurahan: string
  kondisi: string
  standLalu: number | null
  standAkhir: number | null
  pemakaianM3: number
  hargaAir: number
  beaBeban: number
  beaAdmin: number
  airKotor: number
  lainLain: number
  totalTagihan: number
}

interface HasilDaftarDrd<T extends TabDataDrd, B> {
  tab: T
  baris: B[]
  halaman: number
  ukuranHalaman: number
  total: number
  totalHalaman: number
}

export type HasilDataDrd =
  | HasilDaftarDrd<"kelurahan", BarisKelurahanDrd>
  | HasilDaftarDrd<"domestik", BarisDomestikDrd>
  | HasilDaftarDrd<"tarif", BarisTarifDrd>
  | HasilDaftarDrd<"taa-kelurahan", BarisTaaKelurahanDrd>
  | HasilDaftarDrd<"cakupan", BarisCakupanDrd>
  | HasilDaftarDrd<"taa", BarisPelangganDrd>
  | HasilDaftarDrd<"tagihan", BarisPelangganDrd>
  | HasilDaftarDrd<"pelanggan", BarisPelangganDrd>

export interface OpsiPeriodeDrd {
  periodes: number[]
}

export interface ParameterDaftarDrd {
  periode: number
  tab: TabDataDrd
  halaman: number
  ukuranHalaman: number
  pencarian: string
}
