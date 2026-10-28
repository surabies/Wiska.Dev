// server/modules/organisasi/pencatat.router.ts — jembatan nama petugas
// lapangan (kd_petugas di CSV legacy) <-> akun User sistem.
//
// Penugasan Rute Baca Meter TIDAK lagi di sini (dulu kolom tunggal
// `Pencatat.ruteId`) — kini many-to-many berurut lewat modul penugasan-rute
// (/api/v1/penugasan-rute) + halaman Pemetaan Rute dashboard. Notifikasi
// "rute baru ditugaskan" dipicu di POST /penugasan-rute.
import { z } from "zod"
import { prisma } from "@db"
import { createCrudRouter } from "../../lib/crud-factory"
import { ROLE_GROUPS } from "../../middleware/rbac"

const createSchema = z.object({
  namaLapangan: z.string().trim().min(1).max(100),
  namaLengkap: z.string().trim().min(1).max(150).optional(),
  nip: z.string().trim().min(1).max(30).optional(),
  aliasLain: z.string().max(1000).optional(),
  userId: z.string().min(1).optional(),
  /// Jenis pekerjaan lapangan. Perannya di sistem tetap PELAKSANA — yang
  /// berbeda adalah penugasan dan cakupan datanya (penyelia anomali tidak
  /// dibatasi rute). Lihat catatan pada model Pencatat.
  jenisTugas: z.enum(["PENCATAT_METER", "PENYELIA_ANOMALI"]).optional(),
  isAktif: z.boolean().optional(),
})

const updateSchema = createSchema.partial()

export const pencatatRouter = createCrudRouter({
  entitas: "Pencatat",
  delegate: prisma.pencatat,
  createSchema,
  updateSchema,
  searchFields: ["namaLapangan", "namaLengkap", "nip"],
  orderBy: { namaLapangan: "asc" },
  include: {
    user: { select: { id: true, name: true, email: true, role: true } },
    _count: { select: { penugasanRute: true } },
  },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.SUPERVISOR_UP,
})
