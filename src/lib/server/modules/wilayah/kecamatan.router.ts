import { z } from "zod"
import { GEO } from "../../lib/spatial"
import { createGeoCrudRouter, geoJsonSchema } from "../../lib/geo-crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  kode: z.string().trim().min(1).max(50),
  nama: z.string().trim().min(1).max(150),
  area: geoJsonSchema.nullable().optional(),
})

const updateSchema = createSchema.partial()

export const kecamatanRouter = createGeoCrudRouter({
  entitas: "Kecamatan",
  model: "kecamatan",
  geo: GEO.kecamatan,
  createSchema,
  updateSchema,
  searchFields: ["nama", "kode"],
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})
