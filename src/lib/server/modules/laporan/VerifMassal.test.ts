import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  })

  const tx = {
    laporanHarianPetugas: model(),
    laporanMandiri: model(),
    pembacaanMeter: model(),
    daftarCatat: model(),
    periodePenagihan: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  }

  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      laporanHarianPetugas: model(),
      meter: model(),
    },
  }
})

vi.mock("@db", () => ({ prisma: mocks.prisma }))
vi.mock("../../lib/Audit", () => ({ recordAudit: vi.fn() }))

import { verifikasiMassal } from "./VerifMassal"
import { recordAudit } from "../../lib/Audit"

function laporan(overrides: Record<string, unknown> = {}) {
  return {
    id: "laporan-1",
    nomorLangganan: "100001",
    pelangganId: "pelanggan-1",
    periode: 202610,
    standAwal: 12,
    standAkhir: 20,
    standAkhirRevisi: null,
    pemakaian: 8,
    pemakaianLalu: 6,
    pemakaianTagihVerif: null,
    blokTarifVerif: 1,
    kondisi: "NORMAL",
    kategori: "ONSITE",
    pencatatId: "petugas-1",
    tanggalCatat: new Date("2026-10-10T00:00:00.000Z"),
    fotoStandUrl: null,
    persentase: 0,
    jenisInput: "PETUGAS",
    verif1At: null,
    verif2At: null,
    verif3At: null,
    meterVerifId: null,
    pembacaanId: null,
    ...overrides,
  }
}

describe("verifikasi massal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.laporanHarianPetugas.findMany.mockResolvedValue([laporan()])
    mocks.prisma.meter.findMany.mockResolvedValue([
      { id: "meter-1", pelangganId: "pelanggan-1", isAktif: true },
    ])
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (client: typeof mocks.tx) => Promise<unknown>) =>
        callback(mocks.tx)
    )
    mocks.tx.laporanHarianPetugas.update.mockResolvedValue({})
    mocks.tx.laporanHarianPetugas.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.laporanHarianPetugas.findMany.mockResolvedValue([])
    mocks.tx.laporanMandiri.findMany.mockResolvedValue([])
    mocks.tx.laporanMandiri.updateMany.mockResolvedValue({ count: 0 })
    mocks.tx.periodePenagihan.findUnique.mockResolvedValue(null)
    mocks.tx.pembacaanMeter.findMany.mockResolvedValue([])
    mocks.tx.pembacaanMeter.create.mockResolvedValue({ id: "pembacaan-1" })
    mocks.tx.pembacaanMeter.deleteMany.mockResolvedValue({ count: 0 })
    mocks.tx.daftarCatat.updateMany.mockResolvedValue({ count: 1 })
  })

  it("menerima tindakan V2 meskipun V1 belum terisi", async () => {
    const hasil = await verifikasiMassal({
      ids: ["laporan-1"],
      ring: 2,
      userId: "manager-1",
      auditMeta: { ipAddress: null, userAgent: null },
      ambangAnomali: 100,
      sertakanAnomali: false,
    })

    expect(hasil.berhasil).toBe(1)
    expect(hasil.dilewati).toBe(0)
    expect(mocks.tx.laporanHarianPetugas.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ verif2ById: "manager-1" }),
      })
    )
    expect(mocks.tx.pembacaanMeter.create).not.toHaveBeenCalled()
    expect(recordAudit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({ aksi: "VERIFIKASI_V2_MASSAL" })
    )
  })

  it("menerbitkan satu pembacaan resmi saat V3 dilakukan tanpa V1/V2", async () => {
    const hasil = await verifikasiMassal({
      ids: ["laporan-1"],
      ring: 3,
      userId: "senior-1",
      auditMeta: { ipAddress: null, userAgent: null },
      ambangAnomali: 100,
      sertakanAnomali: false,
    })

    expect(hasil.berhasil).toBe(1)
    expect(mocks.tx.laporanHarianPetugas.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ verif3At: null }),
        data: expect.objectContaining({
          verif3ById: "senior-1",
          meterVerifId: "meter-1",
        }),
      })
    )
    expect(mocks.tx.pembacaanMeter.create).toHaveBeenCalledTimes(1)
    expect(recordAudit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({ aksi: "VERIFIKASI_V3_MASSAL" })
    )
  })

  it("tidak menjadikan stand akhir lebih rendah sebagai pemakaian nol", async () => {
    mocks.prisma.laporanHarianPetugas.findMany.mockResolvedValue([
      laporan({ standAwal: 20, standAkhir: 10 }),
    ])

    const hasil = await verifikasiMassal({
      ids: ["laporan-1"],
      ring: 3,
      userId: "senior-1",
      auditMeta: { ipAddress: null, userAgent: null },
      ambangAnomali: 100,
      sertakanAnomali: false,
    })

    expect(hasil.dilewati).toBe(1)
    expect(hasil.masalah[0]?.pesan).toContain("Stand akhir lebih kecil")
    expect(mocks.tx.pembacaanMeter.create).not.toHaveBeenCalled()
  })

  it("menghentikan hasil resmi jika transisi V3 kalah oleh request bersamaan", async () => {
    mocks.tx.laporanHarianPetugas.updateMany.mockResolvedValue({ count: 0 })

    const hasil = await verifikasiMassal({
      ids: ["laporan-1"],
      ring: 3,
      userId: "senior-1",
      auditMeta: { ipAddress: null, userAgent: null },
      ambangAnomali: 100,
      sertakanAnomali: false,
    })

    expect(hasil.gagal).toBe(1)
    expect(mocks.tx.pembacaanMeter.create).not.toHaveBeenCalled()
  })
})
