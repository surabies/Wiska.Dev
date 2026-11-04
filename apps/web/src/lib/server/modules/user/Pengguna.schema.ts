import { z } from "zod"
import { JenisAkun, Role, UserStatus } from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "name",
    "username",
    "email",
    "role",
    "status",
    "jenisAkun",
    "jabatan",
    "nik",
    "nip",
    "nomorPelanggan",
    "divisiKode",
    "lastLoginAt",
  ]),
  q: z.string().trim().min(1).optional(),
  role: z.enum(Role).optional(),
  status: z.enum(UserStatus).optional(),
  jenisAkun: z.enum(JenisAkun).optional(),
  divisiId: z.string().optional(),
})

export const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.email(),
  username: z.string().trim().min(3).max(50).nullable().optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(Role).optional(),
  status: z.enum(UserStatus).optional(),
  jenisAkun: z.enum(JenisAkun).optional(),
  nik: z.string().trim().min(1).max(30).nullable().optional(),
  nip: z.string().trim().min(1).max(30).nullable().optional(),
  nomorPelanggan: z.string().trim().min(1).max(30).nullable().optional(),
  jabatan: z.string().trim().min(1).max(100).nullable().optional(),
  telepon: z.string().trim().min(1).max(30).nullable().optional(),
  divisiId: z.string().min(1).nullable().optional(),
  bagianId: z.string().min(1).nullable().optional(),
  subBagianId: z.string().min(1).nullable().optional(),
})

// role & status TIDAK ada di sini — keduanya punya endpoint sendiri supaya
// selalu lewat pengecekan self-modification + audit khusus.
export const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  email: z.email().optional(),
  username: z.string().trim().min(3).max(50).nullable().optional(),
  image: z.url().nullable().optional(),
  jenisAkun: z.enum(JenisAkun).optional(),
  nik: z.string().trim().min(1).max(30).nullable().optional(),
  nip: z.string().trim().min(1).max(30).nullable().optional(),
  nomorPelanggan: z.string().trim().min(1).max(30).nullable().optional(),
  jabatan: z.string().trim().min(1).max(100).nullable().optional(),
  telepon: z.string().trim().min(1).max(30).nullable().optional(),
  divisiId: z.string().min(1).nullable().optional(),
  bagianId: z.string().min(1).nullable().optional(),
  subBagianId: z.string().min(1).nullable().optional(),
})

export const updateRoleSchema = z.object({
  role: z.enum(Role),
})

export const updateStatusSchema = z.object({
  status: z.enum(UserStatus),
})

export const passwordSchema = z.object({
  /// Wajib untuk ganti password sendiri. SUPER_ADMIN yang me-reset password
  /// orang lain tidak perlu tahu password lama.
  passwordLama: z.string().min(1).optional(),
  passwordBaru: z.string().min(8).max(100),
})

export type ListPenggunaQuery = z.infer<typeof listQuerySchema>
export type CreatePenggunaInput = z.infer<typeof createSchema>
export type UpdatePenggunaInput = z.infer<typeof updateSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
export type PasswordInput = z.infer<typeof passwordSchema>
