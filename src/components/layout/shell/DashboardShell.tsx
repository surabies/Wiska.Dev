"use client"

// Shell umum dashboard; route laporan memakai route group tersendiri.
import type { ReactNode } from "react"

import { cn } from "@/lib/Utilitas"
import { SidebarNav } from "../navigation/SidebarNav"
import { MAIN_CONTENT_ID } from "./KonstantaDashboardShell"

export { MAIN_CONTENT_ID } from "./KonstantaDashboardShell"

type DashboardShellProps = {
  children: ReactNode
  /** Halaman fluid (verifikasi, peta): tanpa sidebar, card selebar layar. */
  tanpaSidebar?: boolean
}

export function DashboardShell({
  children,
  tanpaSidebar = false,
}: DashboardShellProps) {
  return (
    <div
      className={cn(
        // Warna permukaan navbar + sidebar. Ganti di sini (dan di Navbar.tsx).
        "h-dvh overflow-hidden bg-muted pt-(--navbar-h)",
        // Tinggi navbar. Mobile = bar utama (h-14) + NavbarMobileBar (h-14) = 7rem.
        "[--navbar-h:3.5rem] max-lg:[--navbar-h:7rem]",
        "[--sidebar-w:15rem]"
      )}
    >
      {/* Lompat ke konten: muncul hanya saat menerima fokus keyboard */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className={cn(
          "sr-only focus-visible:not-sr-only",
          "focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50",
          "focus-visible:rounded-md focus-visible:bg-background focus-visible:px-3 focus-visible:py-2",
          "focus-visible:text-sm focus-visible:font-medium focus-visible:shadow-md",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        )}
      >
        Lewati ke konten utama
      </a>

      {/* Sidebar desktop: menempel di kiri, di-scroll sendiri.
          SidebarNav merender <nav aria-label="Menu utama">. */}
      {!tanpaSidebar && (
        <aside
          aria-label="Navigasi modul"
          className="fixed top-(--navbar-h) bottom-0 left-0 hidden w-(--sidebar-w) overflow-y-auto overscroll-contain px-3 py-6 lg:block"
        >
          <SidebarNav />
        </aside>
      )}

      {/* Ruang di sekitar card: kanan dan bawah sedikit renggang di desktop,
          di mobile card selebar layar. */}
      <div
        className={cn(
          "flex h-full min-h-0 flex-col lg:pr-2 lg:pb-2",
          tanpaSidebar ? "lg:pl-2" : "lg:pl-(--sidebar-w)"
        )}
      >
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background focus:outline-none lg:rounded-xl lg:border"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
