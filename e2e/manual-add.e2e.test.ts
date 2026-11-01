import { beforeEach, describe, expect, it, vi } from "vitest"
import { Hono } from "hono"

const mocks = vi.hoisted(() => {
  const methods = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  })

  const tx = {
    periodePenagihan: { findUnique: vi.fn() },
    pelanggan: methods(),
    laporanHarianPetugas: methods(),
    pembacaanMeter: methods(),
    tagihan: methods(),
    daftarCatat: methods(),
    meter: methods(),
    auditLog: { createMany: vi.fn() },
  }

  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      pelanggan: methods(),
      pembacaanMeter: methods(),
      tagihan: methods(),
      laporanHarianPetugas: methods(),
    },
    recordAudit: vi.fn(),
  }
})

vi.mock("@db", () => ({
  prisma: mocks.prisma,
  Prisma: { DbNull: Symbol.for("Prisma.DbNull") },
  JenisInputLaporanHarian: {
    MANUAL_SATUAN: "MANUAL_SATUAN",
    MANUAL_MASSAL: "MANUAL_MASSAL",
  },
  KategoriPembacaan: { OFFSITE: "OFFSITE" },
  KondisiCatat: { NORMAL: "NORMAL" },
  StatusDaftarCatat: {
    BELUM_DICATAT: "BELUM_DICATAT",
    DICATAT: "DICATAT",
    TIDAK_TERCATAT: "TIDAK_TERCATAT",
    DICABUT: "DICABUT",
  },
}))

vi.mock("../src/lib/server/lib/Audit", () => ({
  auditMetaFromRequest: vi.fn(() => ({
    ipAddress: null,
    userAgent: null,
  })),
  recordAudit: mocks.recordAudit,
}))

vi.mock("../src/lib/server/lib/Sesi", () => ({
  getSessionUser: vi.fn(() => ({
    id: "staff-test",
    name: "Staff Test",
    email: "staff@example.test",
    role: "STAFF",
    divisiKode: null,
    subBagianKode: null,
  })),
}))

vi.mock("../src/lib/server/middleware/RBAC", () => ({
  ROLE_GROUPS: { STAFF_UP: [] },
  requireRole: vi.fn(
    () => async (_context: unknown, next: () => Promise<void>) => {
      await next()
    }
  ),
}))

import { manualAddRouter } from "../src/lib/server/modules/laporan/ManualTambah.router"
import { errorHandler } from "../src/lib/server/lib/Galat"

const app = new Hono()
app.route("/", manualAddRouter)
app.onError(errorHandler)

const PERIODE = 202610
const PERIODE_DATE = new Date(Date.UTC(2026, 9, 1))

function pelangganAktif() {
  return {
    id: "pelanggan-1",
    nomorLangganan: "00000100001",
    nama: "Pelanggan Uji",
    alamat: "Jalan Uji",
    status: "AKTIF",
    meter: [
      {
        id: "meter-1",
        nomorMeter: "METER-1",
        pembacaan: [{ pemakaianRiil: 8 }],
      },
    ],
    daftarCatat: [{ id: "daftar-1", status: "DICATAT" }],
  }
}

function laporanTerverifikasi() {
  const verifiedAt = new Date(Date.UTC(2026, 9, 2))
  return {
    id: "laporan-lama",
    pelangganId: "pelanggan-1",
    nomorLangganan: "00000100001",
    standAwal: 110,
    standAkhir: 120,
    pemakaian: 10,
    pemakaianLalu: 8,
    persentase: 25,
    kondisi: "NORMAL",
    kategori: "ONSITE",
    jenisInput: "PETUGAS",
    alasanManual: null,
    manualProvenance: null,
    nomorMeter: "METER-1",
    tanggalCatat: verifiedAt,
    isVerified: true,
    verifiedAt,
    verifiedById: "verifikator-1",
    catatanVerif: null,
    pembacaanId: "bacaan-lama",
    pemakaianTagihVerif: null,
    blokTarifVerif: null,
    meterVerifId: null,
    standAkhirRevisi: null,
    standAwalRevisi: null,
    kondisiRevisi: null,
    verif1At: verifiedAt,
    verif1ById: "verifikator-1",
    verif2At: null,
    verif2ById: null,
    verif3At: null,
    verif3ById: null,
    pembacaan: {
      id: "bacaan-lama",
      standLalu: 110,
      standAkhir: 120,
      pemakaianM3: 10,
      pemakaianRiil: 10,
      alasanTaksir: null,
      blokTarif: 1,
      tagihan: null,
    },
  }
}

async function requestJson(
  path: string,
  method: "GET" | "POST",
  body?: unknown
) {
  const response = await app.request(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return {
    response,
    json: (await response.json()) as {
      success: boolean
      data: Record<string, unknown> | Record<string, unknown>[]
    },
  }
}

function transactionMock() {
  mocks.prisma.$transaction.mockImplementation(
    async (operation: (tx: typeof mocks.tx) => Promise<unknown>) =>
      operation(mocks.tx)
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  transactionMock()
  mocks.prisma.tagihan.findMany.mockResolvedValue([])
})

describe("Manual Add API end-to-end", () => {
  it("mencari nomor pelanggan secara exact, bukan prefix", async () => {
    mocks.prisma.pelanggan.findMany.mockResolvedValue([
      {
        id: "pelanggan-tepat",
        nomorLangganan: "00800600474",
        nama: "Pelanggan Tepat",
        alamat: "Jalan Uji",
        tarifGolongan: { kodeAsli: "R1" },
        meter: [],
      },
    ])
    mocks.prisma.tagihan.findMany.mockResolvedValue([
      { pelangganId: "pelanggan-tepat", pemakaianM3: 9 },
    ])
    mocks.prisma.pembacaanMeter.findMany.mockResolvedValue([])
    mocks.prisma.laporanHarianPetugas.findMany.mockResolvedValue([])

    const result = await requestJson(
      "/cari-pelanggan?nomor=00800600474&periode=202608",
      "GET"
    )

    expect(result.response.status).toBe(200)
    expect(result.json.data).toMatchObject([
      {
        id: "pelanggan-tepat",
        nomorLangganan: "00800600474",
        tarifGolongan: { kodeAsli: "R1" },
        pemakaianTerakhir: 9,
      },
    ])
    expect(mocks.prisma.pelanggan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          nomorLangganan: "00800600474",
          status: "AKTIF",
        },
      })
    )
  })

  it("menolak pencarian nomor pelanggan yang tidak lengkap", async () => {
    const result = await requestJson(
      "/cari-pelanggan?nomor=0080060047&periode=202608",
      "GET"
    )

    expect(result.response.status).toBe(422)
  })

  it("menolak tanggal pencatatan yang tidak valid", async () => {
    const result = await requestJson("/satuan", "POST", {
      pelangganId: "pelanggan-1",
      periode: PERIODE,
      tanggalCatat: "2026-02-31",
      standAwal: 120,
      standAkhir: 123,
      alasanManual: "Pencatatan berdasarkan hasil pembacaan meter.",
    })

    expect(result.response.status).toBe(422)
    const tanggalDiLuarPeriode = await requestJson("/satuan", "POST", {
      pelangganId: "pelanggan-1",
      periode: PERIODE,
      tanggalCatat: "2026-09-30",
      standAwal: 120,
      standAkhir: 123,
      alasanManual: "Pencatatan berdasarkan hasil pembacaan meter.",
    })
    expect(tanggalDiLuarPeriode.response.status).toBe(422)
    expect(mocks.prisma.pelanggan.findMany).not.toHaveBeenCalled()
  })

  it("mengizinkan penggantian laporan terverifikasi dan meresetnya ke antrean verifikasi", async () => {
    const reportBefore = laporanTerverifikasi()
    mocks.prisma.pelanggan.findMany.mockResolvedValue([
      {
        ...pelangganAktif(),
        meter: [
          {
            id: "meter-1",
            nomorMeter: "METER-1",
            pembacaan: [{ standAkhir: 120, pemakaianRiil: 10 }],
          },
        ],
      },
    ])
    mocks.prisma.pembacaanMeter.findMany.mockResolvedValue([
      {
        id: "bacaan-lama",
        meter: { pelangganId: "pelanggan-1" },
        tagihan: null,
      },
    ])
    mocks.prisma.laporanHarianPetugas.findMany.mockResolvedValue([
      {
        ...reportBefore,
        pembacaan: { id: "bacaan-lama", tagihan: null },
      },
    ])

    const lookup = await requestJson(
      `/cari-pelanggan?nomor=00000100001&periode=${PERIODE}`,
      "GET"
    )
    expect(lookup.response.status).toBe(200)
    expect(lookup.json.success).toBe(true)
    expect(lookup.json.data).toMatchObject([
      {
        standTerakhir: 120,
        sudahAdaLaporan: true,
        bolehTimpaLaporan: true,
      },
    ])

    mocks.tx.periodePenagihan.findUnique.mockResolvedValue({
      status: "TERBUKA",
    })
    mocks.tx.pelanggan.findUnique.mockResolvedValue(pelangganAktif())
    mocks.tx.laporanHarianPetugas.findFirst.mockResolvedValue(reportBefore)
    mocks.tx.tagihan.findFirst.mockResolvedValue({ pemakaianM3: 9 })
    mocks.tx.pembacaanMeter.findMany.mockResolvedValue([
      { id: "bacaan-lama", tagihan: null },
    ])
    let dataPengganti: Record<string, unknown> | undefined
    mocks.tx.laporanHarianPetugas.updateMany.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        dataPengganti = data
        return { count: 1 }
      }
    )
    mocks.tx.pembacaanMeter.delete.mockResolvedValue({ id: "bacaan-lama" })
    mocks.tx.laporanHarianPetugas.findUniqueOrThrow.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        ...reportBefore,
        ...dataPengganti,
        id: where.id,
      })
    )

    const replacement = await requestJson("/satuan", "POST", {
      pelangganId: "pelanggan-1",
      periode: PERIODE,
      tanggalCatat: "2026-10-15",
      standAwal: 120,
      standAkhir: 123,
      alasanManual: "Koreksi laporan setelah pemeriksaan.",
    })

    expect(replacement.response.status).toBe(201)
    expect(replacement.json.success).toBe(true)
    expect(dataPengganti).toMatchObject({
      standAwal: 120,
      standAkhir: 123,
      pemakaian: 3,
      pemakaianLalu: 9,
      tanggalCatat: new Date("2026-10-15T00:00:00.000Z"),
      jenisInput: "MANUAL_SATUAN",
      isVerified: false,
      verifiedAt: null,
      verifiedById: null,
      pembacaanId: null,
      verif1At: null,
      verif2At: null,
      verif3At: null,
    })
    expect(mocks.tx.pembacaanMeter.delete).toHaveBeenCalledWith({
      where: { id: "bacaan-lama" },
    })
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({ aksi: "MANUAL_ADD_SATUAN_REPLACE" })
    )
  })

  it("hanya menampilkan alamat belum tercatat dan menyimpan ST Awal/Akhir dari stand terakhir", async () => {
    const barisDaftar = [
      {
        id: "daftar-belum",
        pelangganId: "pelanggan-belum",
        pelanggan: {
          id: "pelanggan-belum",
          nomorLangganan: "100001",
          nama: "Belum Dilaporkan",
          alamat: "Jalan Belum",
          meter: [{ id: "meter-belum", nomorMeter: "METER-1" }],
        },
      },
      {
        id: "daftar-laporan",
        pelangganId: "pelanggan-laporan",
        pelanggan: {
          id: "pelanggan-laporan",
          nomorLangganan: "100002",
          nama: "Sudah Dilaporkan",
          alamat: "Jalan Laporan",
          meter: [{ id: "meter-laporan", nomorMeter: "METER-2" }],
        },
      },
      {
        id: "daftar-resmi",
        pelangganId: "pelanggan-resmi",
        pelanggan: {
          id: "pelanggan-resmi",
          nomorLangganan: "100003",
          nama: "Sudah Resmi",
          alamat: "Jalan Resmi",
          meter: [{ id: "meter-resmi", nomorMeter: "METER-3" }],
        },
      },
      {
        id: "daftar-tanpa-stand",
        pelangganId: "pelanggan-tanpa-stand",
        pelanggan: {
          id: "pelanggan-tanpa-stand",
          nomorLangganan: "100004",
          nama: "Tanpa Stand Resmi",
          alamat: "Jalan Tanpa Stand",
          meter: [{ id: "meter-tanpa-stand", nomorMeter: "METER-4" }],
        },
      },
      {
        id: "daftar-tanpa-meter",
        pelangganId: "pelanggan-tanpa-meter",
        pelanggan: {
          id: "pelanggan-tanpa-meter",
          nomorLangganan: "100005",
          nama: "Tanpa Meter Aktif",
          alamat: "Jalan Tanpa Meter",
          meter: [],
        },
      },
      {
        id: "daftar-histori",
        pelangganId: "pelanggan-histori",
        pelanggan: {
          id: "pelanggan-histori",
          nomorLangganan: "100006",
          nama: "Histori Tagihan",
          alamat: "Jalan Histori",
          meter: [{ id: "meter-histori", nomorMeter: "METER-6" }],
        },
      },
    ]
    let dataLaporanDibuat: Record<string, unknown>[] = []

    mocks.tx.periodePenagihan.findUnique.mockResolvedValue({
      status: "TERBUKA",
    })
    mocks.tx.daftarCatat.findMany.mockResolvedValue(barisDaftar)
    mocks.tx.laporanHarianPetugas.findMany.mockImplementation(
      async ({ where }: { where: { id?: { in: string[] } } }) => {
        if (where.id?.in) {
          return dataLaporanDibuat.filter((row) =>
            where.id!.in.includes(row.id as string)
          )
        }
        return [
          {
            pelangganId: "pelanggan-laporan",
            nomorLangganan: "100002",
          },
        ]
      }
    )
    mocks.tx.pembacaanMeter.findMany.mockImplementation(
      async ({
        where,
      }: {
        where: { periode: { lt?: Date }; meterId?: { in: string[] } }
      }) =>
        where.periode.lt
          ? where.meterId?.in.includes("meter-histori")
            ? [
                {
                  id: "riwayat-september",
                  meterId: "meter-histori",
                  periode: new Date(Date.UTC(2026, 8, 1)),
                  standLalu: 220,
                  pemakaianRiil: 10,
                },
                {
                  id: "riwayat-agustus",
                  meterId: "meter-histori",
                  periode: new Date(Date.UTC(2026, 7, 1)),
                  standLalu: 210,
                  pemakaianRiil: 10,
                },
                {
                  id: "riwayat-juli",
                  meterId: "meter-histori",
                  periode: new Date(Date.UTC(2026, 6, 1)),
                  standLalu: 200,
                  pemakaianRiil: 10,
                },
              ]
            : []
          : [{ meter: { pelangganId: "pelanggan-resmi" } }]
    )
    mocks.tx.tagihan.findMany.mockImplementation(
      async ({ where }: { where: { pelangganId: { in: string[] } } }) =>
        where.pelangganId.in.includes("pelanggan-histori")
          ? [
              {
                id: "tagihan-september",
                pelangganId: "pelanggan-histori",
                periode: new Date(Date.UTC(2026, 8, 1)),
                pemakaianM3: 10,
              },
              {
                id: "tagihan-agustus",
                pelangganId: "pelanggan-histori",
                periode: new Date(Date.UTC(2026, 7, 1)),
                pemakaianM3: 10,
              },
              {
                id: "tagihan-juli",
                pelangganId: "pelanggan-histori",
                periode: new Date(Date.UTC(2026, 6, 1)),
                pemakaianM3: 10,
              },
            ]
          : []
    )
    mocks.tx.meter.findMany.mockResolvedValue([
      {
        id: "meter-belum",
        pembacaan: [
          {
            id: "bacaan-terakhir",
            periode: new Date(Date.UTC(2026, 8, 1)),
            standAkhir: 125,
          },
        ],
      },
      { id: "meter-laporan", pembacaan: [] },
      { id: "meter-resmi", pembacaan: [] },
      { id: "meter-tanpa-stand", pembacaan: [] },
      {
        id: "meter-histori",
        pembacaan: [
          {
            id: "bacaan-histori-terakhir",
            periode: new Date(Date.UTC(2026, 8, 1)),
            standAkhir: 230,
          },
        ],
      },
    ])
    mocks.tx.laporanHarianPetugas.createMany.mockImplementation(
      async ({ data }: { data: Record<string, unknown>[] }) => {
        dataLaporanDibuat = data
        return { count: data.length }
      }
    )
    mocks.tx.daftarCatat.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.auditLog.createMany.mockResolvedValue({ count: 1 })

    const filter = `periode=${PERIODE}&ruteId=rute-1&pencatatId=petugas-1`
    const list = await requestJson(`/daftar?${filter}`, "GET")

    expect(list.response.status).toBe(200)
    expect(list.json.success).toBe(true)
    expect(list.json.data).toMatchObject([
      {
        daftarCatatId: "daftar-belum",
        taksasi: 5,
        metode: "TANPA_HISTORI",
        standTerakhir: 125,
        bolehDitambahkan: true,
      },
      {
        daftarCatatId: "daftar-tanpa-stand",
        taksasi: null,
        standTerakhir: null,
        bolehDitambahkan: false,
        alasanPeninjauan:
          "Stand resmi periode sebelumnya atau meter aktif belum tersedia.",
      },
      {
        daftarCatatId: "daftar-tanpa-meter",
        taksasi: null,
        standTerakhir: null,
        bolehDitambahkan: false,
      },
      {
        daftarCatatId: "daftar-histori",
        taksasi: 10,
        metode: "TIGA_TERTINGGI",
        standTerakhir: 230,
        bolehDitambahkan: true,
        manualProvenance: {
          sumberTagihan: [
            { id: "tagihan-september", pemakaianM3: 10 },
            { id: "tagihan-agustus", pemakaianM3: 10 },
            { id: "tagihan-juli", pemakaianM3: 10 },
          ],
        },
      },
    ])
    expect(mocks.tx.tagihan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pelangganId: { in: expect.arrayContaining(["pelanggan-histori"]) },
          pemakaianM3: { gte: 0 },
        }),
      })
    )
    expect(mocks.tx.daftarCatat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "BELUM_DICATAT",
        }),
      })
    )

    const invalidSubmit = await requestJson("/massal", "POST", {
      periode: PERIODE,
      ruteId: "rute-1",
      pencatatId: "petugas-1",
      daftarCatatIds: ["daftar-tanpa-stand"],
      alasanManual: "Belum dilaporkan petugas.",
    })
    expect(invalidSubmit.response.status).toBe(409)
    expect(dataLaporanDibuat).toHaveLength(0)

    const submit = await requestJson("/massal", "POST", {
      periode: PERIODE,
      tanggalCatat: "2026-10-12",
      ruteId: "rute-1",
      pencatatId: "petugas-1",
      daftarCatatIds: ["daftar-belum"],
      alasanManual: "Belum dilaporkan petugas.",
    })

    expect(submit.response.status).toBe(201)
    expect(submit.json.data).toMatchObject({
      dibuat: 1,
      duplikat: 0,
      totalDipilih: 1,
    })
    expect(dataLaporanDibuat).toHaveLength(1)
    expect(dataLaporanDibuat[0]).toMatchObject({
      pelangganId: "pelanggan-belum",
      standAwal: 125,
      standAkhir: 125,
      pemakaian: 5,
      tanggalCatat: new Date("2026-10-12T00:00:00.000Z"),
      jenisInput: "MANUAL_MASSAL",
    })
    expect(dataLaporanDibuat[0]?.createdAt).toEqual(expect.any(Date))
    expect(mocks.tx.daftarCatat.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["daftar-belum"] },
          status: "BELUM_DICATAT",
        }),
      })
    )
  })
})
