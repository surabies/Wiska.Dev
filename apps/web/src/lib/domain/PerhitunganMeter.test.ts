import { describe, expect, it } from "vitest"
import { hitungPemakaianGantiMeter } from "./PerhitunganMeter"

describe("hitungPemakaianGantiMeter", () => {
  it("adds old-meter usage through the lift stand and new-meter usage", () => {
    expect(
      hitungPemakaianGantiMeter({
        standAwalLama: 100,
        standAngkatLama: 110,
        standMeterBaru: 10,
      })
    ).toBe(20)
  })

  it("preserves a negative segment result for review instead of clamping it", () => {
    expect(
      hitungPemakaianGantiMeter({
        standAwalLama: 100,
        standAngkatLama: 90,
        standMeterBaru: 5,
      })
    ).toBe(-5)
  })
})
