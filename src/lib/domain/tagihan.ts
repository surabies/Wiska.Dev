// Shared pure business rules for water billing calculations.
//
// MURNI: modul ini sengaja TIDAK mengimpor apa pun (tidak Prisma, tidak
// database, tidak I/O). Semua masukan berupa angka & string biasa supaya
// rumusnya bisa dijalankan di mana saja — server, skrip seed, skrip
// verifikasi — dan hasilnya bisa dibandingkan langsung dengan tagihan
// Aurora tanpa perlu database hidup.
//
// SELURUH rumus di sini DITURUNKAN DARI DATA, bukan dikarang: 22.523 dari
// 22.523 baris tagihan ProgresCater periode 202605 berhasil direproduksi
// persis dengan fungsi-fungsi di bawah. Lihat prisma/docs/PEMETAAN-DATA.md dan
// jalankan `pnpm db:verifikasi-tarif` untuk membuktikan ulang.
//
// KENAPA DI LIB DOMAIN, BUKAN DI prisma/index.ts:
// rumus tagihan bukan urusan penyimpanan. Ia dipakai oleh server (menerbitkan
// tagihan), oleh skrip seed (memverifikasi hasil impor), dan kelak oleh
// panel verifikator (pratinjau sebelum closing). Menaruhnya di sini membuat
// ketiganya memakai SATU rumus yang sama — kalau tarif berubah, tidak ada
// salinan kedua yang ketinggalan.

/// Batas blok konsumsi progresif, seragam untuk SEMUA golongan tarif.
/// Terverifikasi dari data: harga marginal berubah tepat di 11, 21, dan 31
/// m3 pada setiap golongan yang datanya cukup padat untuk diuji.
export const BATAS_BLOK: readonly {
  blok: number
  batasAwalM3: number
  batasAkhirM3: number | null
}[] = [
  { blok: 1, batasAwalM3: 1, batasAkhirM3: 10 },
  { blok: 2, batasAwalM3: 11, batasAkhirM3: 20 },
  { blok: 3, batasAwalM3: 21, batasAkhirM3: 30 },
  { blok: 4, batasAwalM3: 31, batasAkhirM3: null },
]

/// PENTING — `batasAwalM3` bersifat **INKLUSIF**: blok 1 berisi m3 ke-1
/// sampai ke-10, blok 2 m3 ke-11 sampai ke-20, dst. Jadi baris tarif blok 1
/// ditulis `{ batasAwalM3: 1, batasAkhirM3: 10 }`, BUKAN `{ 0, 10 }`.
///
/// Ini bukan detail sepele: konvensi eksklusif (0-10, 10-20, ...) terlihat
/// sama benarnya di layar tapi menghasilkan tagihan yang KURANG SATU m3 di
/// setiap blok. Versi awal `hitungBiayaAir` di server memakai konvensi
/// eksklusif sementara tabel TarifBlok diisi inklusif — persis jenis
/// ketidakcocokan yang tidak terlihat sampai ada pelanggan protes. Karena
/// itu sekarang hanya ADA SATU implementasi, yaitu di file ini.
export interface HargaBlok {
  blok: number
  /// Inklusif — lihat catatan di atas.
  batasAwalM3: number
  /// Inklusif. null = blok terakhir, tidak berbatas atas.
  batasAkhirM3: number | null
  hargaPerM3: number
}

/// Rincian per blok — dipakai UI/API untuk menjelaskan ke pelanggan dari
/// mana angka tagihannya berasal, bukan cuma totalnya.
export interface RincianBlok {
  blok: number
  dariM3: number
  sampaiM3: number
  volumeM3: number
  hargaPerM3: number
  subtotal: number
}

/// Versi `hitungHargaAir` yang juga mengembalikan rinciannya. Keduanya
/// memakai jalur perhitungan yang SAMA supaya total dan rincian tidak
/// mungkin berbeda.
export function hitungRincianHargaAir(
  pemakaianM3: number,
  blokTarif: readonly HargaBlok[],
): { total: number; rincian: RincianBlok[] } {
  const rincian: RincianBlok[] = []
  if (pemakaianM3 <= 0) return { total: 0, rincian }

  let total = 0
  let sisa = pemakaianM3
  const urut = [...blokTarif].sort((a, b) => a.batasAwalM3 - b.batasAwalM3)

  for (const b of urut) {
    if (sisa <= 0) break
    const terpakaiSebelumnya = b.batasAwalM3 - 1
    if (pemakaianM3 <= terpakaiSebelumnya) break
    const lebarBlok =
      b.batasAkhirM3 === null ? Infinity : b.batasAkhirM3 - b.batasAwalM3 + 1
    const volumeM3 = Math.min(sisa, lebarBlok)
    const subtotal = volumeM3 * b.hargaPerM3
    total += subtotal
    rincian.push({
      blok: b.blok,
      dariM3: b.batasAwalM3,
      sampaiM3: terpakaiSebelumnya + volumeM3,
      volumeM3,
      hargaPerM3: b.hargaPerM3,
      subtotal,
    })
    sisa -= volumeM3
  }

  return { total, rincian }
}

/// Harga air progresif: tiap m3 dikenakan harga blok tempat m3 itu jatuh,
/// BUKAN seluruh pemakaian dikenakan harga blok tertinggi. Contoh 2A3
/// dengan pakai 21 m3: 10x3.120 + 10x5.520 + 1x8.880 = 95.280.
export function hitungHargaAir(
  pemakaianM3: number,
  blokTarif: readonly HargaBlok[],
): number {
  return hitungRincianHargaAir(pemakaianM3, blokTarif).total
}

/// Blok tertinggi yang tersentuh oleh pemakaian ini — dipakai untuk kolom
/// `blokTarif` di PembacaanMeter (di data sumber: `blok_m3`).
export function tentukanBlok(pemakaianM3: number): number {
  if (pemakaianM3 <= 0) return 1
  for (const b of BATAS_BLOK) {
    if (b.batasAkhirM3 === null || pemakaianM3 <= b.batasAkhirM3) return b.blok
  }
  return BATAS_BLOK[BATAS_BLOK.length - 1]!.blok
}

export interface KomponenTagihan {
  jmlHargaAir: number
  beaBeban: number
  beaAdmin: number
  airKotor: number
  lainLain: number
}

export function hitungTotalTagihan(k: KomponenTagihan): number {
  return k.jmlHargaAir + k.beaBeban + k.beaAdmin + k.airKotor + k.lainLain
}

// --------------------------------------------------------------------------
// Pemakaian yang DITAGIHKAN vs pemakaian yang TERBACA
// --------------------------------------------------------------------------
// Keduanya sering berbeda — di periode 202605 berbeda pada 10.160 dari
// 22.523 baris (45%). Yang masuk tagihan adalah pemakaian TAGIH.

export type AlasanTaksir =
  /// Pemakaian riil di bawah 5 m3 -> ditagih 5 m3. Dasar: Peraturan Direksi
  /// (Perdir) tentang pemakaian minimum. Diterapkan oleh verifikator.
  | "MINIMUM_5M3"
  /// Meter tidak bisa dibaca (rumah kosong, meter rusak, terhalang, dst) ->
  /// ditaksir dari pemakaian periode sebelumnya.
  | "TAKSIRAN_BULAN_LALU"
  /// Tidak ada air / sambungan sudah dicabut -> ditagih 0, pemakaian
  /// minimum TIDAK berlaku.
  | "NOL_TIDAK_ADA_AIR"
  /// Verifikator menetapkan angka lain secara sadar. Tidak ada rumus untuk
  /// ini — dan memang tidak boleh ada; yang wajib ada adalah jejaknya.
  | "OVERRIDE_MANUAL"

/// Pemakaian minimum menurut Perdir. Dipisah sebagai konstanta bernama
/// supaya kalau Perdir-nya direvisi, yang berubah cuma satu baris di sini —
/// dan `git log` mencatat kapan serta kenapa.
export const PEMAKAIAN_MINIMUM_M3 = 5

/// Kondisi catat yang berarti "memang tidak ada pemakaian sama sekali", di
/// mana pemakaian minimum TIDAK berlaku. Terverifikasi dari data: kode `8`
/// (TIDAK ADA AIR) dan `D` (DICABUT) SELALU ditagih 0 m3 — 334 + 27 baris,
/// tanpa satu pun pengecualian.
const KONDISI_NOL: ReadonlySet<string> = new Set(["TIDAK_ADA_AIR", "DICABUT"])

/// Kondisi catat yang berarti meter tidak terbaca, sehingga pemakaiannya
/// ditaksir dari periode sebelumnya (bukan dari selisih stand, yang pada
/// kasus ini nyaris selalu 0 karena stand tidak bergerak).
const KONDISI_TAKSIR: ReadonlySet<string> = new Set([
  "TIDAK_DIPAKAI",
  "RUMAH_KOSONG",
  "METER_MATI_ADA_AIR",
  "TTB",
  "MTA",
  "TERHALANG",
  "METER_RUSAK",
  "DK",
  "BMK_BMB",
])

export interface HasilPemakaianTagih {
  pemakaianTagih: number
  alasan: AlasanTaksir | null
}

/// Menentukan pemakaian yang ditagihkan dari pemakaian riil + kondisi
/// catat. Mengembalikan `alasan: null` kalau pemakaian riil dipakai apa
/// adanya (kasus normal, mayoritas baris).
///
/// CATATAN: fungsi ini adalah USULAN otomatis untuk verifikator, BUKAN
/// keputusan final. Verifikator boleh menetapkan angka lain
/// (OVERRIDE_MANUAL) — di data 202605 sekitar 1,4% baris memang begitu, dan
/// itu wajar. Yang penting angkanya tersimpan beserta alasannya.
export function usulkanPemakaianTagih(params: {
  pemakaianRiil: number
  kondisi: string
  pemakaianLalu: number | null
}): HasilPemakaianTagih {
  const { pemakaianRiil, kondisi, pemakaianLalu } = params

  if (KONDISI_NOL.has(kondisi)) {
    return { pemakaianTagih: 0, alasan: "NOL_TIDAK_ADA_AIR" }
  }

  if (KONDISI_TAKSIR.has(kondisi) && pemakaianLalu !== null) {
    // Taksiran pun tetap tunduk pada pemakaian minimum.
    const taksiran = Math.max(pemakaianLalu, PEMAKAIAN_MINIMUM_M3)
    return { pemakaianTagih: taksiran, alasan: "TAKSIRAN_BULAN_LALU" }
  }

  if (pemakaianRiil < PEMAKAIAN_MINIMUM_M3) {
    return { pemakaianTagih: PEMAKAIAN_MINIMUM_M3, alasan: "MINIMUM_5M3" }
  }

  return { pemakaianTagih: pemakaianRiil, alasan: null }
}
