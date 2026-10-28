// server/modules/organisasi/bagian.router.ts — CRUD Bagian (di bawah
// Divisi). `levelKepala` murni dokumentatif (lihat komentar schema), tidak
// ditegakkan sebagai constraint di sini.
import { z } from "zod"
import { Role } from "@db"
import { prisma } from "@db"
import { createCrudRouter } from "../../lib/crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  kode: z.string().trim().min(1).max(50),
  nama: z.string().trim().min(1).max(150),
  levelKepala: z.enum(Role).optional(),
  divisiId: z.string().min(1),
})

const updateSchema = createSchema.partial()

export const bagianRouter = createCrudRouter({
  entitas: "Bagian",
  delegate: prisma.bagian,
  createSchema,
  updateSchema,
  searchFields: ["nama", "kode"],
  orderBy: { nama: "asc" },
  include: { divisi: true },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})
