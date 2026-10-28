// app/(auth)/forgot-password/page.tsx — /forgot-password
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ForgotPasswordCard } from "@/features/auth/components/forgot-password-card"

export const metadata: Metadata = {
  title: "Lupa password",
  description: "Minta tautan untuk mengatur ulang password akun Anda",
}

export default async function ForgotPasswordPage() {
  // Sudah punya sesi -> tidak perlu mereset apa pun. Ganti password saat
  // sudah masuk nanti lewat halaman profil, bukan alur lupa-password.
  const session = await auth()
  if (session?.user) redirect("/")

  return <ForgotPasswordCard />
}
