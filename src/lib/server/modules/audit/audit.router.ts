// server/modules/audit/audit.router.ts — AuditLog READ-ONLY.
// Sengaja tidak ada POST/PATCH/DELETE: baris audit hanya boleh lahir dari
// recordAudit() di dalam transaksi mutasi (server/lib/audit.ts). Jejak audit
// yang bisa ditulis/dihapus lewat API bukan jejak audit.
import { Hono } from "hono"
import { z } from "zod"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { ok, paginated } from "../../lib/response"
import { NotFoundError } from "../../lib/errors"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"

export const auditRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["createdAt", "aksi", "entitas"]),
  userId: z.string().optional(),
  entitas: z.string().optional(),
  entitasId: z.string().optional(),
  aksi: z.string().optional(),
  dari: z.coerce.date().optional(),
  sampai: z.coerce.date().optional(),
})

auditRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      userId: query.userId,
      entitas: query.entitas,
      entitasId: query.entitasId,
      aksi: query.aksi,
      ...(query.dari || query.sampai
        ? { createdAt: { gte: query.dari, lte: query.sampai } }
        : {}),
    }
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { createdAt: "desc" }),
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ])
    return paginated(c, data, buildMeta(total, query))
  },
)

auditRouter.get(
  "/:id",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  async (c) => {
    const row = await prisma.auditLog.findUnique({
      where: { id: c.req.param("id") },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    if (!row) throw new NotFoundError("AuditLog")
    return ok(c, row)
  },
)
