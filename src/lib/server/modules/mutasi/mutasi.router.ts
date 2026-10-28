// server/modules/mutasi/mutasi.router.ts — mutasi sambungan (PB = Pasang
// Baru, PK = Pindah Kontrak). @@unique([pelangganId, periode, jenis]) ->
// P2002 jadi 409 lewat errorHandler.
import { Hono } from "hono"
import { z } from "zod"
import { JenisMutasi, UkuranMeter, GolonganTarif } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError } from "../../lib/errors"
import { recordAudit, auditMetaFromRequest } from "../../lib/audit"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"
import {
  GEO,
  setPoint,
  getPointGeoJson,
  getPointGeoJsonMany,
} from "../../lib/spatial"

export const mutasiRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "periode",
    "jenis",
    "tanggalAktif",
    "nomorMeterBaru",
  ]),
  pelangganId: z.string().optional(),
  jenis: z.enum(JenisMutasi).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

mutasiRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      pelangganId: query.pelangganId,
      jenis: query.jenis,
      periode: query.periode,
    }
    const [rows, total] = await Promise.all([
      prisma.mutasiPelanggan.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { createdAt: "desc" }),
        include: {
          pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
        },
      }),
      prisma.mutasiPelanggan.count({ where }),
    ])
    const koord = await getPointGeoJsonMany(
      prisma,
      GEO.mutasiPelanggan,
      rows.map((r) => r.id),
    )
    return paginated(
      c,
      rows.map((r) => ({ ...r, koordinatMutasi: koord.get(r.id) ?? null })),
      buildMeta(total, query),
    )
  },
)

mutasiRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const id = c.req.param("id")
  const row = await prisma.mutasiPelanggan.findUnique({
    where: { id },
    include: {
      pelanggan: true,
      prosesOleh: { select: { id: true, name: true } },
    },
  })
  if (!row) throw new NotFoundError("MutasiPelanggan")
  return ok(c, {
    ...row,
    koordinatMutasi: await getPointGeoJson(prisma, GEO.mutasiPelanggan, id),
  })
})

const createSchema = z.object({
  pelangganId: z.string().min(1),
  jenis: z.enum(JenisMutasi),
  periode: z.coerce.number().int().min(190001).max(999912),
  nomorMeterBaru: z.string().trim().max(50).nullable().optional(),
  merkMeterBaru: z.string().trim().max(50).nullable().optional(),
  ukuranMeterBaru: z.enum(UkuranMeter).nullable().optional(),
  tarifBaru: z.enum(GolonganTarif).nullable().optional(),
  koordinatMutasi: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable()
    .optional(),
  ruteBaru: z.string().trim().max(50).nullable().optional(),
  kodeWilayahBaru: z.string().trim().max(50).nullable().optional(),
  noUrut: z.coerce.number().int().nullable().optional(),
  jumlahPenghuni: z.coerce.number().int().min(0).nullable().optional(),
  tanggalAktif: z.coerce.date().nullable().optional(),
  catatan: z.string().max(500).nullable().optional(),
})

mutasiRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createSchema),
  async (c) => {
    const { koordinatMutasi, ...body } = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: body.pelangganId },
    })
    if (!pelanggan || pelanggan.deletedAt) throw new NotFoundError("Pelanggan")

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.mutasiPelanggan.create({
        data: { ...body, prosesOlehId: requester.id },
      })
      if (koordinatMutasi)
        await setPoint(
          tx,
          GEO.mutasiPelanggan,
          row.id,
          koordinatMutasi.lat,
          koordinatMutasi.lng,
        )
      await recordAudit(tx, {
        userId: requester.id,
        aksi: `MUTASI_${body.jenis}`,
        entitas: "MutasiPelanggan",
        entitasId: row.id,
        perubahan: { after: row },
        ipAddress,
        userAgent,
      })
      return row
    })

    return created(c, {
      ...row,
      koordinatMutasi: koordinatMutasi
        ? {
            type: "Point",
            coordinates: [koordinatMutasi.lng, koordinatMutasi.lat],
          }
        : null,
    })
  },
)
