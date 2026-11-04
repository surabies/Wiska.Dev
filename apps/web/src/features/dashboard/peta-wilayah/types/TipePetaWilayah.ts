export interface FC {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    geometry: unknown
    properties: Record<string, unknown>
  }>
}

export interface RingkasanLaporanPeta {
  aktif: number
  laporan30Hari: number
  rataRataResponsJam: number | null
  rataRataPenyelesaianJam: number | null
  trenBulanan: Array<{ bulan: string; jumlah: number }>
  hotspot: Array<{ kelurahan: string; jumlah: number }>
}

export interface RingkasanAsetPeta {
  totalRute: number
  ruteDenganGeometri: number
  pelangganBerkoordinat: number
  kelurahanDenganGeometri: number
}
