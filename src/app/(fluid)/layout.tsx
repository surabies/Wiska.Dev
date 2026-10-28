// src/app/(fluid)/layout.tsx  (verifikasi, peta wilayah)
// Tugas: layout fluid. Bingkai dan card yang sama dengan dashboard,
// tetapi tanpa sidebar agar area konten selebar layar.
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { auth, signOut } from "@/lib/auth"
import { DashboardShell, Navbar } from "@/components/layout"
import { TooltipProvider } from "@/components/ui/tooltip"

async function keluar() {
  "use server"
  await signOut({ redirectTo: "/login" })
}

export default async function FluidLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await auth()

  if (!session?.user) redirect("/login")

  const { user } = session

  return (
    <>
      <Navbar
        user={{
          name: user.name ?? null,
          email: user.email ?? "",
          image: user.image ?? null,
          role: user.role,
        }}
        onKeluar={keluar}
      />

      <TooltipProvider delayDuration={100}>
        <DashboardShell tanpaSidebar>{children}</DashboardShell>
      </TooltipProvider>
    </>
  )
}