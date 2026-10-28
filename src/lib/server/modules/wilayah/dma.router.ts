// server/modules/wilayah/dma.router.ts — District Metered Area (NRW).
// Referensi murni, tanpa geometry sendiri (DMA di data saat ini baru berupa
// kode, belum ada batas area yang dipetakan).
import { z } from "zod"
import { prisma } from "@db"
import { createCrudRouter } from "../../lib/crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  kode: z.string().trim().min(1).max(50),
  nama: z.string().trim().min(1).max(150).optional(),
})

const updateSchema = createSchema.partial()

export const dmaRouter = createCrudRouter({
  entitas: "Dma",
  delegate: prisma.dma,
  createSchema,
  updateSchema,
  searchFields: ["nama", "kode"],
  orderBy: { kode: "asc" },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})
