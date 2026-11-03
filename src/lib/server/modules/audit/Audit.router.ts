// server/modules/audit/audit.router.ts — AuditLog READ-ONLY.
// Sengaja tidak ada POST/PATCH/DELETE: baris audit hanya boleh lahir dari
// recordAudit() di dalam transaksi mutasi (server/lib/audit.ts). Jejak audit
// yang bisa ditulis/dihapus lewat API bukan jejak audit.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { ok, paginated } from "../../lib/Respons"
import { listQuerySchema } from "./Audit.schema"
import { listAuditLog, getAuditLogById } from "./Audit.service"

export const auditRouter = new Hono()

auditRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { data, meta } = await listAuditLog(query)
    return paginated(c, data, meta)
  }
)

auditRouter.get(
  "/:id",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  async (c) => {
    const row = await getAuditLogById(c.req.param("id"))
    return ok(c, row)
  }
)
