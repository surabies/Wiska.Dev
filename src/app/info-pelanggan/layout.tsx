// src/app/(penuh)/layout.tsx  (info-pelanggan)
// Tugas: layout layar penuh — TANPA navbar dan TANPA sidebar, supaya halaman
// memakai seluruh tinggi & lebar layar. Tetap menjaga sesi: pengguna yang
// belum login diarahkan ke /login, sama seperti layout (fluid).
// Route group tidak mengubah URL: halamannya tetap /info-pelanggan.
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { TooltipProvider } from "@/components/ui/tooltip"

export default async function LayoutPenuh({
  children,
}: {
  children: ReactNode
}) {
  const session = await auth()

  if (!session?.user) redirect("/login")

  return (
    <TooltipProvider delayDuration={100}>
      <main className="flex h-dvh min-h-0 flex-col bg-background">
        {children}
      </main>
    </TooltipProvider>
  )
}
