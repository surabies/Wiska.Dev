import { z } from "zod"
import { StatusLaporanMandiri } from "@db"
import { paginationQuerySchema, sortQuery } from "../../../lib/Pagination"

export const listLaporanMandiriQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "periode",
    "standDilaporkan",
    "status",
    "nomorLangganan",
    "namaPelapor",
  ]),
  q: z.string().trim().min(1).optional(),
  status: z.enum(StatusLaporanMandiri).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  pelangganId: z.string().optional(),
  /// Rentang TANGGAL MASUK (createdAt), bukan periode: "kiriman warga hari
  /// ini / pekan ini". Keduanya inklusif dan boleh dipakai sendiri-sendiri.
  tanggalDari: z.string().trim().optional(),
  tanggalSampai: z.string().trim().optional(),
})

/// Ringkasan untuk halaman verifikasi: hitungan per status + daftar periode
/// yang punya data.
export const statsLaporanMandiriQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

export const createLaporanMandiriSchema = z.object({
  pelangganId: z.string().min(1),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  standDilaporkan: z.coerce.number().int().min(0),
  fotoUrl: z.url(),
  fotoPublicId: z.string().trim().min(1),
  nomorPelapor: z.string().trim().min(1).max(30),
  namaPelapor: z.string().trim().min(1).max(150),
})

export const verifyLaporanMandiriSchema = z.object({
  /// Stand yang sudah dicocokkan atau dikoreksi berdasarkan foto.
  standDilaporkan: z.coerce.number().int().min(0).optional(),
})

export const rejectLaporanMandiriSchema = z.object({
  alasanDitolak: z.string().trim().min(1).max(500),
})

export type ListLaporanMandiriQuery = z.infer<
  typeof listLaporanMandiriQuerySchema
>
export type StatsLaporanMandiriQuery = z.infer<
  typeof statsLaporanMandiriQuerySchema
>
export type CreateLaporanMandiriInput = z.infer<
  typeof createLaporanMandiriSchema
>
export type VerifyLaporanMandiriInput = z.infer<
  typeof verifyLaporanMandiriSchema
>
export type RejectLaporanMandiriInput = z.infer<
  typeof rejectLaporanMandiriSchema
>
