import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const tx = {
    laporanHarianPetugas: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    daftarCatat: {
      updateMany: vi.fn(),
    },
    pembacaanMeter: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  }
  const prisma = {
    laporanHarianPetugas: {
      findUnique: vi.fn(),
    },
    periodePenagihan: {
      findUnique: vi.fn(),
    },
    tagihan: {
      findUnique: vi.fn(),
    },
    meter: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(
      async (cb: (transaction: typeof tx) => Promise<unknown>) => cb(tx)
    ),
  }
  return {
    prisma,
    tx,
    recordAudit: vi.fn(),
    simpanPembacaanResmi: vi.fn(),
  }
})

vi.mock("@db", () => ({
  JenisInputLaporanHarian: {
    PETUGAS: "PETUGAS",
    KONSUMEN: "KONSUMEN",
    MANUAL_SATUAN: "MANUAL_SATUAN",
    MANUAL_MASSAL: "MANUAL_MASSAL",
  },
  KondisiCatat: {
    NORMAL: "NORMAL",
    MB: "MB",
    REV_PENCATAT: "REV_PENCATAT",
  },
  KategoriPembacaan: {
    ONSITE: "ONSITE",
    OFFSITE: "OFFSITE",
  },
  prisma: mocks.prisma,
}))
vi.mock("../../../lib/Penyimpanan", () => ({
  simpanBerkas: vi.fn(),
  BerkasTidakValidError: class extends Error {},
}))
vi.mock("../../../lib/Audit", () => ({
  recordAudit: mocks.recordAudit,
}))
vi.mock("../bersama/PembacaanResmi.service", () => ({
  simpanPembacaanResmi: mocks.simpanPembacaanResmi,
}))

import {
  uraiCsv,
  ringkasImpor,
  POLA_FOTO,
  type BarisHasil,
} from "./LaporanHarianImpor.service"
import { tanggalPeriode } from "./LaporanHarianPantau.service"
import { akhirBulanPeriode } from "./LaporanHarianSimpan.service"
import {
  validasiStandAngkat,
  koreksiDari,
  verifikasiV3LaporanHarian,
} from "./LaporanHarianVerifikasi.service"
import {
  koreksiLaporanHarian,
  batalkanVerifikasiLaporanHarian,
} from "./LaporanHarianKoreksi.service"

describe("uraiCsv", () => {
  it("mengurai baris CSV sederhana dan mengabaikan baris kosong", () => {
    const csv =
      "nomorLangganan,standAwal,standAkhir\n01001000001,10,25\n\n   \n"
    expect(uraiCsv(csv)).toEqual([
      ["nomorLangganan", "standAwal", "standAkhir"],
      ["01001000001", "10", "25"],
    ])
  })

  it("menangani kutip ganda, koma di dalam kutip, kutip ter-escape, dan CRLF", () => {
    const csv =
      "nomorLangganan,alamatPelanggan,usulanPerubahan\r\n" +
      '"01001000002","Jl. Merdeka, No. 10","Meter ""buram"", perlu ganti"\r\n'
    expect(uraiCsv(csv)).toEqual([
      ["nomorLangganan", "alamatPelanggan", "usulanPerubahan"],
      ["01001000002", "Jl. Merdeka, No. 10", 'Meter "buram", perlu ganti'],
    ])
  })
})

describe("ringkasImpor & POLA_FOTO", () => {
  it("menghitung ringkasan status impor dengan tepat", () => {
    const baris: BarisHasil[] = [
      {
        index: 0,
        jenis: "catatan",
        nomorLangganan: "01001000001",
        periode: 202607,
        status: "TERSIMPAN",
        id: "id-1",
      },
      {
        index: 1,
        jenis: "catatan",
        nomorLangganan: "01001000002",
        periode: 202607,
        status: "DUPLIKAT",
      },
      {
        index: 2,
        jenis: "stand",
        nomorLangganan: "01001000001",
        periode: 202607,
        status: "DILAMPIRKAN",
      },
      {
        index: 3,
        jenis: "stand",
        nomorLangganan: "01001000003",
        periode: 202607,
        status: "TANPA_PENCATATAN",
      },
      {
        index: 4,
        jenis: "stand",
        nomorLangganan: "?",
        periode: 202607,
        status: "GAGAL",
      },
    ]

    expect(ringkasImpor(baris)).toEqual({
      total: 5,
      tersimpan: 1,
      duplikat: 1,
      dilampirkan: 1,
      tanpaPencatatan: 1,
      gagal: 1,
      hasil: baris,
    })
  })

  it("mencocokkan nama berkas foto/video sesuai pola periode_tipe_nomor.ext", () => {
    const cocok = POLA_FOTO.exec("backup/202607_stand_01001000001.jpg")
    expect(cocok?.[1]).toBe("202607")
    expect(cocok?.[2]).toBe("stand")
    expect(cocok?.[3]).toBe("01001000001")
    expect(cocok?.[4]).toBe("jpg")

    expect(POLA_FOTO.exec("acak_nama.jpg")).toBeNull()
  })
})

describe("helper tanggal & verifikasi LaporanHarian", () => {
  it("tanggalPeriode menghasilkan daftar tanggal sampai batas", () => {
    expect(tanggalPeriode(202602, "2026-02-03")).toEqual([
      "2026-02-01",
      "2026-02-02",
      "2026-02-03",
    ])
  })

  it("akhirBulanPeriode mengembalikan tanggal terakhir bulan dalam UTC", () => {
    expect(akhirBulanPeriode(202602).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z"
    )
  })

  it("validasiStandAngkat mewajibkan stand angkat hanya untuk kondisi MB", () => {
    expect(validasiStandAngkat("NORMAL", null, null)).toBeNull()
    expect(validasiStandAngkat("MB", 120, 5)).toEqual({
      standAngkatLama: 120,
      standMeterBaru: 5,
    })
    expect(() => validasiStandAngkat("MB", 120, null)).toThrow(
      /Kondisi MB memerlukan/
    )
  })

  it("koreksiDari hanya menyertakan properti yang dikirim eksplisit dan memetakan kondisi ke kondisiRevisi", () => {
    expect(
      koreksiDari({
        meterId: "m-1",
        standAkhirRevisi: 42,
        kondisi: "MB",
        pemakaianTagih: 15,
      })
    ).toEqual({
      meterVerifId: "m-1",
      standAkhirRevisi: 42,
      kondisiRevisi: "MB",
      pemakaianTagihVerif: 15,
    })
  })
})

describe("alur bisnis verifikasi, koreksi, dan unverify LaporanHarian", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.periodePenagihan.findUnique.mockResolvedValue(null)
    mocks.prisma.tagihan.findUnique.mockResolvedValue(null)
    mocks.tx.laporanHarianPetugas.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.laporanHarianPetugas.findUniqueOrThrow.mockResolvedValue({
      id: "lap-1",
    })
  })

  it("menolak V1 (SUPERVISOR) membatalkan V1 miliknya sendiri dan mengizinkan V2 (MANAGER)", async () => {
    mocks.prisma.laporanHarianPetugas.findUnique.mockResolvedValue({
      id: "lap-1",
      periode: 202611,
      verif1At: new Date("2026-11-01T10:00:00Z"),
      verif1ById: "spv-1",
      verif2At: null,
      verif3At: null,
      pembacaanId: null,
      isVerified: false,
    })

    await expect(
      batalkanVerifikasiLaporanHarian("lap-1", {
        id: "spv-1",
        role: "SUPERVISOR",
        email: "spv@example.com",
        name: "SPV",
        divisiKode: null,
        subBagianKode: null,
      })
    ).rejects.toThrow(/Membatalkan V1 memerlukan Manager ke atas/)

    await batalkanVerifikasiLaporanHarian("lap-1", {
      id: "mgr-1",
      role: "MANAGER",
      email: "mgr@example.com",
      name: "Manager",
      divisiKode: null,
      subBagianKode: null,
    })
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        aksi: "BATALKAN_VERIFIKASI_V1_LAPORAN_PETUGAS",
        entitasId: "lap-1",
      })
    )
  })

  it("menolak V2 (MANAGER) membatalkan V2 miliknya sendiri dan mengizinkan V3 (SENIOR_MANAGER)", async () => {
    mocks.prisma.laporanHarianPetugas.findUnique.mockResolvedValue({
      id: "lap-1",
      periode: 202611,
      verif1At: new Date("2026-11-01T10:00:00Z"),
      verif2At: new Date("2026-11-01T11:00:00Z"),
      verif2ById: "mgr-1",
      verif3At: null,
      pembacaanId: null,
      isVerified: false,
    })

    await expect(
      batalkanVerifikasiLaporanHarian("lap-1", {
        id: "mgr-1",
        role: "MANAGER",
        email: "mgr@example.com",
        name: "Manager",
        divisiKode: null,
        subBagianKode: null,
      })
    ).rejects.toThrow(/Membatalkan V2 memerlukan Senior Manager ke atas/)

    await batalkanVerifikasiLaporanHarian("lap-1", {
      id: "sr-1",
      role: "SENIOR_MANAGER",
      email: "sr@example.com",
      name: "Senior",
      divisiKode: null,
      subBagianKode: null,
    })
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        aksi: "BATALKAN_VERIFIKASI_V2_LAPORAN_PETUGAS",
        entitasId: "lap-1",
      })
    )
  })

  it("meneruskan pemakaianTagih override pada verifikasiV3LaporanHarian ke simpanPembacaanResmi", async () => {
    mocks.prisma.laporanHarianPetugas.findUnique.mockResolvedValue({
      id: "lap-1",
      pelangganId: "pel-1",
      nomorLangganan: "01001000001",
      periode: 202611,
      meterVerifId: "meter-1",
      standAwal: 100,
      standAkhir: 112,
      pemakaian: 12,
      pemakaianLalu: 10,
      kondisi: "NORMAL",
      kondisiRevisi: null,
      kategori: "ONSITE",
      jenisInput: "PETUGAS",
      pencatatId: "pencatat-1",
      tanggalCatat: new Date("2026-11-01T08:00:00Z"),
      fotoStandUrl: null,
      pembacaanId: null,
    })
    mocks.simpanPembacaanResmi.mockResolvedValue({ id: "baca-1" })
    mocks.tx.laporanHarianPetugas.update.mockResolvedValue({
      id: "lap-1",
      pembacaanId: "baca-1",
    })

    await verifikasiV3LaporanHarian(
      "lap-1",
      { pemakaianTagih: 20 },
      {
        id: "sr-1",
        role: "SENIOR_MANAGER",
        email: "sr@example.com",
        name: "Senior",
        divisiKode: null,
        subBagianKode: null,
      },
      { ipAddress: null, userAgent: null }
    )

    expect(mocks.simpanPembacaanResmi).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        data: expect.objectContaining({
          standLalu: 100,
          standAkhir: 112,
          pemakaianM3: 20,
          pemakaianRiil: 12,
          alasanTaksir: "OVERRIDE_MANUAL",
        }),
      })
    )
  })

  it("menolak koreksi langsung atas hasil V3 resmi aktif sebelum reopen (DEC-06)", async () => {
    mocks.prisma.laporanHarianPetugas.findUnique.mockResolvedValue({
      id: "lap-1",
      periode: 202611,
      verif3At: new Date("2026-11-01T12:00:00Z"),
      pembacaanId: "baca-1",
      isVerified: true,
    })

    await expect(
      koreksiLaporanHarian(
        "lap-1",
        { standAkhirRevisi: 115 },
        {
          id: "staff-1",
          role: "STAFF",
          email: "staff@example.com",
          name: "Staff",
          divisiKode: null,
          subBagianKode: null,
        },
        { ipAddress: null, userAgent: null }
      )
    ).rejects.toThrow(/Batalkan V3 \(reopen\) terlebih dahulu/)
  })
})
