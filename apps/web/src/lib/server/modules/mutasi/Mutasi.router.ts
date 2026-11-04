// server/modules/mutasi/mutasi.router.ts — mutasi sambungan (PB = Pasang
// Baru, PK = Pindah Kontrak). @@unique([pelangganId, periode, jenis]) ->
// P2002 jadi 409 lewat errorHandler.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created, paginated } from "../../lib/Respons"
import { listQuerySchema, createSchema } from "./Mutasi.schema"
import * as service from "./Mutasi.service"

export const mutasiRouter = new Hono()

mutasiRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { data, meta } = await service.listMutasi(query)
    return paginated(c, data, meta)
  }
)

mutasiRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await service.getMutasiById(c.req.param("id"))
  return ok(c, row)
})

mutasiRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.createMutasi(
      c.req.valid("json"),
      requester,
      c.req.raw
    )
    return created(c, row)
  }
)
