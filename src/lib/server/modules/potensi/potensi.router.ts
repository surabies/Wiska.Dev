// server/modules/potensi/potensi.router.ts — prospek calon pelanggan hasil
// survei lapangan (titik rumah yang belum berlangganan).
import { Hono } from "hono"
import { z } from "zod"
import { StatusPotensi } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError } from "../../lib/errors"
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
  clearPoint,
  getPointGeoJson,
  getPointGeoJsonMany,
  findNearby,
} from "../../lib/spatial"

export const potensiRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["createdAt", "alamat", "status"]),
  q: z.string().trim().min(1).optional(),
  status: z.enum(StatusPotensi).optional(),
  ruteId: z.string().optional(),
  kelurahanId: z.string().optional(),
})

const nearQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50000).default(1000),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

potensiRouter.get(
  "/near",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", nearQuerySchema),
  async (c) => {
    const { lat, lng, radius, limit } = c.req.valid("query")
    const nearby = await findNearby(prisma, GEO.potensiPelanggan, {
      lat,
      lng,
      radiusMeters: radius,
      limit,
    })
    if (nearby.length === 0) return ok(c, [])
    const rows = await prisma.potensiPelanggan.findMany({
      where: { id: { in: nearby.map((r) => r.id) } },
      select: { id: true, alamat: true, status: true },
    })
    const byId = new Map(rows.map((r) => [r.id, r]))
    return ok(
      c,
      nearby.flatMap((r) => {
        const row = byId.get(r.id)
        return row ? [{ ...row, jarakMeter: r.jarakMeter }] : []
      }),
    )
  },
)

potensiRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      status: query.status,
      ruteId: query.ruteId,
      kelurahanId: query.kelurahanId,
      ...(query.q
        ? { alamat: { contains: query.q, mode: "insensitive" as const } }
        : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.potensiPelanggan.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { createdAt: "desc" }),
        include: { kelurahan: { select: { id: true, nama: true } } },
      }),
      prisma.potensiPelanggan.count({ where }),
    ])
    const koord = await getPointGeoJsonMany(
      prisma,
      GEO.potensiPelanggan,
      rows.map((r) => r.id),
    )
    return paginated(
      c,
      rows.map((r) => ({ ...r, koordinat: koord.get(r.id) ?? null })),
      buildMeta(total, query),
    )
  },
)

potensiRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const id = c.req.param("id")
  const row = await prisma.potensiPelanggan.findUnique({
    where: { id },
    include: { kelurahan: true, rute: true },
  })
  if (!row) throw new NotFoundError("PotensiPelanggan")
  return ok(c, {
    ...row,
    koordinat: await getPointGeoJson(prisma, GEO.potensiPelanggan, id),
  })
})

const koordinatSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .nullable()
  .optional()

const createSchema = z.object({
  alamat: z.string().trim().min(1).max(500),
  koordinat: koordinatSchema,
  status: z.enum(StatusPotensi).optional(),
  catatan: z.string().max(500).nullable().optional(),
  petugasId: z.string().min(1).nullable().optional(),
  ruteId: z.string().min(1).nullable().optional(),
  kelurahanId: z.string().min(1).nullable().optional(),
})

potensiRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createSchema),
  async (c) => {
    const { koordinat, ...body } = c.req.valid("json")
    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.potensiPelanggan.create({ data: body })
      if (koordinat)
        await setPoint(
          tx,
          GEO.potensiPelanggan,
          row.id,
          koordinat.lat,
          koordinat.lng,
        )
      return row
    })
    return created(c, {
      ...row,
      koordinat: koordinat
        ? { type: "Point", coordinates: [koordinat.lng, koordinat.lat] }
        : null,
    })
  },
)

const updateSchema = createSchema.partial()

potensiRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", updateSchema),
  async (c) => {
    const id = c.req.param("id")
    const existing = await prisma.potensiPelanggan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("PotensiPelanggan")
    const { koordinat, ...body } = c.req.valid("json")
    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.potensiPelanggan.update({
        where: { id },
        data: body,
      })
      if (koordinat !== undefined) {
        if (koordinat === null) await clearPoint(tx, GEO.potensiPelanggan, id)
        else
          await setPoint(
            tx,
            GEO.potensiPelanggan,
            id,
            koordinat.lat,
            koordinat.lng,
          )
      }
      return row
    })
    const finalKoordinat =
      koordinat !== undefined
        ? koordinat
          ? {
              type: "Point" as const,
              coordinates: [koordinat.lng, koordinat.lat],
            }
          : null
        : await getPointGeoJson(prisma, GEO.potensiPelanggan, id)
    return ok(c, { ...row, koordinat: finalKoordinat })
  },
)
