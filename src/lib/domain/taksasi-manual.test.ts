import { describe, expect, it } from "vitest"
import { hitungTaksasiManual, type RiwayatValidManual } from "./taksasi-manual"

const periode = (tahun: number, bulan: number) =>
  new Date(Date.UTC(tahun, bulan - 1, 1))

function riwayat(pemakaian: number[], mulaiBulan = 1): RiwayatValidManual[] {
  return pemakaian.map((nilai, index) => ({
    id: `reading-${index}`,
    periode: periode(2026, mulaiBulan + index),
    pemakaianRiil: nilai,
    standAwal: 100 + index,
  }))
}

describe("hitungTaksasiManual", () => {
  it("merata-ratakan 12 bulan terakhir dan membulatkan ke atas", () => {
    const hasil = hitungTaksasiManual(
      riwayat(Array.from({ length: 12 }, (_, index) => index + 1)),
      periode(2027, 1),
    )

    expect(hasil).toMatchObject({
      pemakaian: 7,
      metode: "RATA_RATA_12_BULAN",
      standAwalTerakhir: 111,
      pemakaianTerakhir: 12,
    })
  })

  it("memakai tiga pemakaian tertinggi jika histori 12 bulan belum lengkap", () => {
    const hasil = hitungTaksasiManual(riwayat([2, 20, 8, 10]), periode(2026, 5))

    expect(hasil).toMatchObject({
      pemakaian: 13,
      metode: "TIGA_TERTINGGI",
    })
  })

  it("merata-ratakan seluruh histori valid yang tersedia bila kurang dari tiga", () => {
    const hasil = hitungTaksasiManual(riwayat([2, 5]), periode(2026, 3))

    expect(hasil).toMatchObject({
      pemakaian: 4,
      metode: "RIWAYAT_TERSEDIA",
    })
  })

  it("memakai stand awal dari pencatatan terakhir meskipun histori pemakaian tak valid", () => {
    const hasil = hitungTaksasiManual(
      riwayat([12], 6),
      periode(2026, 6),
      {
        id: "last-reading",
        periode: periode(2026, 5),
        standAwal: 125,
      },
    )

    expect(hasil).toMatchObject({
      pemakaian: 0,
      standAwalTerakhir: 125,
      metode: "TANPA_HISTORI",
      standSumber: {
        id: "last-reading",
        standAwal: 125,
      },
    })
  })

  it("memakai taksasi nol dan stand nol jika tidak ada pencatatan sebelumnya", () => {
    expect(hitungTaksasiManual(riwayat([12], 6), periode(2026, 6))).toMatchObject({
      pemakaian: 0,
      standAwalTerakhir: 0,
      metode: "TANPA_HISTORI",
      sumberPembacaan: [],
    })
  })
})
