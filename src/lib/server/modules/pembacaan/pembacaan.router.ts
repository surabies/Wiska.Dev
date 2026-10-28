// server/modules/pembacaan/pembacaan.router.ts — PembacaanMeter resmi
// (hasil closing/verifikasi). Satu baris per meter per periode
// (@@unique([meterId, periode]) -> P2002 dipetakan jadi 409 oleh
// errorHandler).
import { Hono } from "hono"
import { z } from "zod"
import { KondisiCatat, KategoriPembacaan } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError, BadRequestError } from "../../lib/errors"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"
import { periodeToDate } from "../../lib/periode"

export const pembacaanRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "periode",
    "standLalu",
    "standAkhir",
    "pemakaianM3",
    "kondisi",
    "createdAt",
  ]),
  meterId: z.string().optional(),
  pelangganId: z.string().optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  periodeSebelum: z.coerce.number().int().min(190001).max(999912).optional(),
  kondisi: z.enum(KondisiCatat).optional(),
  /// Penyaring per petugas. Dipasangkan dengan periode + kondisi, inilah yang
  /// menjawab "berapa banyak stand tempel milik AGUS bulan ini" — pertanyaan
  /// pengawasan yang tidak bisa dijawab oleh penyaring kondisi saja.
  pencatatId: z.string().optional(),
})

pembacaanRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      meterId: query.meterId,
      kondisi: query.kondisi,
      pencatatId: query.pencatatId,
      periode: query.periodeSebelum
        ? { lt: periodeToDate(query.periodeSebelum) }
        : query.periode
          ? periodeToDate(query.periode)
          : undefined,
      ...(query.pelangganId
        ? { meter: { pelangganId: query.pelangganId } }
        : {}),
    }
    const [data, total] = await Promise.all([
      prisma.pembacaanMeter.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { periode: "desc" }),
        include: {
          meter: {
            select: {
              id: true,
              nomorMeter: true,
              pelanggan: {
                select: { id: true, nomorLangganan: true, nama: true },
              },
            },
          },
          pencatat: { select: { id: true, namaLapangan: true } },
        },
      }),
      prisma.pembacaanMeter.count({ where }),
    ])
    return paginated(c, data, buildMeta(total, query))
  },
)

pembacaanRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await prisma.pembacaanMeter.findUnique({
    where: { id: c.req.param("id") },
    include: {
      meter: {
        include: {
          pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
        },
      },
      pencatat: true,
      tagihan: true,
    },
  })
  if (!row) throw new NotFoundError("PembacaanMeter")
  return ok(c, row)
})

/// Kondisi meter yang membuat stand mundur/tidak wajar itu SAH secara
/// lapangan (meter diganti, meter mundur, dst.) — untuk kondisi ini
/// validasi standAkhir >= standLalu sengaja dilewati.
const KONDISI_STAND_BOLEH_MUNDUR: readonly KondisiCatat[] = [
  "METER_RUSAK",
  "METER_MUNDUR",
  "METER_TERBALIK",
  "METER_MATI_ADA_AIR",
  "MUDA_KEMBALI",
  "LOS_METER",
  "DICABUT",
]

const createPembacaanSchema = z.object({
  meterId: z.string().min(1),
  /// Format thbl seperti sumber data: 202605 -> periode 2026-05-01.
  periode: z.coerce.number().int().min(190001).max(999912),
  standLalu: z.coerce.number().int().min(0),
  standAkhir: z.coerce.number().int().min(0),
  blokTarif: z.coerce.number().int().min(1).max(4),
  pemakaianLalu: z.coerce.number().int().min(0).nullable().optional(),
  blokTarifLalu: z.coerce.number().int().min(1).max(4).nullable().optional(),
  kondisi: z.enum(KondisiCatat).optional(),
  kategori: z.enum(KategoriPembacaan).optional(),
  pencatatId: z.string().min(1).nullable().optional(),
  tanggalCatat: z.coerce.date().nullable().optional(),
  fotoBukti: z.url().nullable().optional(),
})

pembacaanRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", createPembacaanSchema),
  async (c) => {
    const { periode, ...body } = c.req.valid("json")
    const meter = await prisma.meter.findUnique({ where: { id: body.meterId } })
    if (!meter) throw new NotFoundError("Meter")

    const kondisi = body.kondisi ?? "NORMAL"
    if (
      body.standAkhir < body.standLalu &&
      !KONDISI_STAND_BOLEH_MUNDUR.includes(kondisi)
    ) {
      throw new BadRequestError(
        `standAkhir (${body.standAkhir}) lebih kecil dari standLalu (${body.standLalu}) padahal kondisi ${kondisi}. ` +
          `Gunakan kondisi yang sesuai (mis. METER_RUSAK/METER_MUNDUR) bila memang meter bermasalah.`,
      )
    }

    // pemakaianM3 dihitung SERVER, tidak diterima dari client — supaya angka
    // tagihan tidak pernah bergantung pada input yang bisa dimanipulasi.
    const pemakaianM3 = Math.max(0, body.standAkhir - body.standLalu)

    const row = await prisma.pembacaanMeter.create({
      data: { ...body, kondisi, periode: periodeToDate(periode), pemakaianM3 },
    })
    return created(c, row)
  },
)
