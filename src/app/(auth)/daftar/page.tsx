// app/(auth)/daftar/page.tsx — /daftar, pendaftaran akun warga mandiri.
//
// Pola sama seperti /login (lihat FRONTEND.md): page tipis, guard sesi +
// redirect, rakit dari features/akun/.
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DaftarCard } from "@/features/akun/components/daftar-card"

export const metadata: Metadata = {
  title: "Daftar Akun",
  description:
    "Buat akun warga PERUMDA Tirtawening untuk memantau laporan pengaduan Anda",
}

export default async function DaftarPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams

  // Sudah punya sesi -> tidak ada gunanya melihat halaman daftar.
  const session = await auth()
  if (session?.user) redirect(callbackUrl ?? "/akun")

  return <DaftarCard callbackUrl={callbackUrl ?? "/akun"} />
}
