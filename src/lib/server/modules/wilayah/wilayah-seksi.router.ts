import { z } from "zod"
import { GEO } from "../../lib/spatial"
import { createGeoCrudRouter, geoJsonSchema } from "../../lib/geo-crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  kode: z.string().trim().min(1).max(50),
  nama: z.string().trim().min(1).max(150),
  wilayahDistId: z.string().min(1),
  area: geoJsonSchema.nullable().optional(),
})

const updateSchema = createSchema.partial()

export const wilayahSeksiRouter = createGeoCrudRouter({
  entitas: "WilayahSeksi",
  model: "wilayahSeksi",
  geo: GEO.wilayahSeksi,
  createSchema,
  updateSchema,
  searchFields: ["nama", "kode"],
  include: { wilayahDist: true },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})
