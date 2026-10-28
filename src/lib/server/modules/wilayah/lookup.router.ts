// server/modules/wilayah/lookup.router.ts — reverse lookup titik-dalam-
// poligon: dari satu koordinat GPS, cari Kecamatan/Kelurahan/Zona mana yang
// mengandunginya. Convenience endpoint untuk form input Pelanggan/Pengaduan
// di frontend (bukan sumber kebenaran wajib — user tetap bisa override).
import { Hono } from "hono"
import { validate } from "../../lib/validate"
import { z } from "zod"
import { prisma } from "@db"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { ok } from "../../lib/response"
import { GEO, findContaining } from "../../lib/spatial"

export const wilayahLookupRouter = new Hono()

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

wilayahLookupRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", querySchema),
  async (c) => {
    const { lat, lng } = c.req.valid("query")
    const [kecamatanId, kelurahanId, zonaId] = await Promise.all([
      findContaining(prisma, GEO.kecamatan, lat, lng),
      findContaining(prisma, GEO.kelurahan, lat, lng),
      findContaining(prisma, GEO.zona, lat, lng),
    ])
    return ok(c, { kecamatanId, kelurahanId, zonaId })
  },
)
