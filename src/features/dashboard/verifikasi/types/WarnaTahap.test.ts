import { describe, expect, it } from "vitest"
import { tahapDari } from "./WarnaTahap"

describe("tahapDari", () => {
  it("membedakan laporan mandiri terverifikasi dari V3 resmi", () => {
    expect(
      tahapDari({
        isVerified: true,
        laporanMandiriTerverifikasi: true,
      })
    ).toBe("TERVERIFIKASI")
  })

  it("mempertahankan V3 untuk pembacaan resmi", () => {
    expect(
      tahapDari({
        isVerified: true,
        laporanMandiriTerverifikasi: true,
        verif3At: "2026-10-20T00:00:00.000Z",
      })
    ).toBe("V3")
  })
})
