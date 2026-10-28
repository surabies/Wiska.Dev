// server/modules/organisasi/divisi.router.ts — CRUD Divisi (4 divisi utama
// PERUMDA: PELAYANAN, TEHNIK, UMUM, UTAMA). Struktur organisasi jarang
// berubah -> baca STAFF ke atas, tulis khusus ADMIN.
import { z } from "zod"
import { KodeDivisi } from "@db"
import { prisma } from "@db"
import { createCrudRouter } from "../../lib/crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  kode: z.enum(KodeDivisi),
  nama: z.string().trim().min(1).max(100),
})

const updateSchema = createSchema.partial()

export const divisiRouter = createCrudRouter({
  entitas: "Divisi",
  delegate: prisma.divisi,
  createSchema,
  updateSchema,
  searchFields: ["nama"],
  orderBy: { kode: "asc" },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})
