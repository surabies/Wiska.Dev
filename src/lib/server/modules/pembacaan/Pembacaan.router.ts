// server/modules/pembacaan/pembacaan.router.ts — PembacaanMeter resmi
// (hasil closing/verifikasi). Satu baris per meter per periode
// (@@unique([meterId, periode]) -> P2002 dipetakan jadi 409 oleh
// errorHandler).
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { ok, created, paginated } from "../../lib/Respons"
import {
  listPembacaanQuerySchema,
  createPembacaanSchema,
} from "./Pembacaan.schema"
import {
  listPembacaan,
  getPembacaanById,
  createPembacaan,
} from "./Pembacaan.service"

export const pembacaanRouter = new Hono()

pembacaanRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listPembacaanQuerySchema),
  async (c) => {
    const { data, meta } = await listPembacaan(c.req.valid("query"))
    return paginated(c, data, meta)
  }
)

pembacaanRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await getPembacaanById(c.req.param("id"))
  return ok(c, row)
})

pembacaanRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", createPembacaanSchema),
  async (c) => {
    const row = await createPembacaan(c.req.valid("json"))
    return created(c, row)
  }
)
