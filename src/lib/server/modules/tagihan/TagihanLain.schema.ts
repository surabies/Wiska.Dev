// server/modules/tagihan/TagihanLain.schema.ts — skema validasi input untuk
// pungutan non-air insidental (pasang baru, balik nama, ganti meter, denda, buka segel).
import { z } from "zod"
import { JenisTagihanLain, StatusTagihan } from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listTagihanLainQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["createdAt", "jenis", "jumlah", "status", "tanggalJatuhTempo"]),
  pelangganId: z.string().optional(),
  status: z.enum(StatusTagihan).optional(),
  jenis: z.enum(JenisTagihanLain).optional(),
})

export type ListTagihanLainQuery = z.infer<typeof listTagihanLainQuerySchema>

export const createTagihanLainSchema = z.object({
  pelangganId: z.string().min(1),
  jenis: z.enum(JenisTagihanLain),
  deskripsi: z.string().trim().min(1).max(500),
  jumlah: z.coerce.number().int().min(1),
  tanggalJatuhTempo: z.coerce.date(),
})

export type CreateTagihanLainInput = z.infer<typeof createTagihanLainSchema>

// Sama seperti Tagihan: pelunasan hanya lewat modul pembayaran.
export const patchTagihanLainStatusSchema = z.object({
  status: z.enum(["DIHAPUSKAN", "JATUH_TEMPO", "BELUM_BAYAR"]),
  catatan: z.string().trim().min(1).max(500),
})

export type PatchTagihanLainStatusInput = z.infer<
  typeof patchTagihanLainStatusSchema
>
