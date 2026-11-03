import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { DashboardShell, Navbar } from "@/components/layout/index"
import { TooltipProvider } from "@/components/ui/tooltip"
import { auth, signOut } from "@/lib/auth/index"

async function keluar() {
  "use server"
  await signOut({ redirectTo: "/login" })
}

export default async function LaporanRootLayout({
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
        <DashboardShell>{children}</DashboardShell>
      </TooltipProvider>
    </>
  )
}
