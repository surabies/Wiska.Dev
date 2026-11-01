export interface RiwayatTagihanManual {
  id: string
  periode: Date
  pemakaianM3: number
}

export interface StandTerakhirManual {
  id: string
  periode: Date
  standAkhir: number
}

export interface HasilTaksasiManual {
  pemakaian: number | null
  standAwalTerakhir: number | null
  bolehDitambahkan: boolean
  alasanPeninjauan: string | null
  pemakaianTerakhir: number | null
  standSumber: { id: string; periode: string; standAwal: number } | null
  sumberTagihan: { id: string; periode: string; pemakaianM3: number }[]
  metode:
    | "RATA_RATA_12_BULAN"
    | "TIGA_TERTINGGI"
    | "RIWAYAT_TERSEDIA"
    | "TANPA_HISTORI"
}

const BULAN_DALAM_TAHUN = 12
const PEMAKAIAN_MINIMUM_PERDIR = 5

function bulanSebelumnya(periode: Date): Date {
  return new Date(
    Date.UTC(
      periode.getUTCFullYear(),
      periode.getUTCMonth() - BULAN_DALAM_TAHUN,
      1
    )
  )
}

export function hitungTaksasiManual(
  riwayat: RiwayatTagihanManual[],
  periodeTarget: Date,
  standTerakhir: StandTerakhirManual | null = null
): HasilTaksasiManual {
  const sumberStandValid =
    standTerakhir &&
    standTerakhir.periode.getTime() < periodeTarget.getTime() &&
    Number.isSafeInteger(standTerakhir.standAkhir) &&
    standTerakhir.standAkhir >= 0
      ? standTerakhir
      : null
  const sumberStand = sumberStandValid
  const standAwalTerakhir = sumberStand?.standAkhir ?? null

  const pemakaianValid = riwayat
    .filter(
      (row) =>
        Number.isSafeInteger(row.pemakaianM3) &&
        row.pemakaianM3 >= 0 &&
        row.periode.getTime() < periodeTarget.getTime()
    )
    .sort((a, b) => b.periode.getTime() - a.periode.getTime())

  if (pemakaianValid.length === 0) {
    const bolehDitambahkan = sumberStand !== null
    return {
      pemakaian: bolehDitambahkan ? PEMAKAIAN_MINIMUM_PERDIR : null,
      standAwalTerakhir,
      bolehDitambahkan,
      alasanPeninjauan: bolehDitambahkan
        ? null
        : "Stand resmi periode sebelumnya atau meter aktif belum tersedia.",
      pemakaianTerakhir: null,
      standSumber: sumberStand
        ? {
            id: sumberStand.id,
            periode: sumberStand.periode.toISOString(),
            standAwal: sumberStand.standAkhir,
          }
        : null,
      sumberTagihan: [],
      metode: "TANPA_HISTORI",
    }
  }

  const mulai12Bulan = bulanSebelumnya(periodeTarget)
  const riwayat12Bulan = pemakaianValid.filter(
    (row) => row.periode >= mulai12Bulan
  )

  let dipakai: RiwayatTagihanManual[]
  let metode: HasilTaksasiManual["metode"]
  if (riwayat12Bulan.length >= BULAN_DALAM_TAHUN) {
    dipakai = riwayat12Bulan.slice(0, BULAN_DALAM_TAHUN)
    metode = "RATA_RATA_12_BULAN"
  } else if (pemakaianValid.length >= 3) {
    dipakai = [...pemakaianValid]
      .sort((a, b) => b.pemakaianM3 - a.pemakaianM3)
      .slice(0, 3)
    metode = "TIGA_TERTINGGI"
  } else {
    dipakai = pemakaianValid
    metode = "RIWAYAT_TERSEDIA"
  }

  const jumlah = dipakai.reduce((total, row) => total + row.pemakaianM3, 0)
  return {
    pemakaian: Math.ceil(jumlah / dipakai.length),
    standAwalTerakhir,
    bolehDitambahkan: sumberStand !== null,
    alasanPeninjauan:
      sumberStand === null
        ? "Stand resmi periode sebelumnya atau meter aktif belum tersedia."
        : null,
    pemakaianTerakhir: pemakaianValid[0]!.pemakaianM3,
    standSumber: sumberStand
      ? {
          id: sumberStand.id,
          periode: sumberStand.periode.toISOString(),
          standAwal: sumberStand.standAkhir,
        }
      : null,
    sumberTagihan: dipakai.map((row) => ({
      id: row.id,
      periode: row.periode.toISOString(),
      pemakaianM3: row.pemakaianM3,
    })),
    metode,
  }
}
