import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/layout/index"
import { SidebarNav } from "@/components/layout/navigation/SidebarNav"
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
        <aside
          aria-label="Navigasi modul"
          className="fixed top-14 bottom-0 left-0 hidden w-60 overflow-y-auto overscroll-contain bg-muted px-3 py-6 lg:block"
        >
          <SidebarNav />
        </aside>
        <main className="fixed top-14 right-0 bottom-0 left-60 overflow-auto bg-background max-lg:inset-x-0 max-lg:top-28">
          {children}
        </main>
      </TooltipProvider>
    </>
  )
}
