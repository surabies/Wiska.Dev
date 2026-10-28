// server/modules/organisasi/target-kinerja.router.ts — target kinerja
// bulanan/tahunan per wilayah distribusi & seksi catat.
import { z } from "zod"
import { prisma } from "@db"
import { createCrudRouter } from "../../lib/crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  tahun: z.coerce.number().int().min(2000).max(2100),
  bulan: z.coerce.number().int().min(1).max(12).nullable().optional(),
  targetKubikasi: z.coerce.number().min(0).optional(),
  targetSambunganBaru: z.coerce.number().int().min(0).optional(),
  seksiCaterId: z.string().min(1).nullable().optional(),
  wilayahDistId: z.string().min(1).nullable().optional(),
})

const updateSchema = createSchema.partial()

export const targetKinerjaRouter = createCrudRouter({
  entitas: "TargetKinerja",
  delegate: prisma.targetKinerja,
  createSchema,
  updateSchema,
  orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
  include: { seksiCater: true, wilayahDist: true },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.MANAGEMENT_UP,
})
