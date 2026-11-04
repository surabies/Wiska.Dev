import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const prisma = {
    laporanHarianPetugas: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    konfigurasi: {
      findUnique: vi.fn(),
    },
    daftarCatat: {
      findFirst: vi.fn(),
    },
  }
  return { prisma }
})

vi.mock("@db", () => ({
  prisma: mocks.prisma,
}))

vi.mock("../bersama/PembacaanResmi.service", () => ({
  ambilPembacaanResmi: vi.fn().mockResolvedValue([]),
  ambilPemakaianPeriodeSebelumnya: vi.fn().mockResolvedValue(new Map()),
  denganSumberResmi: vi.fn((x) => x),
}))

import { daftarLaporanHarian } from "./LaporanHarianKueri.service"

describe("daftarLaporanHarian - penyaringan kondisi", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.laporanHarianPetugas.findMany.mockResolvedValue([])
    mocks.prisma.laporanHarianPetugas.count.mockResolvedValue(0)
  })

  it("menyaring kondisi dengan memeriksa kondisiRevisi dan kondisi asli", async () => {
    await daftarLaporanHarian({
      page: 1,
      pageSize: 20,
      sortDir: "desc",
      periode: 202608,
      kondisi: "MB",
    })

    expect(mocks.prisma.laporanHarianPetugas.findMany).toHaveBeenCalledTimes(1)
    const callArgs = mocks.prisma.laporanHarianPetugas.findMany.mock.calls[0][0]
    expect(callArgs.where.kondisi).toBeUndefined()
    expect(callArgs.where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { kondisiRevisi: "MB" },
            { kondisiRevisi: null, kondisi: "MB" },
          ],
        },
      ])
    )
  })

  it("menyaring statusVerif MENUNGGU, MENUNGGU_V1 dan MENUNGGU_V2 untuk antrean kerja berjenjang", async () => {
    await daftarLaporanHarian({
      page: 1,
      pageSize: 20,
      sortDir: "desc",
      periode: 202608,
      statusVerif: "MENUNGGU",
    })

    let callArgs = mocks.prisma.laporanHarianPetugas.findMany.mock.calls[0][0]
    expect(callArgs.where.verif1At).toBeNull()
    expect(callArgs.where.verifiedAt).toBeNull()
    expect(callArgs.where.isVerified).toBe(false)

    mocks.prisma.laporanHarianPetugas.findMany.mockClear()

    await daftarLaporanHarian({
      page: 1,
      pageSize: 20,
      sortDir: "desc",
      periode: 202608,
      statusVerif: "MENUNGGU_V2",
    })

    callArgs = mocks.prisma.laporanHarianPetugas.findMany.mock.calls[0][0]
    expect(callArgs.where.verif1At).toEqual({ not: null })
    expect(callArgs.where.verif2At).toBeNull()
    expect(callArgs.where.isVerified).toBe(false)
  })
})
