// server/modules/audit/Audit.service.ts — kueri pembacaan AuditLog READ-ONLY.

import { prisma } from "@db"
import { NotFoundError } from "../../lib/Galat"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import type { ListAuditLogQuery } from "./Audit.schema"

export async function listAuditLog(query: ListAuditLogQuery) {
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
  return { data, meta: buildMeta(total, query) }
}

export async function getAuditLogById(id: string) {
  const row = await prisma.auditLog.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!row) throw new NotFoundError("AuditLog")
  return row
}
