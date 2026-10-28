// features/beranda/lib/peta-tipe.ts — tipe + aritmetika proyeksi peta yang
// AMAN dipakai komponen client. SENGAJA dipisah dari peta.ts (yang punya
// `import "server-only"` + query Prisma): mengimpor NILAI apa pun dari
// modul ber-"server-only" ke dalam bundle client (walau cuma butuh satu
// fungsi murni di dalamnya) membuat Next.js melempar error saat build/
// runtime ("Cannot read properties of null (reading 'useInsertionEffect')"
// — pesannya menyesatkan, akar masalahnya server-only ikut kebawa ke
// client). Kejadian nyata: mini-peta-lokasi.tsx sempat begini dan bikin
// /pengaduan 500 total sebelum dipisah ke file ini.
//
// File ini TIDAK query database sama sekali — murni definisi bentuk data
// + satu fungsi aritmetika (proyeksikanTitik). peta.ts (server) meng-impor
// & meng-ekspor-ulang tipe di sini supaya pemanggil lama tidak perlu ganti
// import path.
export interface WilayahJalur {
  id: string
  nama: string
  /** Bisa berisi >1 subpath "M...Z" digabung spasi — MultiPolygon bersegmen. */
  d: string
  /** HANYA kelurahan. 0-3, indeks ke PALET_KELURAHAN (peta-svg.tsx) — dua
   *  kelurahan bersinggungan TIDAK PERNAH kebagian indeks sama (0-2);
   *  indeks 3 slot netral kalau tiga warna tidak cukup. Warnanya sendiri
   *  TIDAK MENGKODEKAN APA-APA (sama seperti peta dashboard, lihat
   *  features/dashboard/lib/geo-queries.ts) — cuma memisahkan bidang dari
   *  tetangganya seperti peta wilayah cetak. */
  warna?: number
}

export interface ParamProyeksi {
  minLng: number
  maxLat: number
  skala: number
  offsetX: number
  offsetY: number
}

export interface PetaGeoJson {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    geometry: { type: string; coordinates: unknown }
    properties: Record<string, unknown>
  }>
}

export interface PetaCakupan {
  /** viewBox SVG — semua koordinat x/y di bawah sudah dalam ruang ini. */
  lebar: number
  tinggi: number
  kelurahan: WilayahJalur[]
  kecamatan: WilayahJalur[]
  /** Titik anonim sambungan pelanggan berkoordinat (tanpa nama/nomor). */
  titikPelanggan: [number, number][]
  /** Dipakai memproyeksikan titik LAIN (mis. lokasi pengaduan yang baru
   *  dideteksi browser warga) ke ruang SVG yang SAMA PERSIS dengan peta
   *  ini — lihat proyeksikanTitik() di bawah. */
  proyeksi: ParamProyeksi
  geoJson: {
    kelurahan: PetaGeoJson
    kecamatan: PetaGeoJson
    pelanggan: PetaGeoJson
  }
}

/** Dipakai komponen client (mis. mini-peta-lokasi.tsx) untuk menaruh titik
 *  BARU (dari navigator.geolocation, baru ada saat runtime browser) ke
 *  ruang SVG yang sama dengan batas wilayah yang sudah diproyeksikan
 *  server. Murni aritmetika dari param yang sudah dihitung sekali di
 *  server (lihat hitungPetaCakupan di peta.ts) — TIDAK menyentuh database. */
export function proyeksikanTitik(p: ParamProyeksi, lng: number, lat: number): [number, number] {
  return [p.offsetX + (lng - p.minLng) * p.skala, p.offsetY + (p.maxLat - lat) * p.skala]
}
