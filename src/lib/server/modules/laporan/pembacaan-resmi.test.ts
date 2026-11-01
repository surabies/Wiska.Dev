import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  tx: {
    periodePenagihan: { findUnique: vi.fn() },
    pembacaanMeter: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    laporanHarianPetugas: { findMany: vi.fn(), updateMany: vi.fn() },
    laporanMandiri: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}))

vi.mock("@db", () => ({
  prisma: { pembacaanMeter: { findMany: mocks.findMany } },
}))
vi.mock("../../lib/audit", () => ({ recordAudit: vi.fn() }))

import {
  ambilPemakaianPeriodeSebelumnya,
  simpanPembacaanResmi,
} from "./pembacaan-resmi"
import { recordAudit } from "../../lib/audit"

describe("ambilPemakaianPeriodeSebelumnya", () => {
  beforeEach(() => {
    mocks.findMany.mockReset()
    vi.clearAllMocks()
  })

  it("mengambil pemakaianM3 dari bulan kalender sebelumnya per pelanggan", async () => {
    mocks.findMany.mockResolvedValue([
      { pemakaianM3: 14, meter: { pelangganId: "pelanggan-1" } },
    ])

    const hasil = await ambilPemakaianPeriodeSebelumnya([
      { pelangganId: "pelanggan-1", periode: 202601 },
    ])

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periode: new Date("2025-12-01T00:00:00.000Z"),
        }),
      }),
    )
    expect(hasil.get("202601:pelanggan-1")).toBe(14)
  })

  it("melewati laporan tanpa pelanggan tertaut", async () => {
    const hasil = await ambilPemakaianPeriodeSebelumnya([
      { pelangganId: null, periode: 202601 },
    ])

    expect(mocks.findMany).not.toHaveBeenCalled()
    expect(hasil.size).toBe(0)
  })
})

describe("simpanPembacaanResmi", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tx.periodePenagihan.findUnique.mockResolvedValue(null)
    mocks.tx.pembacaanMeter.findMany.mockResolvedValue([
      {
        id: "pembacaan-lama",
        meterId: "meter-1",
        standLalu: 95,
        standAkhir: 100,
        pemakaianM3: 5,
        pemakaianRiil: 5,
        alasanTaksir: null,
        blokTarif: 1,
        pemakaianLalu: null,
        blokTarifLalu: null,
        kondisi: "NORMAL",
        kategori: "ONSITE",
        pencatatId: null,
        tanggalCatat: new Date("2026-10-15T00:00:00.000Z"),
        fotoBukti: "old-photo",
        tagihan: null,
      },
    ])
    mocks.tx.pembacaanMeter.update.mockResolvedValue({ id: "pembacaan-lama" })
    mocks.tx.pembacaanMeter.create.mockResolvedValue({ id: "pembacaan-baru" })
    mocks.tx.pembacaanMeter.deleteMany.mockResolvedValue({ count: 0 })
    mocks.tx.laporanHarianPetugas.findMany.mockResolvedValue([
      {
        id: "manual-add",
        pelangganId: null,
        nomorLangganan: "00900300100",
        isVerified: true,
        verifiedAt: new Date("2026-10-20T00:00:00.000Z"),
        verifiedById: "senior-lama",
        verif1At: new Date("2026-10-18T00:00:00.000Z"),
        verif1ById: "supervisor",
        verif2At: new Date("2026-10-19T00:00:00.000Z"),
        verif2ById: "manager",
        verif3At: new Date("2026-10-20T00:00:00.000Z"),
        verif3ById: "senior-lama",
        pembacaanId: "pembacaan-lama",
      },
    ])
    mocks.tx.laporanHarianPetugas.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.laporanMandiri.findMany.mockResolvedValue([
      {
        id: "laporan-mandiri-lama",
        status: "DIGUNAKAN",
        verifiedAt: new Date("2026-10-21T00:00:00.000Z"),
        verifiedById: "senior-lama",
        pembacaanId: "pembacaan-lama",
      },
    ])
    mocks.tx.laporanMandiri.updateMany.mockResolvedValue({ count: 1 })
  })

  it("replaces the official reading and returns superseded reports to pending", async () => {
    await simpanPembacaanResmi(mocks.tx as never, {
      pelangganId: "pelanggan-1",
      nomorLangganan: "00900300100",
      meterId: "meter-1",
      periode: 202610,
      sumber: "KONSUMEN",
      laporanId: "laporan-mandiri-baru",
      aktor: {
        userId: "verifikator-baru",
        ipAddress: null,
        userAgent: null,
      },
      data: {
        standLalu: 100,
        standAkhir: 109,
        pemakaianM3: 9,
        pemakaianRiil: 9,
        blokTarif: 1,
        kategori: "OFFSITE",
      },
    })

    expect(mocks.tx.pembacaanMeter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pembacaan-lama" },
        data: expect.objectContaining({
          standAkhir: 109,
          pemakaianM3: 9,
        }),
      }),
    )
    expect(mocks.tx.laporanHarianPetugas.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["manual-add"] } },
        data: expect.objectContaining({
          pelangganId: "pelanggan-1",
          isVerified: false,
          verifiedAt: null,
          verif1At: null,
          verif2At: null,
          verif3At: null,
          pembacaanId: null,
          pemakaianTagihVerif: null,
          standAkhirRevisi: null,
        }),
      }),
    )
    expect(mocks.tx.laporanHarianPetugas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              OR: [
                { pelangganId: "pelanggan-1" },
                { pelangganId: null, nomorLangganan: "00900300100" },
              ],
            },
          ]),
        }),
      }),
    )
    expect(mocks.tx.laporanMandiri.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["laporan-mandiri-lama"] } },
        data: expect.objectContaining({
          status: "MENUNGGU",
          verifiedAt: null,
          pembacaanId: null,
        }),
      }),
    )
    expect(recordAudit).toHaveBeenCalledTimes(3)
    expect(recordAudit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        aksi: "PEMBACAAN_RESMI_DIGANTI",
        entitas: "PembacaanMeter",
        entitasId: "pembacaan-lama",
        perubahan: expect.objectContaining({
          sebelum: expect.objectContaining({
            standAkhir: 100,
            pemakaianM3: 5,
            fotoBukti: "old-photo",
          }),
          sesudah: expect.objectContaining({
            standAkhir: 109,
            pemakaianM3: 9,
          }),
        }),
      }),
    )
    expect(recordAudit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        aksi: "HASIL_RESMI_DIGANTI_KEMBALI_ANTREAN",
        entitasId: "manual-add",
      }),
    )
  })

  it("does not replace a reading from a locked period", async () => {
    mocks.tx.periodePenagihan.findUnique.mockResolvedValue({
      status: "TERKUNCI",
    })

    await expect(
      simpanPembacaanResmi(mocks.tx as never, {
        pelangganId: "pelanggan-1",
        nomorLangganan: "00900300100",
        meterId: "meter-1",
        periode: 202610,
        sumber: "KONSUMEN",
        laporanId: "laporan-mandiri-baru",
        aktor: {
          userId: "verifikator-baru",
          ipAddress: null,
          userAgent: null,
        },
        data: {
          standLalu: 100,
          standAkhir: 109,
          pemakaianM3: 9,
          pemakaianRiil: 9,
          blokTarif: 1,
          kategori: "OFFSITE",
        },
      }),
    ).rejects.toThrow("Periode sudah ditutup")

    expect(mocks.tx.pembacaanMeter.update).not.toHaveBeenCalled()
    expect(mocks.tx.laporanHarianPetugas.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.laporanMandiri.updateMany).not.toHaveBeenCalled()
  })

  it("does not replace a reading already used by a bill", async () => {
    mocks.tx.pembacaanMeter.findMany.mockResolvedValue([
      {
        id: "pembacaan-lama",
        meterId: "meter-1",
        tagihan: { id: "tagihan-1" },
      },
    ])

    await expect(
      simpanPembacaanResmi(mocks.tx as never, {
        pelangganId: "pelanggan-1",
        nomorLangganan: "00900300100",
        meterId: "meter-1",
        periode: 202610,
        sumber: "KONSUMEN",
        laporanId: "laporan-mandiri-baru",
        aktor: {
          userId: "verifikator-baru",
          ipAddress: null,
          userAgent: null,
        },
        data: {
          standLalu: 100,
          standAkhir: 109,
          pemakaianM3: 9,
          pemakaianRiil: 9,
          blokTarif: 1,
          kategori: "OFFSITE",
        },
      }),
    ).rejects.toThrow("sudah digunakan tagihan")

    expect(mocks.tx.pembacaanMeter.update).not.toHaveBeenCalled()
    expect(mocks.tx.laporanHarianPetugas.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.laporanMandiri.updateMany).not.toHaveBeenCalled()
  })
})
