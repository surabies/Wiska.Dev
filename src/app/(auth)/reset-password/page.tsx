// app/(auth)/reset-password/page.tsx — /reset-password?token=…&email=…
//
// Token diperiksa DI SERVER sebelum form dirender: pengguna dengan tautan
// kedaluwarsa langsung diberi tahu, bukan setelah mengetik password baru.
// Pemeriksaan ini tidak menggantikan validasi di server action — token
// diverifikasi ULANG di sana saat submit (di antara render dan submit,
// token bisa saja kedaluwarsa atau dipakai di tab lain).
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { tokenResetValid } from "@/features/auth/lib/password-reset"
import { ResetPasswordCard } from "@/features/auth/components/reset-password-card"

export const metadata: Metadata = {
  title: "Atur ulang password",
  description: "Buat password baru untuk akun Anda",
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>
}) {
  const session = await auth()
  if (session?.user) redirect("/")

  const { token, email } = await searchParams

  // Tanpa token/email sama sekali -> tidak ada yang bisa dikerjakan di sini.
  if (!token || !email) redirect("/forgot-password")

  const valid = await tokenResetValid(email, token)

  return <ResetPasswordCard token={token} email={email} tokenValid={valid} />
}
