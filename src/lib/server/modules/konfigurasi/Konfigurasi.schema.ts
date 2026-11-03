// server/modules/konfigurasi/Konfigurasi.schema.ts — skema validasi Zod & tipe
// kontrak untuk modul konfigurasi operasional.

import { z } from "zod"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["kunci", "tipe", "isRahasia", "updatedAt"]),
  q: z.string().trim().min(1).optional(),
})

export const jendelaLaporMandiriSchema = z
  .object({
    tanggalBuka: z.number().int().min(1).max(28),
    tanggalTutup: z.number().int().min(1).max(28),
  })
  .refine((nilai) => nilai.tanggalBuka <= nilai.tanggalTutup, {
    message: "Tanggal buka tidak boleh melewati tanggal tutup.",
    path: ["tanggalBuka"],
  })

export const upsertSchema = z.object({
  nilai: z.string().min(1),
  deskripsi: z.string().max(500).nullable().optional(),
  tipe: z.string().min(1).max(20).optional(),
  isRahasia: z.boolean().optional(),
})

export type ListKonfigurasiQuery = z.infer<typeof listQuerySchema>
export type JendelaLaporMandiriInput = z.infer<typeof jendelaLaporMandiriSchema>
export type UpsertKonfigurasiInput = z.infer<typeof upsertSchema>
