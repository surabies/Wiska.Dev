// server/modules/wilayah/kelurahan.router.ts — 3 dari 32 kelurahan di data
// sumber punya >1 bagian terpisah -> area WAJIB MultiPolygon (ditegakkan di
// level Postgres lewat kolom geometry(MultiPolygon, 4326), bukan di sini).
import { z } from "zod"
import { GEO } from "../../lib/spatial"
import { createGeoCrudRouter, geoJsonSchema } from "../../lib/geo-crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  kode: z.string().trim().min(1).max(50),
  nama: z.string().trim().min(1).max(150),
  kecamatanId: z.string().min(1),
  area: geoJsonSchema.nullable().optional(),
})

const updateSchema = createSchema.partial()

export const kelurahanRouter = createGeoCrudRouter({
  entitas: "Kelurahan",
  model: "kelurahan",
  geo: GEO.kelurahan,
  createSchema,
  updateSchema,
  searchFields: ["nama", "kode"],
  include: { kecamatan: true },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})
