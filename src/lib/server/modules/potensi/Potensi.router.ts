// server/modules/potensi/potensi.router.ts — prospek calon pelanggan hasil
// survei lapangan (titik rumah yang belum berlangganan).
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { ok, created, paginated } from "../../lib/Respons"
import {
  listQuerySchema,
  nearQuerySchema,
  createSchema,
  updateSchema,
} from "./Potensi.schema"
import * as service from "./Potensi.service"

export const potensiRouter = new Hono()

potensiRouter.get(
  "/near",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", nearQuerySchema),
  async (c) => {
    const data = await service.findPotensiNear(c.req.valid("query"))
    return ok(c, data)
  }
)

potensiRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { data, meta } = await service.listPotensi(query)
    return paginated(c, data, meta)
  }
)

potensiRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await service.getPotensiById(c.req.param("id"))
  return ok(c, row)
})

potensiRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createSchema),
  async (c) => {
    const row = await service.createPotensi(c.req.valid("json"))
    return created(c, row)
  }
)

potensiRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", updateSchema),
  async (c) => {
    const row = await service.updatePotensi(
      c.req.param("id"),
      c.req.valid("json")
    )
    return ok(c, row)
  }
)
