// server/lib/audit.ts — pencatatan AuditLog untuk mutasi data sensitif
// (Pelanggan, Tagihan, role/status User, dst). DIPANGGIL DI DALAM
// prisma.$transaction yang sama dengan mutasi utamanya (bukan
// fire-and-forget) — kalau audit gagal ditulis, seluruh mutasi ikut
// rollback, supaya tidak pernah ada perubahan data tanpa jejak audit.
import type { Prisma } from "@db"

export interface AuditInput {
  userId: string | null
  aksi: string
  entitas: string
  entitasId?: string | null
  perubahan?: unknown
  ipAddress?: string | null
  userAgent?: string | null
}

export async function recordAudit(
  tx: Prisma.TransactionClient,
  input: AuditInput,
) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      aksi: input.aksi,
      entitas: input.entitas,
      entitasId: input.entitasId ?? null,
      perubahan:
        input.perubahan === undefined
          ? undefined
          : (input.perubahan as Prisma.InputJsonValue),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  })
}

/** Ambil ipAddress/userAgent dari Hono Context supaya pemanggilan
 * recordAudit() di service tidak perlu mengimpor Hono. */
export function auditMetaFromRequest(req: Request): {
  ipAddress: string | null
  userAgent: string | null
} {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
  const userAgent = req.headers.get("user-agent")
  return { ipAddress, userAgent }
}
