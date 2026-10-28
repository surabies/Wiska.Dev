// server/modules/organisasi/sub-bagian.router.ts — CRUD SubBagian (di
// bawah Bagian).
import { z } from "zod"
import { prisma } from "@db"
import { createCrudRouter } from "../../lib/crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  kode: z.string().trim().min(1).max(50),
  nama: z.string().trim().min(1).max(150),
  bagianId: z.string().min(1),
})

const updateSchema = createSchema.partial()

export const subBagianRouter = createCrudRouter({
  entitas: "SubBagian",
  delegate: prisma.subBagian,
  createSchema,
  updateSchema,
  searchFields: ["nama", "kode"],
  orderBy: { nama: "asc" },
  include: { bagian: { include: { divisi: true } } },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})
