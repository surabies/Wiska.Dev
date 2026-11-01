import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const aktor = { id: "staff-1", role: "STAFF" }
  const tx = {
    periodePenagihan: { findUnique: vi.fn() },
    daftarCatat: { findFirst: vi.fn() },
    pelanggan: { findUnique: vi.fn() },
    laporanMandiri: {
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    laporanHarianPetugas: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    meter: { findMany: vi.fn() },
    pembacaanMeter: { findFirst: vi.fn(), delete: vi.fn() },
  }
  const prisma = {
    laporanMandiri: { findUnique: vi.fn() },
    pembacaanMeter: { create: vi.fn() },
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
    ),
  }

  return { aktor, prisma, tx, recordAudit: vi.fn() }
})

vi.mock("@db", () => ({
  JenisInputLaporanHarian: { KONSUMEN: "KONSUMEN" },
  StatusLaporanMandiri: ["MENUNGGU", "DIVERIFIKASI", "DITOLAK", "DIGUNAKAN"],
  prisma: mocks.prisma,
}))
vi.mock("../../lib/Audit", () => ({
  auditMetaFromRequest: () => ({ ipAddress: null, userAgent: null }),
  recordAudit: mocks.recordAudit,
}))
vi.mock("../../lib/Sesi", () => ({
  getSessionUser: () => mocks.aktor,
}))
vi.mock("../../middleware/RBAC", () => ({
  ROLE_GROUPS: {
    STAFF_UP: [
      "SUPER_ADMIN",
      "DIREKSI",
      "SENIOR_MANAGER",
      "MANAGER",
      "SUPERVISOR",
      "STAFF",
    ],
    SENIOR_UP: ["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER"],
  },
  requireRole:
    (..._roles: unknown[]) =>
    async (_context: unknown, next: () => Promise<void>) => {
      await next()
    },
}))

import { laporanMandiriRouter } from "./LaporanMandiri.router"

describe("PATCH /:id/verify laporan mandiri", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.aktor.id = "staff-1"
    mocks.aktor.role = "STAFF"
    mocks.prisma.laporanMandiri.findUnique.mockResolvedValue({
      id: "laporan-1",
      status: "MENUNGGU",
      standDilaporkan: 123,
      pelangganId: "pelanggan-1",
      nomorLangganan: "001",
      periode: 202611,
      fotoUrl: "https://foto.example/meter.jpg",
      createdAt: new Date("2026-11-01T00:00:00.000Z"),
      pelanggan: { nama: "Pelanggan", alamat: "Alamat" },
    })
    mocks.tx.periodePenagihan.findUnique.mockResolvedValue(null)
    mocks.tx.laporanHarianPetugas.findUnique.mockResolvedValue(null)
    mocks.tx.daftarCatat.findFirst.mockResolvedValue({
      pencatatId: "pencatat-1",
    })
    mocks.tx.meter.findMany.mockResolvedValue([])
    mocks.tx.pembacaanMeter.findFirst.mockResolvedValue(null)
    mocks.tx.laporanHarianPetugas.create.mockResolvedValue({
      id: "petugas-1",
    })
    mocks.tx.laporanHarianPetugas.findUniqueOrThrow.mockResolvedValue({
      id: "petugas-1",
    })
    mocks.tx.laporanHarianPetugas.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.laporanMandiri.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.laporanMandiri.findUniqueOrThrow.mockResolvedValue({
      id: "laporan-1",
      status: "DIVERIFIKASI",
      standDilaporkan: 125,
    })
  })

  it("menyinkronkan koreksi ke antrean Petugas tanpa menerbitkan pembacaan resmi", async () => {
    const response = await laporanMandiriRouter.request("/laporan-1/verify", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ standDilaporkan: 125 }),
    })

    expect(response.status).toBe(200)
    expect(mocks.tx.laporanMandiri.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "laporan-1", status: "MENUNGGU" },
        data: expect.objectContaining({
          status: "DIVERIFIKASI",
          standDilaporkan: 125,
          verifiedById: "staff-1",
        }),
      })
    )
    expect(mocks.prisma.pembacaanMeter.create).not.toHaveBeenCalled()
    expect(mocks.tx.laporanHarianPetugas.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nomorLangganan: "001",
          pelangganId: "pelanggan-1",
          standAkhir: 125,
          jenisInput: "KONSUMEN",
          pencatatId: "pencatat-1",
          fotoStandUrl: "https://foto.example/meter.jpg",
          verif1At: null,
          verif2At: null,
          verif3At: null,
        }),
      })
    )
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        aksi: "VERIFIKASI_LAPORAN_MANDIRI",
        perubahan: expect.objectContaining({
          sebelum: { status: "MENUNGGU", standDilaporkan: 123 },
          sesudah: { status: "DIVERIFIKASI", standDilaporkan: 125 },
        }),
      })
    )
  })

  it("mengambil petugas dari penugasan rute jika snapshot daftar catat belum tersedia", async () => {
    mocks.tx.daftarCatat.findFirst.mockResolvedValue(null)
    mocks.tx.pelanggan.findUnique.mockResolvedValue({
      rute: {
        penugasanRute: [{ pencatatId: "pencatat-rute-1" }],
      },
    })

    const response = await laporanMandiriRouter.request("/laporan-1/verify", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ standDilaporkan: 125 }),
    })

    expect(response.status).toBe(200)
    expect(mocks.tx.laporanHarianPetugas.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jenisInput: "KONSUMEN",
          pencatatId: "pencatat-rute-1",
        }),
      })
    )
    expect(mocks.tx.pelanggan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pelanggan-1" },
        select: {
          rute: {
            select: {
              penugasanRute: {
                orderBy: { urutan: "asc" },
                take: 1,
                select: { pencatatId: true },
              },
            },
          },
        },
      })
    )
  })

  it("mengizinkan role V3 mengganti verifikasi lama dan mengembalikan baris Petugas ke antrean", async () => {
    mocks.aktor.role = "SENIOR_MANAGER"
    const verif1At = new Date("2026-10-25T00:00:00.000Z")
    mocks.tx.laporanHarianPetugas.findUnique.mockResolvedValue({
      id: "petugas-1",
      standAwal: 100,
      standAkhir: 123,
      pemakaian: 23,
      pemakaianLalu: 20,
      verif1At,
      verif2At: null,
      verif3At: null,
      isVerified: false,
      pembacaanId: null,
      pembacaan: null,
    })
    mocks.tx.laporanHarianPetugas.findUniqueOrThrow.mockResolvedValue({
      id: "petugas-1",
    })

    const response = await laporanMandiriRouter.request("/laporan-1/verify", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ standDilaporkan: 125 }),
    })

    expect(response.status).toBe(200)
    expect(mocks.tx.laporanHarianPetugas.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "petugas-1",
          verif1At,
        }),
        data: expect.objectContaining({
          standAkhir: 125,
          pemakaian: 25,
          verif1At: null,
          verif2At: null,
          verif3At: null,
          isVerified: false,
        }),
      })
    )
    expect(mocks.tx.laporanHarianPetugas.create).not.toHaveBeenCalled()
  })

  it("menolak role di bawah V3 untuk menimpa tahap Petugas yang sudah ada", async () => {
    mocks.tx.laporanHarianPetugas.findUnique.mockResolvedValue({
      id: "petugas-1",
      standAwal: 100,
      standAkhir: 123,
      pemakaian: 23,
      verif1At: new Date("2026-10-25T00:00:00.000Z"),
      verif2At: null,
      verif3At: null,
      isVerified: false,
      pembacaanId: null,
      pembacaan: null,
    })

    const response = await laporanMandiriRouter.request("/laporan-1/verify", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ standDilaporkan: 125 }),
    })

    expect(response.status).toBe(500)
    expect(mocks.tx.laporanHarianPetugas.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.laporanMandiri.updateMany).not.toHaveBeenCalled()
  })

  it("menghapus pembacaan resmi yang belum ditagihkan saat mengembalikan baris ke antrean", async () => {
    mocks.aktor.role = "SENIOR_MANAGER"
    mocks.tx.laporanHarianPetugas.findUnique.mockResolvedValue({
      id: "petugas-1",
      standAwal: 100,
      standAkhir: 123,
      pemakaian: 23,
      verif1At: null,
      verif2At: null,
      verif3At: new Date("2026-10-30T00:00:00.000Z"),
      isVerified: true,
      pembacaanId: "pembacaan-1",
      pembacaan: { id: "pembacaan-1", tagihan: null },
    })

    const response = await laporanMandiriRouter.request("/laporan-1/verify", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ standDilaporkan: 125 }),
    })

    expect(response.status).toBe(200)
    expect(mocks.tx.pembacaanMeter.delete).toHaveBeenCalledWith({
      where: { id: "pembacaan-1" },
    })
  })

  it("tidak mengubah baris Petugas jika pembacaan resminya terkait tagihan", async () => {
    mocks.aktor.role = "SENIOR_MANAGER"
    mocks.tx.laporanHarianPetugas.findUnique.mockResolvedValue({
      id: "petugas-1",
      standAwal: 100,
      standAkhir: 123,
      pemakaian: 23,
      verif1At: null,
      verif2At: null,
      verif3At: new Date("2026-10-30T00:00:00.000Z"),
      isVerified: true,
      pembacaanId: "pembacaan-1",
      pembacaan: {
        id: "pembacaan-1",
        tagihan: { id: "tagihan-1" },
      },
    })

    const response = await laporanMandiriRouter.request("/laporan-1/verify", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ standDilaporkan: 125 }),
    })

    expect(response.status).toBe(500)
    expect(mocks.tx.laporanHarianPetugas.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.pembacaanMeter.delete).not.toHaveBeenCalled()
  })

  it("menolak sinkronisasi setelah periode dikunci", async () => {
    mocks.tx.periodePenagihan.findUnique.mockResolvedValue({
      status: "TERKUNCI",
    })

    const response = await laporanMandiriRouter.request("/laporan-1/verify", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ standDilaporkan: 125 }),
    })

    expect(response.status).toBe(500)
    expect(mocks.tx.laporanHarianPetugas.create).not.toHaveBeenCalled()
    expect(mocks.tx.laporanMandiri.updateMany).not.toHaveBeenCalled()
  })
})
