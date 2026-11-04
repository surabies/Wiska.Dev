// server/modules/impor/Impor.router.ts — endpoint HTTP tipis di atas
// Impor.service.ts untuk impor berkas sumber per batch.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok } from "../../lib/Respons"
import { batchPencatatanSchema, batchPemutusanSchema } from "./Impor.schema"
import * as service from "./Impor.service"

export const imporRouter = new Hono()

imporRouter.post(
  "/pencatatan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", batchPencatatanSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const hasil = await service.imporPencatatanBatch(
      c.req.valid("json"),
      requester
    )
    return ok(c, hasil)
  }
)

imporRouter.post(
  "/pemutusan",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", batchPemutusanSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const hasil = await service.imporPemutusanBatch(
      c.req.valid("json"),
      requester
    )
    return ok(c, hasil)
  }
)
