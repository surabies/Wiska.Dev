import { z } from "zod"
import { geoJsonSchema } from "../../lib/GeoCrudFactory"
import { paginationQuerySchema } from "../../lib/Pagination"

export const createSchema = z.object({
  kode: z.string().trim().min(1).max(50),
  noUrut: z.coerce.number().int().min(0).nullable().optional(),
  seksiCaterId: z.string().min(1),
  area: geoJsonSchema.nullable().optional(),
})

export const updateSchema = createSchema.partial()

// ── Daftar pelanggan terurut dalam satu rute ───────────────────────────
export const urutanPelangganListSchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
})

// Urutan kunjungan pelanggan DALAM satu rute (Pelanggan.noUrutRute) — diatur
// dari halaman Pemetaan Rute dashboard. `pelangganIds` = urutan baru; tiap
// pelanggan diberi noUrutRute sesuai indeks (1-based). Dibaca mobile lewat
// pengurutan di rute-saya.
export const urutanPelangganSchema = z.object({
  pelangganIds: z.array(z.string().min(1)).min(1).max(50000),
})

export type CreateRuteInput = z.infer<typeof createSchema>
export type UpdateRuteInput = z.infer<typeof updateSchema>
export type UrutanPelangganListQuery = z.infer<typeof urutanPelangganListSchema>
export type UrutanPelangganInput = z.infer<typeof urutanPelangganSchema>
