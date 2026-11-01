import { describe, expect, it } from "vitest"
import { hitungTaksasiManual, type RiwayatTagihanManual } from "./taksasi-manual"

const periode = (tahun: number, bulan: number) =>
  new Date(Date.UTC(tahun, bulan - 1, 1))

function riwayat(pemakaian: number[], mulaiBulan = 1): RiwayatTagihanManual[] {
  return pemakaian.map((nilai, index) => ({
    id: `bill-${index}`,
    periode: periode(2026, mulaiBulan + index),
    pemakaianM3: nilai,
  }))
}

describe("hitungTaksasiManual", () => {
  it("merata-ratakan 12 bulan tagihan terakhir dan membulatkan ke atas", () => {
    const hasil = hitungTaksasiManual(
      riwayat(Array.from({ length: 12 }, (_, index) => index + 1)),
      periode(2027, 1),
    )

    expect(hasil).toMatchObject({
      pemakaian: 7,
      metode: "RATA_RATA_12_BULAN",
      standAwalTerakhir: null,
      bolehDitambahkan: false,
      pemakaianTerakhir: 12,
    })
  })

  it("memakai tiga nilai tagihan tertinggi jika histori 12 bulan belum lengkap", () => {
    const hasil = hitungTaksasiManual(riwayat([2, 20, 8, 10]), periode(2026, 5))

    expect(hasil).toMatchObject({
      pemakaian: 13,
      metode: "TIGA_TERTINGGI",
    })
  })

  it("merata-ratakan seluruh histori tagihan yang tersedia bila kurang dari tiga", () => {
    const hasil = hitungTaksasiManual(riwayat([2, 5]), periode(2026, 3))

    expect(hasil).toMatchObject({
      pemakaian: 4,
      metode: "RIWAYAT_TERSEDIA",
    })
  })

  it("menggunakan nilai tagihan termasuk nol dan nilai hasil override/minimum", () => {
    const hasil = hitungTaksasiManual(riwayat([0, 10, 10]), periode(2026, 4))

    expect(hasil).toMatchObject({
      pemakaian: 7,
      metode: "TIGA_TERTINGGI",
      pemakaianTerakhir: 10,
      sumberTagihan: [
        { pemakaianM3: 10 },
        { pemakaianM3: 10 },
        { pemakaianM3: 0 },
      ],
    })
  })

  it("memakai stand resmi terakhir dan minimum Perdir bila tidak ada histori tagihan", () => {
    const hasil = hitungTaksasiManual(
      riwayat([12], 6),
      periode(2026, 6),
      {
        id: "last-reading",
        periode: periode(2026, 5),
        standAkhir: 125,
      },
    )

    expect(hasil).toMatchObject({
      pemakaian: 5,
      standAwalTerakhir: 125,
      bolehDitambahkan: true,
      metode: "TANPA_HISTORI",
      standSumber: {
        id: "last-reading",
        standAwal: 125,
      },
    })
  })

  it("menahan baris bila stand resmi periode sebelumnya tidak tersedia", () => {
    expect(hitungTaksasiManual(riwayat([12], 6), periode(2026, 6))).toMatchObject({
      pemakaian: null,
      standAwalTerakhir: null,
      bolehDitambahkan: false,
      alasanPeninjauan:
        "Stand resmi periode sebelumnya atau meter aktif belum tersedia.",
      metode: "TANPA_HISTORI",
      sumberTagihan: [],
    })
  })
})
