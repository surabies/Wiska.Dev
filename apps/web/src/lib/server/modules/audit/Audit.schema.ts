// server/modules/audit/Audit.schema.ts — skema validasi Zod & tipe kontrak
// untuk pembacaan AuditLog.

import { z } from "zod"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["createdAt", "aksi", "entitas"]),
  userId: z.string().optional(),
  entitas: z.string().optional(),
  entitasId: z.string().optional(),
  aksi: z.string().optional(),
  dari: z.coerce.date().optional(),
  sampai: z.coerce.date().optional(),
})

export type ListAuditLogQuery = z.infer<typeof listQuerySchema>
