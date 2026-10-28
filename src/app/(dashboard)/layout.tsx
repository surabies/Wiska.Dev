// src/app/(dashboard)/layout.tsx
// Tugas: membungkus halaman dashboard dengan navbar, sidebar, dan card konten.
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { auth, signOut } from "@/lib/auth"
import { DashboardShell, Navbar } from "@/components/layout"
import { TooltipProvider } from "@/components/ui/tooltip"

async function keluar() {
  "use server"
  await signOut({ redirectTo: "/login" })
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await auth()

  // Navbar `fixed` dan `pt-(--navbar-h)` di shell selalu berpasangan,
  // jadi tanpa sesi halaman tidak boleh dirender.
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
        {/* DashboardShell sudah merender <main>; jangan dibungkus <main> lagi. */}
        <DashboardShell>{children}</DashboardShell>
      </TooltipProvider>
    </>
  )
}