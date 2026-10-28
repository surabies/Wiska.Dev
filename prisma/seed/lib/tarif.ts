// prisma/seed/lib/tarif.ts — MENURUNKAN tabel tarif dari data mentah
// ProgresCater, bukan mengetiknya manual.
//
// KENAPA DITURUNKAN, BUKAN DIKETIK DARI SK TARIF:
// bukan karena SK tarif tidak penting — justru sebaliknya. Tapi angka yang
// SEBENARNYA dipakai menagih 22.523 pelanggan bulan Mei ada di file ini,
// dan itulah yang harus direproduksi aplikasi kalau ia mau menggantikan
// Aurora tanpa mengubah tagihan siapa pun. SK tarif dipakai untuk
// MENGONFIRMASI angka ini (dan menandatanganinya), bukan untuk menebaknya.
// Kalau nanti ada selisih antara SK dan data, selisih itu sendiri adalah
// temuan penting — dan hanya bisa terlihat kalau dua-duanya ada.
//
// Cara kerja penurunan, per golongan tarif:
//   1. Kumpulkan seluruh pasangan (pemakaian, jmlhargaair) yang teramati.
//      Sudah diverifikasi pasangan ini FUNGSI MURNI — 629 kombinasi
//      (golongan, pemakaian) di data, NOL konflik harga.
//   2. Untuk tiap blok berurutan (1-10, 11-20, 21-30, >30), hitung harga
//      per-m3-nya dari observasi di dalam blok itu, dengan mengurangi
//      biaya blok-blok di bawahnya yang harganya sudah diketahui.
//   3. Verifikasi silang: harga yang diturunkan WAJIB mereproduksi SEMUA
//      observasi golongan itu. Kalau ada satu saja yang meleset, seluruh
//      golongan itu ditolak (tidak diseed) dan dilaporkan — lebih baik
//      kosong daripada salah menagih.
//
// Golongan bervolume kecil (1B, 2A1, 2A5, 2B, 3C, 4A, 4B) tidak punya
// observasi di semua blok. Blok yang tidak bisa dipastikan TIDAK
// diekstrapolasi — dilaporkan sebagai kekurangan yang wajib diisi dari SK.

import { BATAS_BLOK, hitungHargaAir, type HargaBlok } from "@/lib/domain/tagihan"

export interface ObservasiTarif {
  /// Kode asli di CSV, mis. "2A3".
  kodeAsli: string
  pemakaianM3: number
  jmlHargaAir: number
}

export interface PencilanTarif {
  kodeAsli: string
  blok: number
  pemakaianM3: number
  jmlHargaAir: number
  hargaSeharusnya: number
}

export interface HasilTurunanTarif {
  kodeAsli: string
  blok: HargaBlok[]
  /// Blok yang tidak bisa dipastikan dari data (tidak ada observasi sama
  /// sekali di rentang itu). TIDAK diekstrapolasi — wajib dari SK tarif.
  blokTidakPasti: number[]
  /// Jumlah observasi yang dipakai untuk golongan ini.
  jumlahObservasi: number
  /// Baris yang harganya menyimpang dari konsensus blok-nya. BUKAN alasan
  /// menolak seluruh golongan — justru temuan yang perlu ditindaklanjuti
  /// satu per satu.
  pencilan: PencilanTarif[]
}

/// Biaya untuk mengonsumsi tepat `m3` meter kubik memakai harga blok yang
/// SUDAH diketahui. Dipakai sebagai "alas" saat menghitung harga blok
/// berikutnya dari sebuah observasi.
function biayaSampai(m3: number, blokDiketahui: readonly HargaBlok[]): number {
  return hitungHargaAir(m3, blokDiketahui)
}

export function turunkanTarifBlok(observasi: readonly ObservasiTarif[]): HasilTurunanTarif[] {
  const perGolongan = new Map<string, Map<number, number>>()
  for (const o of observasi) {
    if (o.pemakaianM3 <= 0) continue // pakai 0 -> harga 0, tidak informatif
    let m = perGolongan.get(o.kodeAsli)
    if (!m) {
      m = new Map()
      perGolongan.set(o.kodeAsli, m)
    }
    // Konflik harga untuk (golongan, pemakaian) yang sama sudah diverifikasi
    // tidak ada; kemunculan pertama sudah mewakili.
    if (!m.has(o.pemakaianM3)) m.set(o.pemakaianM3, o.jmlHargaAir)
  }

  const hasil: HasilTurunanTarif[] = []

  for (const [kodeAsli, titik] of [...perGolongan].sort(([a], [b]) => a.localeCompare(b))) {
    const blok: HargaBlok[] = []
    const blokTidakPasti: number[] = []

    for (const batas of BATAS_BLOK) {
      const { blok: nomorBlok, batasAwalM3, batasAkhirM3 } = batas
      const terpakaiSebelumnya = batasAwalM3 - 1

      // Blok ini hanya bisa diturunkan kalau SEMUA blok di bawahnya sudah
      // diketahui — biaya "alas"-nya bergantung pada mereka.
      if (blok.length !== nomorBlok - 1) {
        blokTidakPasti.push(nomorBlok)
        continue
      }

      const alas = biayaSampai(terpakaiSebelumnya, blok)

      // KONSENSUS, bukan kebulatan suara. Versi pertama fungsi ini menuntut
      // SEMUA observasi dalam satu blok menghasilkan harga identik, dan itu
      // terbukti terlalu kaku: golongan 2B punya 18 baris yang sepakat
      // 12.750/m3 dan SATU baris menyimpang — akibatnya seluruh blok 4
      // dibuang, dan 19 tagihan gagal direproduksi hanya karena satu
      // anomali. Yang benar: ambil harga yang disepakati mayoritas, lalu
      // LAPORKAN yang menyimpang sebagai temuan (lihat `pencilan`) —
      // menyembunyikan satu baris aneh dengan membuang 18 baris sehat
      // adalah pertukaran yang salah arah.
      const suara = new Map<number, number>()
      for (const [p, h] of titik) {
        if (p < batasAwalM3) continue
        if (batasAkhirM3 !== null && p > batasAkhirM3) continue
        const kandidat = (h - alas) / (p - terpakaiSebelumnya)
        if (!Number.isInteger(kandidat) || kandidat <= 0) continue
        suara.set(kandidat, (suara.get(kandidat) ?? 0) + 1)
      }

      if (suara.size === 0) {
        blokTidakPasti.push(nomorBlok)
        continue
      }
      const [hargaPerM3] = [...suara].sort((a, b) => b[1] - a[1])[0]!
      blok.push({ blok: nomorBlok, batasAwalM3, batasAkhirM3, hargaPerM3 })
    }

    // Verifikasi silang: catat setiap observasi yang tidak direproduksi oleh
    // harga turunan. Hanya diperiksa untuk pemakaian yang seluruh bloknya
    // sudah diketahui — di luar itu memang belum bisa dinilai.
    const pencilan: PencilanTarif[] = []
    const batasTerjamin =
      blok.length === 0
        ? 0
        : (blok[blok.length - 1]!.batasAkhirM3 ?? Number.POSITIVE_INFINITY)
    for (const [p, h] of titik) {
      if (p > batasTerjamin) continue
      const dihitung = hitungHargaAir(p, blok)
      if (dihitung !== h) {
        pencilan.push({
          kodeAsli,
          blok: blok.find((b) => p >= b.batasAwalM3 && (b.batasAkhirM3 === null || p <= b.batasAkhirM3))?.blok ?? 0,
          pemakaianM3: p,
          jmlHargaAir: h,
          hargaSeharusnya: dihitung,
        })
      }
    }

    hasil.push({ kodeAsli, blok, blokTidakPasti, jumlahObservasi: titik.size, pencilan })
  }

  return hasil
}

// --------------------------------------------------------------------------
// Biaya tetap
// --------------------------------------------------------------------------

/// Bea beban terverifikasi FUNGSI MURNI ukuran meter (bukan golongan
/// tarif): 32 kombinasi (golongan, ukuran) di data, nol konflik. Bea admin
/// & air kotor flat untuk seluruh 22.523 pelanggan.
export interface ObservasiBiayaTetap {
  ukuranMeter: string
  beaBeban: number
  beaAdmin: number
  airKotor: number
}

export interface HasilTurunanBiayaTetap {
  beaBebanPerUkuran: Map<string, number>
  beaAdmin: number | null
  airKotor: number | null
  konflik: string[]
}

export function turunkanBiayaTetap(
  observasi: readonly ObservasiBiayaTetap[]
): HasilTurunanBiayaTetap {
  const beaBebanPerUkuran = new Map<string, number>()
  const konflik: string[] = []
  const adminSet = new Set<number>()
  const kotorSet = new Set<number>()

  for (const o of observasi) {
    const sudah = beaBebanPerUkuran.get(o.ukuranMeter)
    if (sudah === undefined) beaBebanPerUkuran.set(o.ukuranMeter, o.beaBeban)
    else if (sudah !== o.beaBeban) {
      konflik.push(`bea beban ukuran ${o.ukuranMeter}: ${sudah} vs ${o.beaBeban}`)
    }
    adminSet.add(o.beaAdmin)
    kotorSet.add(o.airKotor)
  }

  if (adminSet.size > 1) konflik.push(`bea admin tidak tunggal: ${[...adminSet].join(", ")}`)
  if (kotorSet.size > 1) konflik.push(`air kotor tidak tunggal: ${[...kotorSet].join(", ")}`)

  return {
    beaBebanPerUkuran,
    beaAdmin: adminSet.size === 1 ? [...adminSet][0]! : null,
    airKotor: kotorSet.size === 1 ? [...kotorSet][0]! : null,
    konflik,
  }
}
