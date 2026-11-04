// server/modules/notifikasi/Notifikasi.schema.ts — skema validasi Zod & tipe
// kontrak untuk pendaftaran token perangkat FCM dan inbox notifikasi in-app.

import { z } from "zod"
import { paginationQuerySchema } from "../../lib/Pagination"

export const daftarTokenSchema = z.object({
  token: z.string().trim().min(1).max(4096),
  platform: z.enum(["android", "ios", "web"]).optional(),
})

export const hapusTokenSchema = z.object({
  token: z.string().trim().min(1).max(4096),
})

export const listQuerySchema = paginationQuerySchema.extend({
  belumDibaca: z.coerce.boolean().optional(),
})

export type DaftarTokenInput = z.infer<typeof daftarTokenSchema>
export type HapusTokenInput = z.infer<typeof hapusTokenSchema>
export type ListNotifikasiQuery = z.infer<typeof listQuerySchema>
