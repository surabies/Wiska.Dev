import { randomUUID } from "node:crypto"
import { Hono } from "hono"
import { z } from "zod"
import {
  JenisInputLaporanHarian,
  KategoriPembacaan,
  KondisiCatat,
  Prisma,
  StatusDaftarCatat,
} from "@db"
import { prisma } from "@db"
import { auditMetaFromRequest, recordAudit } from "../../lib/Audit"
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/Galat"
import { periodeToDate } from "../../lib/Periode"
import { created, ok } from "../../lib/Respons"
import { getSessionUser } from "../../lib/Sesi"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import {
  hitungTaksasiManual,
  type RiwayatTagihanManual,
} from "@/lib/domain/TaksasiManual"

export const manualAddRouter = new Hono()

const PERIODE_SCHEMA = z.coerce
  .number()
  .int()
  .min(190001)
  .max(999912)
  .refine((value) => value % 100 >= 1 && value % 100 <= 12, {
    message: "Periode harus menggunakan format tahun-bulan yang valid.",
  })

const queryPelangganSchema = z.object({
  nomor: z
    .string()
    .trim()
    .regex(/^\d{11}$/, {
      message: "Nomor pelanggan harus terdiri dari 11 digit.",
    }),
  periode: PERIODE_SCHEMA,
})

const queryOpsiSchema = z.object({
  periode: PERIODE_SCHEMA.optional(),
  pencatatId: z.string().trim().min(1).optional(),
  ruteId: z.string().trim().min(1).optional(),
})

const filterSchema = z.object({
  periode: PERIODE_SCHEMA,
  ruteId: z.string().trim().min(1),
  pencatatId: z.string().trim().min(1),
})

const alasanSchema = z.string().trim().min(5).max(500)
const tanggalCatatSchema = z.iso.date()
const tanggalSesuaiPeriode = (tanggal: string | undefined, periode: number) =>
  tanggal === undefined ||
  Number(tanggal.slice(0, 4)) * 100 + Number(tanggal.slice(5, 7)) === periode

const inputSatuanSchema = z
  .object({
    pelangganId: z.string().trim().min(1),
    periode: PERIODE_SCHEMA,
    tanggalCatat: tanggalCatatSchema.optional(),
    standAwal: z.coerce.number().int().min(0).max(2_147_483_647),
    standAkhir: z.coerce.number().int().min(0).max(2_147_483_647),
    pemakaian: z.coerce
      .number()
      .int()
      .min(-2_147_483_648)
      .max(2_147_483_647)
      .optional(),
    alasanManual: alasanSchema,
  })
  .refine(
    ({ tanggalCatat, periode }) => tanggalSesuaiPeriode(tanggalCatat, periode),
    {
      path: ["tanggalCatat"],
      message: "Tanggal pencatatan harus berada dalam periode laporan.",
    }
  )

const inputMassalSchema = filterSchema
  .extend({
    tanggalCatat: tanggalCatatSchema.optional(),
    daftarCatatIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Pilihan pelanggan tidak boleh duplikat.",
      }),
    alasanManual: alasanSchema,
  })
  .refine(
    ({ tanggalCatat, periode }) => tanggalSesuaiPeriode(tanggalCatat, periode),
    {
      path: ["tanggalCatat"],
      message: "Tanggal pencatatan harus berada dalam periode laporan.",
    }
  )

const BATAS_BARIS_MASSAL = 500
const FOTO_MANUAL_ADD_SATUAN = "/images/meter/manual-add.jpg"
const FOTO_MANUAL_ADD_MASSAL = "/images/meter/manual-add-all.jpg"
const META_AUDIT = (request: Request) => auditMetaFromRequest(request)

type Transaksi = Prisma.TransactionClient

type ItemManualAdd = {
  daftarCatatId: string
  pelangganId: string
  nomorLangganan: string
  nama: string
  alamat: string
  taksasi: number | null
  metode:
    | "RATA_RATA_12_BULAN"
    | "TIGA_TERTINGGI"
    | "RIWAYAT_TERSEDIA"
    | "TANPA_HISTORI"
  standTerakhir: number | null
  pemakaianLalu: number | null
  meterId: string | null
  nomorMeter: string | null
  bolehDitambahkan: boolean
  alasanPeninjauan: string | null
  manualProvenance: Prisma.InputJsonObject
}

function isItemManualAddSiap(item: ItemManualAdd): item is ItemManualAdd & {
  taksasi: number
  standTerakhir: number
  meterId: string
} {
  return (
    item.bolehDitambahkan &&
    item.taksasi !== null &&
    item.standTerakhir !== null &&
    item.meterId !== null
  )
}

function cekPeriodeTerbuka(status: string | undefined) {
  if (status === "TERKUNCI") {
    throw new ConflictError(
      "Periode sudah ditutup; laporan manual tidak dapat ditambahkan."
    )
  }
}

async function pastikanPeriodeTerbuka(tx: Transaksi, periode: number) {
  const baris = await tx.periodePenagihan.findUnique({
    where: { periode },
    select: { status: true },
  })
  cekPeriodeTerbuka(baris?.status)
}

function hitungPersentase(pemakaian: number, pemakaianLalu: number | null) {
  if (pemakaianLalu == null || pemakaianLalu === 0) return null
  const nilai = Math.round(((pemakaian - pemakaianLalu) / pemakaianLalu) * 100)
  return Number.isSafeInteger(nilai) && Math.abs(nilai) <= 2_147_483_647
    ? nilai
    : null
}

manualAddRouter.get(
  "/cari-pelanggan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", queryPelangganSchema),
  async (c) => {
    const { nomor, periode } = c.req.valid("query")
    const periodeDate = periodeToDate(periode)
    const pelanggan = await prisma.pelanggan.findMany({
      where: {
        nomorLangganan: nomor,
        status: "AKTIF",
      },
      orderBy: { nomorLangganan: "asc" },
      take: 20,
      select: {
        id: true,
        nomorLangganan: true,
        nama: true,
        alamat: true,
        tarifGolongan: { select: { kodeAsli: true } },
        meter: {
          where: { isAktif: true },
          orderBy: { createdAt: "desc" },
          take: 2,
          select: {
            id: true,
            nomorMeter: true,
            pembacaan: {
              where: {
                periode: { lt: periodeDate },
              },
              orderBy: { periode: "desc" },
              take: 1,
              select: {
                standAkhir: true,
              },
            },
          },
        },
      },
    })
    const tagihanTerakhir = await prisma.tagihan.findMany({
      where: {
        pelangganId: { in: pelanggan.map((item) => item.id) },
        periode: { lt: periodeDate },
        pemakaianM3: { gte: 0 },
      },
      orderBy: { periode: "desc" },
      select: {
        pelangganId: true,
        pemakaianM3: true,
      },
    })
    const pemakaianTagihanTerakhir = new Map<string, number>()
    for (const tagihan of tagihanTerakhir) {
      if (!pemakaianTagihanTerakhir.has(tagihan.pelangganId)) {
        pemakaianTagihanTerakhir.set(tagihan.pelangganId, tagihan.pemakaianM3)
      }
    }
    const pembacaanPeriode = await prisma.pembacaanMeter.findMany({
      where: {
        periode: periodeDate,
        meter: { pelangganId: { in: pelanggan.map((item) => item.id) } },
      },
      select: {
        id: true,
        meter: { select: { pelangganId: true } },
        tagihan: { select: { id: true } },
      },
    })
    const laporanPeriode = await prisma.laporanHarianPetugas.findMany({
      where: {
        periode,
        OR: [
          { pelangganId: { in: pelanggan.map((item) => item.id) } },
          {
            nomorLangganan: {
              in: pelanggan.map((item) => item.nomorLangganan),
            },
          },
        ],
      },
      select: {
        pelangganId: true,
        nomorLangganan: true,
        id: true,
        verif1At: true,
        verif2At: true,
        verif3At: true,
        pembacaan: {
          select: { id: true, tagihan: { select: { id: true } } },
        },
      },
    })
    const pelangganSudahResmi = new Set(
      pembacaanPeriode.map((row) => row.meter.pelangganId)
    )
    const laporanPerPelanggan = new Map<
      string,
      (typeof laporanPeriode)[number]
    >()
    for (const row of laporanPeriode) {
      if (row.pelangganId) laporanPerPelanggan.set(row.pelangganId, row)
      laporanPerPelanggan.set(row.nomorLangganan, row)
    }

    return ok(
      c,
      pelanggan.map((item) => {
        const meter = item.meter.length === 1 ? item.meter[0]! : null
        const bacaan = meter?.pembacaan[0] ?? null
        const laporanPeriodeData =
          laporanPerPelanggan.get(item.id) ??
          laporanPerPelanggan.get(item.nomorLangganan) ??
          null
        const bolehTimpaLaporan =
          laporanPeriodeData !== null &&
          !laporanPeriodeData.pembacaan?.tagihan &&
          !pembacaanPeriode.some(
            (row) =>
              row.meter.pelangganId === item.id &&
              row.id !== laporanPeriodeData.pembacaan?.id
          )
        const sudahAdaLaporan =
          laporanPeriodeData !== null || pelangganSudahResmi.has(item.id)
        return {
          id: item.id,
          nomorLangganan: item.nomorLangganan,
          nama: item.nama,
          alamat: item.alamat,
          tarifGolongan: item.tarifGolongan,
          nomorMeter: meter?.nomorMeter ?? null,
          meterAktif: item.meter.length === 1,
          meterAmbigu: item.meter.length > 1,
          standTerakhir: bacaan?.standAkhir ?? null,
          pemakaianTerakhir: pemakaianTagihanTerakhir.get(item.id) ?? null,
          sudahAdaLaporan,
          bolehTimpaLaporan,
        }
      })
    )
  }
)

manualAddRouter.get(
  "/opsi",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", queryOpsiSchema),
  async (c) => {
    const query = c.req.valid("query")
    const periode =
      query.periode ??
      (
        await prisma.daftarCatat.findFirst({
          where: {
            status: StatusDaftarCatat.BELUM_DICATAT,
            ruteId: { not: null },
            pencatatId: { not: null },
          },
          orderBy: { periode: "desc" },
          select: { periode: true },
        })
      )?.periode ??
      (() => {
        const now = new Date()
        return now.getFullYear() * 100 + now.getMonth() + 1
      })()
    const { pencatatId, ruteId } = query
    const [rute, pencatat] = await Promise.all([
      prisma.rute.findMany({
        where: {
          daftarCatat: {
            some: {
              periode,
              status: "BELUM_DICATAT",
              pencatatId: pencatatId ?? { not: null },
            },
          },
        },
        orderBy: { kode: "asc" },
        select: { id: true, kode: true },
      }),
      prisma.pencatat.findMany({
        where: {
          daftarCatat: {
            some: {
              periode,
              status: "BELUM_DICATAT",
              ruteId: ruteId ?? { not: null },
              pencatatId: { not: null },
            },
          },
        },
        orderBy: { namaLapangan: "asc" },
        select: { id: true, namaLapangan: true, namaLengkap: true },
      }),
    ])

    return ok(c, {
      periode,
      rute,
      pencatat: pencatat.map((item) => ({
        id: item.id,
        nama: item.namaLengkap ?? item.namaLapangan,
      })),
    })
  }
)

async function ambilDaftarManualAdd(
  tx: Transaksi,
  filter: z.infer<typeof filterSchema>
): Promise<ItemManualAdd[]> {
  await pastikanPeriodeTerbuka(tx, filter.periode)
  const baris = await tx.daftarCatat.findMany({
    where: {
      periode: filter.periode,
      ruteId: filter.ruteId,
      pencatatId: filter.pencatatId,
      status: StatusDaftarCatat.BELUM_DICATAT,
    },
    orderBy: [{ urutan: "asc" }, { pelangganId: "asc" }],
    take: BATAS_BARIS_MASSAL + 1,
    select: {
      id: true,
      pelangganId: true,
      pelanggan: {
        select: {
          id: true,
          nomorLangganan: true,
          nama: true,
          alamat: true,
          meter: {
            where: { isAktif: true },
            orderBy: { createdAt: "desc" },
            take: 2,
            select: { id: true, nomorMeter: true },
          },
        },
      },
    },
  })

  if (baris.length > BATAS_BARIS_MASSAL) {
    throw new BadRequestError(
      `Hasil filter lebih dari ${BATAS_BARIS_MASSAL} pelanggan. Persempit pilihan rute atau petugas.`
    )
  }

  const pelangganIds = baris.map((row) => row.pelangganId)
  const nomorLangganan = baris.map((row) => row.pelanggan.nomorLangganan)
  const [laporanAda, tagihan, standTerakhirMeter, bacaanPeriodeIni] =
    await Promise.all([
      tx.laporanHarianPetugas.findMany({
        where: {
          periode: filter.periode,
          OR: [
            { pelangganId: { in: pelangganIds } },
            { nomorLangganan: { in: nomorLangganan } },
          ],
        },
        select: { pelangganId: true, nomorLangganan: true },
      }),
      tx.tagihan.findMany({
        where: {
          pelangganId: { in: pelangganIds },
          periode: { lt: periodeToDate(filter.periode) },
          pemakaianM3: { gte: 0 },
        },
        orderBy: { periode: "desc" },
        select: {
          id: true,
          pelangganId: true,
          periode: true,
          pemakaianM3: true,
        },
      }),
      tx.meter.findMany({
        where: {
          id: {
            in: baris.flatMap((row) =>
              row.pelanggan.meter.map((meter) => meter.id)
            ),
          },
        },
        select: {
          id: true,
          pembacaan: {
            where: { periode: { lt: periodeToDate(filter.periode) } },
            orderBy: { periode: "desc" },
            take: 1,
            select: {
              id: true,
              periode: true,
              standAkhir: true,
            },
          },
        },
      }),
      tx.pembacaanMeter.findMany({
        where: {
          periode: periodeToDate(filter.periode),
          meter: { pelangganId: { in: pelangganIds } },
        },
        select: { meter: { select: { pelangganId: true } } },
      }),
    ])

  const duplicateCustomerIds = new Set([
    ...laporanAda
      .map((row) => row.pelangganId)
      .filter((id): id is string => id !== null),
    ...bacaanPeriodeIni.map((row) => row.meter.pelangganId),
  ])
  const duplicateNumbers = new Set(laporanAda.map((row) => row.nomorLangganan))
  const histories = new Map<string, RiwayatTagihanManual[]>()
  for (const row of tagihan) {
    const riwayat = histories.get(row.pelangganId) ?? []
    riwayat.push({
      id: row.id,
      periode: row.periode,
      pemakaianM3: row.pemakaianM3,
    })
    histories.set(row.pelangganId, riwayat)
  }

  const standTerakhirByMeter = new Map(
    standTerakhirMeter.map((meter) => {
      const pembacaan = meter.pembacaan[0]
      return [
        meter.id,
        pembacaan
          ? {
              id: pembacaan.id,
              periode: pembacaan.periode,
              standAkhir: pembacaan.standAkhir,
            }
          : null,
      ] as const
    })
  )

  const hasil = baris.map((row) => {
    const meter = row.pelanggan.meter[0] ?? null
    if (
      duplicateCustomerIds.has(row.pelangganId) ||
      duplicateNumbers.has(row.pelanggan.nomorLangganan)
    ) {
      return null
    }

    const hasil = hitungTaksasiManual(
      histories.get(row.pelangganId) ?? [],
      periodeToDate(filter.periode),
      meter ? (standTerakhirByMeter.get(meter.id) ?? null) : null
    )

    return {
      daftarCatatId: row.id,
      pelangganId: row.pelangganId,
      nomorLangganan: row.pelanggan.nomorLangganan,
      nama: row.pelanggan.nama,
      alamat: row.pelanggan.alamat,
      taksasi: hasil.pemakaian,
      metode: hasil.metode,
      standTerakhir: hasil.standAwalTerakhir,
      pemakaianLalu: hasil.pemakaianTerakhir,
      bolehDitambahkan: hasil.bolehDitambahkan,
      alasanPeninjauan: hasil.alasanPeninjauan,
      meterId: meter?.id ?? null,
      nomorMeter: meter?.nomorMeter ?? null,
      manualProvenance: {
        metode: hasil.metode,
        standSumber: hasil.standSumber,
        sumberTagihan: hasil.sumberTagihan,
      } satisfies Prisma.InputJsonObject,
    }
  })
  return hasil.filter((item) => item !== null)
}

manualAddRouter.get(
  "/daftar",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", filterSchema),
  async (c) => {
    const hasil = await prisma.$transaction((tx) =>
      ambilDaftarManualAdd(tx, c.req.valid("query"))
    )
    return ok(c, hasil)
  }
)

manualAddRouter.post(
  "/satuan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", inputSatuanSchema),
  async (c) => {
    const input = c.req.valid("json")
    const requester = getSessionUser(c)
    const metaAudit = META_AUDIT(c.req.raw)
    const hasil = await prisma.$transaction(async (tx) => {
      await pastikanPeriodeTerbuka(tx, input.periode)
      const pelanggan = await tx.pelanggan.findUnique({
        where: { id: input.pelangganId },
        select: {
          id: true,
          nomorLangganan: true,
          nama: true,
          alamat: true,
          status: true,
          meter: {
            where: { isAktif: true },
            orderBy: { createdAt: "desc" },
            take: 2,
            select: { id: true, nomorMeter: true },
          },
          daftarCatat: {
            where: { periode: input.periode },
            take: 1,
            select: { id: true, status: true },
          },
        },
      })
      if (!pelanggan || pelanggan.status !== "AKTIF") {
        throw new NotFoundError("Pelanggan aktif")
      }
      if (pelanggan.meter.length > 1) {
        throw new ConflictError(
          "Pelanggan memiliki lebih dari satu meter aktif; rapikan data meter sebelum menambah laporan."
        )
      }
      const meter = pelanggan.meter[0]
      if (!meter) {
        throw new ConflictError("Pelanggan tidak memiliki meter aktif.")
      }
      const existing = await tx.laporanHarianPetugas.findFirst({
        where: {
          periode: input.periode,
          OR: [
            { pelangganId: pelanggan.id },
            { nomorLangganan: pelanggan.nomorLangganan },
          ],
        },
        select: {
          id: true,
          pelangganId: true,
          nomorLangganan: true,
          standAwal: true,
          standAkhir: true,
          pemakaian: true,
          pemakaianLalu: true,
          persentase: true,
          kondisi: true,
          kategori: true,
          jenisInput: true,
          alasanManual: true,
          manualProvenance: true,
          nomorMeter: true,
          tanggalCatat: true,
          isVerified: true,
          verifiedAt: true,
          verifiedById: true,
          catatanVerif: true,
          pembacaanId: true,
          pemakaianTagihVerif: true,
          blokTarifVerif: true,
          meterVerifId: true,
          standAkhirRevisi: true,
          standAwalRevisi: true,
          kondisiRevisi: true,
          verif1At: true,
          verif1ById: true,
          verif2At: true,
          verif2ById: true,
          verif3At: true,
          verif3ById: true,
          fotoStandUrl: true,
          pembacaan: {
            select: {
              id: true,
              standLalu: true,
              standAkhir: true,
              pemakaianM3: true,
              pemakaianRiil: true,
              alasanTaksir: true,
              blokTarif: true,
              tagihan: { select: { id: true } },
            },
          },
        },
      })
      const pembacaanPeriodeIni = await tx.pembacaanMeter.findMany({
        where: {
          periode: periodeToDate(input.periode),
          meter: { pelangganId: pelanggan.id },
        },
        select: { id: true, tagihan: { select: { id: true } } },
      })
      if (
        pembacaanPeriodeIni.some(
          (pembacaan) => pembacaan.id !== existing?.pembacaan?.id
        )
      ) {
        throw new ConflictError(
          "Pembacaan resmi untuk pelanggan dan periode ini sudah ada."
        )
      }
      if (
        existing?.pembacaan?.tagihan ||
        pembacaanPeriodeIni.some((pembacaan) => pembacaan.tagihan !== null)
      ) {
        throw new ConflictError(
          "Hasil periode ini sudah dipakai tagihan dan tidak dapat ditimpa melalui Manual Add."
        )
      }
      const daftar = pelanggan.daftarCatat[0]
      if (daftar?.status === StatusDaftarCatat.DICABUT) {
        throw new ConflictError(
          "Pelanggan berstatus dicabut pada daftar periode ini."
        )
      }
      if (!existing && daftar?.status === StatusDaftarCatat.DICATAT) {
        throw new ConflictError(
          "Daftar periode sudah berstatus dicatat, tetapi laporannya tidak ditemukan."
        )
      }

      const pemakaian = input.pemakaian ?? input.standAkhir - input.standAwal
      const tagihanTerakhir = await tx.tagihan.findFirst({
        where: {
          pelangganId: pelanggan.id,
          periode: { lt: periodeToDate(input.periode) },
          pemakaianM3: { gte: 0 },
        },
        orderBy: { periode: "desc" },
        select: { pemakaianM3: true },
      })
      const pemakaianLalu = tagihanTerakhir?.pemakaianM3 ?? null
      const dataLaporan = {
        pelangganId: pelanggan.id,
        nomorLangganan: pelanggan.nomorLangganan,
        namaPelanggan: pelanggan.nama,
        alamatPelanggan: pelanggan.alamat,
        periode: input.periode,
        standAwal: input.standAwal,
        standAkhir: input.standAkhir,
        pemakaian,
        pemakaianLalu,
        persentase: hitungPersentase(pemakaian, pemakaianLalu),
        kondisi: KondisiCatat.NORMAL,
        kategori: KategoriPembacaan.OFFSITE,
        jenisInput: JenisInputLaporanHarian.MANUAL_SATUAN,
        alasanManual: input.alasanManual,
        nomorMeter: meter.nomorMeter,
        fotoStandUrl: FOTO_MANUAL_ADD_SATUAN,
        tanggalCatat: input.tanggalCatat
          ? new Date(`${input.tanggalCatat}T00:00:00.000Z`)
          : new Date(),
        manualProvenance: Prisma.DbNull,
        isVerified: false,
        verifiedAt: null,
        verifiedById: null,
        catatanVerif: null,
        pembacaanId: null,
        pemakaianTagihVerif: null,
        blokTarifVerif: null,
        meterVerifId: null,
        standAkhirRevisi: null,
        standAwalRevisi: null,
        kondisiRevisi: null,
        verif1At: null,
        verif1ById: null,
        verif2At: null,
        verif2ById: null,
        verif3At: null,
        verif3ById: null,
      }
      let laporanId = existing?.id
      if (existing) {
        const hasilReset = await tx.laporanHarianPetugas.updateMany({
          where: {
            id: existing.id,
            verif1At: existing.verif1At,
            verif2At: existing.verif2At,
            verif3At: existing.verif3At,
            pembacaanId: existing.pembacaanId,
          },
          data: dataLaporan,
        })
        if (hasilReset.count !== 1) {
          throw new ConflictError(
            "Laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
          )
        }
        if (existing.pembacaan) {
          await tx.pembacaanMeter.delete({
            where: { id: existing.pembacaan.id },
          })
        }
      } else {
        const laporanBaru = await tx.laporanHarianPetugas.create({
          data: dataLaporan,
          select: { id: true },
        })
        laporanId = laporanBaru.id
      }
      if (daftar && daftar.status !== StatusDaftarCatat.DICATAT) {
        const hasilUpdate = await tx.daftarCatat.updateMany({
          where: {
            id: daftar.id,
            status: {
              in: [
                StatusDaftarCatat.BELUM_DICATAT,
                StatusDaftarCatat.TIDAK_TERCATAT,
              ],
            },
          },
          data: { status: StatusDaftarCatat.DICATAT, selesaiAt: new Date() },
        })
        if (hasilUpdate.count !== 1) {
          throw new ConflictError(
            "Status daftar catat berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
          )
        }
      }
      if (!laporanId) {
        throw new ConflictError("Laporan Manual Add tidak berhasil dibuat.")
      }
      const laporan = await tx.laporanHarianPetugas.findUniqueOrThrow({
        where: { id: laporanId },
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: existing ? "MANUAL_ADD_SATUAN_REPLACE" : "MANUAL_ADD_SATUAN",
        entitas: "LaporanHarianPetugas",
        entitasId: laporan.id,
        perubahan: {
          sebelum: existing
            ? {
                standAwal: existing.standAwal,
                standAkhir: existing.standAkhir,
                pemakaian: existing.pemakaian,
                pemakaianLalu: existing.pemakaianLalu,
                persentase: existing.persentase,
                kondisi: existing.kondisi,
                kategori: existing.kategori,
                jenisInput: existing.jenisInput,
                alasanManual: existing.alasanManual,
                manualProvenance: existing.manualProvenance,
                nomorMeter: existing.nomorMeter,
                tanggalCatat: existing.tanggalCatat,
                isVerified: existing.isVerified,
                verifiedAt: existing.verifiedAt,
                verifiedById: existing.verifiedById,
                catatanVerif: existing.catatanVerif,
                pembacaanId: existing.pembacaanId,
                pembacaanDihapusId: existing.pembacaan?.id ?? null,
                pembacaanDihapus:
                  existing.pembacaan === null
                    ? null
                    : {
                        standLalu: existing.pembacaan.standLalu,
                        standAkhir: existing.pembacaan.standAkhir,
                        pemakaianM3: existing.pembacaan.pemakaianM3,
                        pemakaianRiil: existing.pembacaan.pemakaianRiil,
                        alasanTaksir: existing.pembacaan.alasanTaksir,
                        blokTarif: existing.pembacaan.blokTarif,
                      },
                pemakaianTagihVerif: existing.pemakaianTagihVerif,
                blokTarifVerif: existing.blokTarifVerif,
                meterVerifId: existing.meterVerifId,
                standAkhirRevisi: existing.standAkhirRevisi,
                standAwalRevisi: existing.standAwalRevisi,
                kondisiRevisi: existing.kondisiRevisi,
                fotoStandUrl: existing.fotoStandUrl,
                verif1At: existing.verif1At,
                verif1ById: existing.verif1ById,
                verif2At: existing.verif2At,
                verif2ById: existing.verif2ById,
                verif3At: existing.verif3At,
                verif3ById: existing.verif3ById,
              }
            : null,
          sesudah: {
            pelangganId: pelanggan.id,
            periode: input.periode,
            standAwal: input.standAwal,
            standAkhir: input.standAkhir,
            pemakaian,
            alasanManual: input.alasanManual,
            fotoStandUrl: FOTO_MANUAL_ADD_SATUAN,
            isVerified: false,
            pembacaanId: null,
            verif1At: null,
            verif2At: null,
            verif3At: null,
            manualProvenance: null,
            statusVerifikasi: "MENUNGGU_VERIFIKASI_ULANG",
          },
        },
        ...metaAudit,
      })
      return laporan
    })
    return created(c, hasil)
  }
)

manualAddRouter.post(
  "/massal",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", inputMassalSchema),
  async (c) => {
    const input = c.req.valid("json")
    const requester = getSessionUser(c)
    const metaAudit = META_AUDIT(c.req.raw)
    const hasil = await prisma.$transaction(
      async (tx) => {
        const daftar = await ambilDaftarManualAdd(tx, input)
        const pilihanIds = new Set(input.daftarCatatIds)
        const pilihan = daftar.filter((item) =>
          pilihanIds.has(item.daftarCatatId)
        )
        if (pilihan.length !== pilihanIds.size) {
          throw new ConflictError(
            "Sebagian pilihan sudah berubah atau tidak lagi tersedia. Muat ulang daftar alamat."
          )
        }
        const pilihanSiap = pilihan.filter(isItemManualAddSiap)
        if (pilihanSiap.length !== pilihan.length) {
          throw new ConflictError(
            "Sebagian alamat belum memiliki meter aktif dan stand resmi periode sebelumnya. Lengkapi datanya sebelum ditambahkan."
          )
        }
        const waktu = new Date()
        const tanggalCatat = input.tanggalCatat
          ? new Date(`${input.tanggalCatat}T00:00:00.000Z`)
          : waktu
        const ids = pilihanSiap.map(() => randomUUID())
        const laporanData = pilihanSiap.map((item, index) => ({
          id: ids[index]!,
          pelangganId: item.pelangganId,
          nomorLangganan: item.nomorLangganan,
          namaPelanggan: item.nama,
          alamatPelanggan: item.alamat,
          periode: input.periode,
          standAwal: item.standTerakhir,
          standAkhir: item.standTerakhir,
          pemakaian: item.taksasi,
          pemakaianLalu: item.pemakaianLalu,
          persentase: hitungPersentase(item.taksasi!, item.pemakaianLalu),
          kondisi: KondisiCatat.NORMAL,
          kategori: KategoriPembacaan.OFFSITE,
          jenisInput: JenisInputLaporanHarian.MANUAL_MASSAL,
          alasanManual: input.alasanManual,
          manualProvenance: item.manualProvenance,
          nomorMeter: item.nomorMeter,
          fotoStandUrl: FOTO_MANUAL_ADD_MASSAL,
          pencatatId: input.pencatatId,
          tanggalCatat,
          createdAt: waktu,
        }))
        const createResult =
          laporanData.length > 0
            ? await tx.laporanHarianPetugas.createMany({
                data: laporanData,
                skipDuplicates: true,
              })
            : { count: 0 }

        const laporanTersimpan =
          ids.length > 0
            ? await tx.laporanHarianPetugas.findMany({
                where: { id: { in: ids } },
                select: {
                  id: true,
                  pelangganId: true,
                  nomorLangganan: true,
                  standAwal: true,
                  standAkhir: true,
                  pemakaian: true,
                  periode: true,
                  manualProvenance: true,
                  fotoStandUrl: true,
                },
              })
            : []
        const idsDaftar = pilihanSiap
          .filter((_, index) =>
            laporanTersimpan.some((laporan) => laporan.id === ids[index])
          )
          .map((item) => item.daftarCatatId)
        if (idsDaftar.length > 0) {
          const hasilUpdate = await tx.daftarCatat.updateMany({
            where: {
              id: { in: idsDaftar },
              status: StatusDaftarCatat.BELUM_DICATAT,
            },
            data: { status: StatusDaftarCatat.DICATAT, selesaiAt: waktu },
          })
          if (hasilUpdate.count !== idsDaftar.length) {
            throw new ConflictError(
              "Status daftar catat berubah saat proses berjalan. Tidak ada laporan yang disimpan; muat ulang daftar alamat."
            )
          }
        }

        if (laporanTersimpan.length > 0) {
          await tx.auditLog.createMany({
            data: laporanTersimpan.map((laporan) => ({
              userId: requester.id,
              aksi: "MANUAL_ADD_MASSAL",
              entitas: "LaporanHarianPetugas",
              entitasId: laporan.id,
              perubahan: {
                sesudah: {
                  pelangganId: laporan.pelangganId,
                  nomorLangganan: laporan.nomorLangganan,
                  periode: laporan.periode,
                  standAwal: laporan.standAwal,
                  standAkhir: laporan.standAkhir,
                  pemakaian: laporan.pemakaian,
                  alasanManual: input.alasanManual,
                  manualProvenance: laporan.manualProvenance,
                  fotoStandUrl: laporan.fotoStandUrl,
                },
              },
              ipAddress: metaAudit.ipAddress,
              userAgent: metaAudit.userAgent,
            })),
          })
        }

        return {
          dibuat: createResult.count,
          duplikat: pilihan.length - laporanTersimpan.length,
          totalDipilih: pilihan.length,
        }
      },
      { timeout: 30_000 }
    )
    return created(c, hasil)
  }
)
