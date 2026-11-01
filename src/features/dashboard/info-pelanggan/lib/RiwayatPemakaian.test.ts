import { describe, expect, it } from "vitest"
import { susunRiwayatPemakaian } from "./RiwayatPemakaian"

describe("susunRiwayatPemakaian", () => {
  it("keeps earlier official readings when the selected period has no official reading", () => {
    const hasil = susunRiwayatPemakaian({
      periode: "202608",
      pembacaanTerpilih: [],
      pembacaanTerbaru: [],
      historiSebelum: [
        { periode: "2026-07-01T00:00:00.000Z", pemakaianM3: 10 },
        { periode: 202606, pemakaianM3: 12 },
        { periode: 202605, pemakaianM3: 9 },
        { periode: 202604, pemakaianM3: 11 },
      ],
    })

    expect(hasil.baca).toBeUndefined()
    expect(hasil.riwayat.map((row) => [row.periode, row.pemakaianM3])).toEqual([
      ["202607", 10],
      ["202606", 12],
      ["202605", 9],
    ])
  })

  it("uses the selected official reading and only its three preceding periods", () => {
    const hasil = susunRiwayatPemakaian({
      periode: "202607",
      pembacaanTerpilih: [{ periode: "2026-07-01T00:00:00.000Z" }],
      pembacaanTerbaru: [],
      historiSebelum: [
        { periode: 202606, pemakaianM3: 10 },
        { periode: 202605, pemakaianM3: 12 },
        { periode: 202604, pemakaianM3: 9 },
        { periode: 202603, pemakaianM3: 11 },
      ],
    })

    expect(hasil.baca?.periode).toBe("2026-07-01T00:00:00.000Z")
    expect(hasil.riwayat.map((row) => row.periode)).toEqual([
      "202606",
      "202605",
      "202604",
    ])
  })
})
