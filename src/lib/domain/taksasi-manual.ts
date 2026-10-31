export interface RiwayatValidManual {
  id: string
  periode: Date
  pemakaianRiil: number
  standAwal: number
}

export interface StandTerakhirManual {
  id: string
  periode: Date
  standAwal: number
}

export interface HasilTaksasiManual {
  pemakaian: number
  standAwalTerakhir: number
  pemakaianTerakhir: number | null
  standSumber: { id: string; periode: string; standAwal: number } | null
  sumberPembacaan: { id: string; periode: string; pemakaianRiil: number }[]
  metode:
    | "RATA_RATA_12_BULAN"
    | "TIGA_TERTINGGI"
    | "RIWAYAT_TERSEDIA"
    | "TANPA_HISTORI"
}

const BULAN_DALAM_TAHUN = 12

function bulanSebelumnya(periode: Date): Date {
  return new Date(
    Date.UTC(
      periode.getUTCFullYear(),
      periode.getUTCMonth() - BULAN_DALAM_TAHUN,
      1,
    ),
  )
}

export function hitungTaksasiManual(
  riwayat: RiwayatValidManual[],
  periodeTarget: Date,
  standTerakhir: StandTerakhirManual | null = null,
): HasilTaksasiManual {
  const standHistory = riwayat
    .filter(
      (row) =>
        Number.isSafeInteger(row.standAwal) &&
        row.standAwal >= 0 &&
        row.periode.getTime() < periodeTarget.getTime(),
    )
    .sort((a, b) => b.periode.getTime() - a.periode.getTime())
  const sumberStandValid =
    standTerakhir &&
    standTerakhir.periode.getTime() < periodeTarget.getTime() &&
    Number.isSafeInteger(standTerakhir.standAwal) &&
    standTerakhir.standAwal >= 0
      ? standTerakhir
      : null
  const sumberStand = sumberStandValid ?? standHistory[0] ?? null
  const standAwalTerakhir =
    sumberStand && Number.isSafeInteger(sumberStand.standAwal)
      ? sumberStand.standAwal
      : 0

  const pemakaianValid = riwayat
    .filter(
      (row) =>
        Number.isSafeInteger(row.pemakaianRiil) &&
        row.pemakaianRiil >= 0 &&
        Number.isSafeInteger(row.standAwal) &&
        row.standAwal >= 0 &&
        row.periode.getTime() < periodeTarget.getTime(),
    )
    .sort((a, b) => b.periode.getTime() - a.periode.getTime())

  if (pemakaianValid.length === 0) {
    return {
      pemakaian: 0,
      standAwalTerakhir,
      pemakaianTerakhir: null,
      standSumber: sumberStand
        ? {
            id: sumberStand.id,
            periode: sumberStand.periode.toISOString(),
            standAwal: standAwalTerakhir,
          }
        : null,
      sumberPembacaan: [],
      metode: "TANPA_HISTORI",
    }
  }

  const mulai12Bulan = bulanSebelumnya(periodeTarget)
  const riwayat12Bulan = pemakaianValid.filter(
    (row) => row.periode >= mulai12Bulan,
  )

  let dipakai: RiwayatValidManual[]
  let metode: HasilTaksasiManual["metode"]
  if (riwayat12Bulan.length >= BULAN_DALAM_TAHUN) {
    dipakai = riwayat12Bulan.slice(0, BULAN_DALAM_TAHUN)
    metode = "RATA_RATA_12_BULAN"
  } else if (pemakaianValid.length >= 3) {
    dipakai = [...pemakaianValid]
      .sort((a, b) => b.pemakaianRiil - a.pemakaianRiil)
      .slice(0, 3)
    metode = "TIGA_TERTINGGI"
  } else {
    dipakai = pemakaianValid
    metode = "RIWAYAT_TERSEDIA"
  }

  const jumlah = dipakai.reduce((total, row) => total + row.pemakaianRiil, 0)
  return {
    pemakaian: Math.ceil(jumlah / dipakai.length),
    standAwalTerakhir,
    pemakaianTerakhir: pemakaianValid[0]!.pemakaianRiil,
    standSumber: sumberStand
      ? {
          id: sumberStand.id,
          periode: sumberStand.periode.toISOString(),
          standAwal: standAwalTerakhir,
        }
      : null,
    sumberPembacaan: dipakai.map((row) => ({
      id: row.id,
      periode: row.periode.toISOString(),
      pemakaianRiil: row.pemakaianRiil,
    })),
    metode,
  }
}
