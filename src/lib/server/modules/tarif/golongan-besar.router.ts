// server/modules/tarif/golongan-besar.router.ts — instansi/perusahaan
// golongan besar (bank, militer, korporat). Tabel referensi terbuka (bukan
// enum) karena daftarnya bisa bertambah kapan saja.
import { z } from "zod"
import { prisma } from "@db"
import { createCrudRouter } from "../../lib/crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  kode: z.string().trim().min(1).max(50),
  nama: z.string().trim().min(1).max(150),
})

const updateSchema = createSchema.partial()

export const golonganBesarRouter = createCrudRouter({
  entitas: "GolonganBesar",
  delegate: prisma.golonganBesar,
  createSchema,
  updateSchema,
  searchFields: ["nama", "kode"],
  orderBy: { nama: "asc" },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})
