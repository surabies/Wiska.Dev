import { z } from "zod"
import { GEO } from "../../lib/spatial"
import { createGeoCrudRouter, geoJsonSchema } from "../../lib/geo-crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  kode: z.string().trim().min(1).max(50),
  nama: z.string().trim().min(1).max(150),
  wilayahSeksiId: z.string().min(1),
  area: geoJsonSchema.nullable().optional(),
})

const updateSchema = createSchema.partial()

export const zonaRouter = createGeoCrudRouter({
  entitas: "Zona",
  model: "zona",
  geo: GEO.zona,
  createSchema,
  updateSchema,
  searchFields: ["nama", "kode"],
  include: { wilayahSeksi: true },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})
