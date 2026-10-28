// server/lib/geo-crud-factory.ts — varian crud-factory.ts untuk model
// dengan SATU kolom geometry (area MultiPolygon/Geometry): WilayahAdm,
// WilayahDist, SeksiCater, WilayahSeksi, Zona, Rute, Kecamatan, Kelurahan.
//
// Pola: field scalar tetap lewat Prisma query builder biasa; kolom
// geometry (tidak bisa disentuh query builder — Unsupported("geometry...")
// di schema) ditulis lewat raw SQL DI DALAM transaksi yang sama dengan
// create/update, dan dibaca lewat query raw tambahan yang hasilnya
// digabung ke response sebagai field `area` berbentuk GeoJSON.
//
// `model` di config adalah NAMA KEY delegate di PrismaClient (mis.
// "wilayahAdm"), bukan delegate yang sudah di-bind — supaya kita bisa
// memanggil delegate yang sama lewat `tx` di dalam $transaction (delegate
// yang sudah di-bind ke `prisma` top-level tidak berpartisipasi dalam
// transaksi manapun).
import { Hono } from "hono"
import { validate } from "./validate"
import { z, type ZodType } from "zod"
import type { Role } from "@db"
import { prisma } from "@db"
import { requireRole } from "../middleware/rbac"
import { paginationQuerySchema, buildSkipTake, buildMeta } from "./pagination"
import { ok, created as createdResponse, paginated } from "./response"
import { NotFoundError } from "./errors"
import {
  type GeoColumnConfig,
  type GeoJsonGeometry,
  setArea,
  clearArea,
  getAreaGeoJson,
  getAreaGeoJsonMany,
} from "./spatial"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

export const geoJsonSchema: ZodType<GeoJsonGeometry> = z.object({
  type: z.string(),
  coordinates: z.any(),
}) as unknown as ZodType<GeoJsonGeometry>

export interface GeoCrudConfig<
  TCreate extends ZodType,
  TUpdate extends ZodType,
> {
  entitas: string
  /** Key delegate di PrismaClient, mis. "wilayahAdm" — lihat catatan di atas. */
  model: string
  geo: GeoColumnConfig
  /** Schema scalar fields + `area: geoJsonSchema.optional().nullable()`. */
  createSchema: TCreate
  updateSchema: TUpdate
  searchFields?: string[]
  orderBy?: AnyRecord
  include?: AnyRecord
  read: readonly Role[]
  write: readonly Role[]
}

function delegateOf(client: AnyRecord, model: string): AnyRecord {
  return client[model]
}

export function createGeoCrudRouter<
  TCreate extends ZodType,
  TUpdate extends ZodType,
>(config: GeoCrudConfig<TCreate, TUpdate>) {
  const {
    entitas,
    model,
    geo,
    searchFields = [],
    read,
    write,
    include,
    orderBy,
  } = config
  const listQuerySchema = paginationQuerySchema.extend({
    q: z.string().trim().min(1).optional(),
  })
  const router = new Hono()
  const delegate = delegateOf(prisma, model)

  router.get(
    "/",
    requireRole(...read),
    validate("query", listQuerySchema),
    async (c) => {
      const query = c.req.valid("query")
      const { skip, take } = buildSkipTake(query)
      const where: AnyRecord =
        query.q && searchFields.length > 0
          ? {
              OR: searchFields.map((field) => ({
                [field]: { contains: query.q, mode: "insensitive" },
              })),
            }
          : {}
      const [rows, total] = await Promise.all([
        delegate.findMany({
          where,
          skip,
          take,
          orderBy: orderBy ?? { nama: "asc" },
          include,
        }),
        delegate.count({ where }),
      ])
      const areas = await getAreaGeoJsonMany(
        prisma,
        geo,
        rows.map((r: AnyRecord) => r.id),
      )
      const data = rows.map((r: AnyRecord) => ({
        ...r,
        area: areas.get(r.id) ?? null,
      }))
      return paginated(c, data, buildMeta(total, query))
    },
  )

  router.get("/:id", requireRole(...read), async (c) => {
    const id = c.req.param("id")
    const row = await delegate.findUnique({ where: { id }, include })
    if (!row) throw new NotFoundError(entitas)
    const area = await getAreaGeoJson(prisma, geo, id)
    return ok(c, { ...row, area })
  })

  router.post(
    "/",
    requireRole(...write),
    validate("json", config.createSchema),
    async (c) => {
      const { area, ...data } = c.req.valid("json") as AnyRecord
      const row = await prisma.$transaction(async (tx) => {
        const row = await delegateOf(tx, model).create({ data, include })
        if (area) await setArea(tx, geo, row.id, area)
        return row
      })
      // `area` dibaca ULANG dari database, bukan meng-echo input — lihat
      // catatan di PATCH di bawah.
      return createdResponse(c, {
        ...row,
        area: area ? await getAreaGeoJson(prisma, geo, row.id) : null,
      })
    },
  )

  router.patch(
    "/:id",
    requireRole(...write),
    validate("json", config.updateSchema),
    async (c) => {
      const id = c.req.param("id")
      const existing = await delegate.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError(entitas)
      const { area, ...data } = c.req.valid("json") as AnyRecord
      const row = await prisma.$transaction(async (tx) => {
        const row = await delegateOf(tx, model).update({
          where: { id },
          data,
          include,
        })
        if (area !== undefined) {
          if (area === null) await clearArea(tx, geo, id)
          else await setArea(tx, geo, id, area)
        }
        return row
      })
      // `area` SELALU dibaca ulang dari database, TIDAK PERNAH meng-echo input
      // client. Bukan sekadar kerapian: kolom bertipe geometry(MultiPolygon,
      // 4326) meng-coerce Polygon yang dikirim client menjadi MultiPolygon
      // 1-bagian saat disimpan. Versi sebelumnya meng-echo input sehingga
      // membalas {"type":"Polygon"} padahal yang tersimpan MultiPolygon —
      // response melaporkan bentuk yang berbeda dari isi database. Satu query
      // ekstra per operasi tulis (jarang) adalah harga yang pantas untuk
      // response yang jujur.
      return ok(c, { ...row, area: await getAreaGeoJson(prisma, geo, id) })
    },
  )

  router.delete("/:id", requireRole(...write), async (c) => {
    const id = c.req.param("id")
    const existing = await delegate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError(entitas)
    await delegate.delete({ where: { id } })
    return ok(c, { id })
  })

  return router
}
