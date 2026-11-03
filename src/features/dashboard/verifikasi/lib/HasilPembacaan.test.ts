import { describe, expect, it } from "vitest"
import { tentukanHasilPembacaan } from "./HasilPembacaan"

describe("tentukanHasilPembacaan", () => {
  it("uses corrected end stand and recalculates usage before official verification", () => {
    expect(
      tentukanHasilPembacaan({
        standAwal: 1091,
        standAkhir: 1091,
        standAkhirRevisi: 1101,
        pemakaian: 5,
      })
    ).toEqual({ standAwal: 1091, standAkhir: 1101, pemakaian: 10 })
  })

  it("preserves source usage when there is no correction", () => {
    expect(
      tentukanHasilPembacaan({
        standAwal: 1091,
        standAkhir: 1091,
        pemakaian: 5,
      })
    ).toEqual({ standAwal: 1091, standAkhir: 1091, pemakaian: 5 })
  })

  it("uses the official reading result after V3", () => {
    expect(
      tentukanHasilPembacaan({
        standAwal: 1091,
        standAkhir: 1091,
        standAkhirRevisi: 1101,
        pemakaian: 5,
        pembacaan: {
          standAkhir: 1101,
          pemakaianM3: 10,
          pemakaianRiil: 10,
        },
      })
    ).toEqual({ standAwal: 1091, standAkhir: 1101, pemakaian: 10 })
  })

  it("calculates MB usage from the old-meter lift and new-meter reading, setting new meter stand as standAkhir", () => {
    expect(
      tentukanHasilPembacaan({
        standAwal: 100,
        standAkhir: 100,
        pemakaian: 0,
        kondisi: "MB",
        standAngkatLama: 110,
        standMeterBaru: 10,
      })
    ).toEqual({ standAwal: 100, standAkhir: 10, pemakaian: 20 })
  })

  it("does not count the old reported end stand as new-meter usage and uses standMeterBaru as standAkhir", () => {
    expect(
      tentukanHasilPembacaan({
        standAwal: 2106,
        standAkhir: 2106,
        pemakaian: 6,
        kondisi: "MB",
        standAngkatLama: 2200,
        standMeterBaru: 10,
      })
    ).toEqual({ standAwal: 2106, standAkhir: 10, pemakaian: 104 })
  })
})
