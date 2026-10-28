// app/(auth)/login/page.tsx — halaman masuk (/login).
//
// POLA RUJUKAN untuk semua page berikutnya. Page bertanggung jawab HANYA
// pada urusan route:
//   1. metadata
//   2. membaca params/searchParams
//   3. guard sesi + redirect
//   4. merakit komponen dari features/
// Tampilan & aturan tampilnya ada di features/auth/. Jangan menaruh JSX
// panjang atau logika domain di file ini.
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { LoginCard } from "@/features/auth/components/login-card"

export const metadata: Metadata = {
  // Judul lengkap dirangkai template di app/layout.tsx -> "Masuk — PERUMDA Tirtawening"
  title: "Masuk",
  description: "Masuk ke dashboard operasional PERUMDA Tirtawening Kota Bandung",
}

// searchParams adalah Promise di Next.js 15+ (async request APIs) — WAJIB
// di-await, bukan diakses langsung.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}) {
  const { error, callbackUrl } = await searchParams

  // Sudah punya sesi -> tidak ada gunanya melihat halaman masuk.
  // Default "/dashboard" (BUKAN "/"): halaman ini khusus staf, lihat
  // metadata.description di atas — tanpa ini, login yang berhasil tanpa
  // ?callbackUrl= eksplisit mendarat di landing page publik, yang
  // header-nya tidak menampilkan status login sama sekali. Terlihat
  // seperti login gagal padahal sesinya sudah terbentuk.
  const session = await auth()
  if (session?.user) redirect(callbackUrl ?? "/dashboard")

  return <LoginCard error={error} callbackUrl={callbackUrl ?? "/dashboard"} />
}
