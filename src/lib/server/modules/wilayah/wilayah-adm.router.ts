// server/modules/wilayah/wilayah-adm.router.ts — level teratas hierarki
// wilayah operasional PDAM.
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

export const wilayahAdmRouter = createGeoCrudRouter({
  entitas: "WilayahAdm",
  model: "wilayahAdm",
  geo: GEO.wilayahAdm,
  createSchema,
  updateSchema,
  searchFields: ["nama", "kode"],
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})
