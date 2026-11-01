import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  prisma: {
    penugasanRute: { findMany: vi.fn() },
    daftarCatat: { groupBy: vi.fn() },
  },
}))

vi.mock("@db", () => ({ prisma: mocks.prisma }))
vi.mock("../../middleware/rbac", () => ({
  ROLE_GROUPS: { STAFF_UP: [], SUPERVISOR_UP: [] },
  requireRole: vi.fn(() => async (_context: unknown, next: () => Promise<void>) => {
    await next()
  }),
}))
vi.mock("../notifikasi/notifier", () => ({ getNotifier: vi.fn() }))

import { penugasanRuteRouter } from "./penugasan-rute.router"

describe("GET /opsi-filter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("mengambil relasi Petugas-Rute dari daftar catat periode yang dipilih", async () => {
    const pasangan = [
      { pencatatId: "dani", ruteId: "rute-dani-1" },
      { pencatatId: "dani", ruteId: "rute-dani-2" },
    ]
    mocks.prisma.daftarCatat.groupBy.mockResolvedValue(pasangan)

    const response = await penugasanRuteRouter.request(
      "/opsi-filter?periode=202611",
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: pasangan,
    })
    expect(mocks.prisma.daftarCatat.groupBy).toHaveBeenCalledWith({
      by: ["pencatatId", "ruteId"],
      where: {
        periode: 202611,
        pencatatId: { not: null },
        ruteId: { not: null },
      },
    })
    expect(mocks.prisma.penugasanRute.findMany).not.toHaveBeenCalled()
  })

  it("memakai penugasan permanen saat filter Semua Periode", async () => {
    const pasangan = [{ pencatatId: "dani", ruteId: "rute-dani-1" }]
    mocks.prisma.penugasanRute.findMany.mockResolvedValue(pasangan)

    const response = await penugasanRuteRouter.request("/opsi-filter")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: pasangan,
    })
    expect(mocks.prisma.daftarCatat.groupBy).not.toHaveBeenCalled()
  })
})
