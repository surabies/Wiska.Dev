import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  daftarCatat: { groupBy: vi.fn() },
  periodePenagihan: { findMany: vi.fn() },
}))

vi.mock("@db", () => ({
  prisma: {
    daftarCatat: mocks.daftarCatat,
    periodePenagihan: mocks.periodePenagihan,
  },
}))

import {
  daftarPeriodeUjiLaporMandiri,
  pastikanPeriodeUjiLaporMandiri,
} from "./laporan-mandiri.service"

describe("periode uji laporan mandiri", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "development")
    mocks.daftarCatat.groupBy.mockResolvedValue([
      { periode: 202608 },
      { periode: 202607 },
      { periode: 202606 },
    ])
    mocks.periodePenagihan.findMany.mockResolvedValue([{ periode: 202607 }])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("only lists operational periods that are not locked", async () => {
    await expect(daftarPeriodeUjiLaporMandiri()).resolves.toEqual([202608, 202606])
  })

  it("accepts only a listed open period", async () => {
    await expect(pastikanPeriodeUjiLaporMandiri("202608")).resolves.toBe(202608)
    await expect(pastikanPeriodeUjiLaporMandiri("202607")).rejects.toThrow(
      "Periode uji tidak tersedia atau sudah terkunci.",
    )
    await expect(pastikanPeriodeUjiLaporMandiri("202611")).rejects.toThrow(
      "Periode uji tidak tersedia atau sudah terkunci.",
    )
  })

  it("disables overrides in production", async () => {
    vi.stubEnv("NODE_ENV", "production")

    await expect(daftarPeriodeUjiLaporMandiri()).resolves.toEqual([])
    await expect(pastikanPeriodeUjiLaporMandiri("202608")).rejects.toThrow(
      "Pemilihan periode uji tidak tersedia.",
    )
    expect(mocks.daftarCatat.groupBy).not.toHaveBeenCalled()
  })
})
