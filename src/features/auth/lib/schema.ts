// features/auth/lib/schema.ts — aturan validasi form auth.
//
// Dipakai DUA sisi: komponen client (feedback cepat) dan server action
// (penegakan sesungguhnya). Validasi di client hanya demi UX — server
// TIDAK PERNAH mempercayainya dan selalu memvalidasi ulang dengan schema
// yang sama ini.
import { z } from "zod"

export const PANJANG_PASSWORD_MIN = 8

export const loginSchema = z.object({
  // "identifier", bukan "email": pengguna boleh mengetik email ATAU username
  // (lihat authorize() di auth.ts).
  identifier: z.string().trim().min(1, "Email atau username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
})

export const forgotPasswordSchema = z.object({
  email: z.email("Format email tidak valid").trim().toLowerCase(),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    email: z.email().trim().toLowerCase(),
    password: z
      .string()
      .min(PANJANG_PASSWORD_MIN, `Password minimal ${PANJANG_PASSWORD_MIN} karakter`)
      .max(100, "Password terlalu panjang"),
    konfirmasi: z.string(),
  })
  .refine((d) => d.password === d.konfirmasi, {
    message: "Konfirmasi password tidak sama",
    path: ["konfirmasi"],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
