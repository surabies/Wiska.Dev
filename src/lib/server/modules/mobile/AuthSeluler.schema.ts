// server/modules/mobile/AuthSeluler.schema.ts — skema validasi Zod & tipe
// kontrak untuk autentikasi aplikasi seluler (Flutter).

import { z } from "zod"

export const loginSchema = z.object({
  /// Email ATAU username — akun hasil bootstrap/provision Google punya
  /// username null, jadi keduanya harus diterima (alasan yang sama dengan
  /// field `identifier` pada Credentials provider di auth.ts).
  identifier: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
})

export const googleSchema = z.object({ idToken: z.string().min(1) })

export type LoginMobileInput = z.infer<typeof loginSchema>
export type GoogleMobileInput = z.infer<typeof googleSchema>
