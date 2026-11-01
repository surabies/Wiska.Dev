"use client"

// Memasang navbar + footer landing hanya di halaman publik.
// Halaman lain (dashboard, login, dll.) dirender apa adanya tanpa navbar/footer landing.
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { SiteFooter } from "@/components/landing/KakiHalamanSitus"
import { SiteNavbar } from "@/components/landing/NavigasiSitus"
import { RUTE } from "@/lib/landing/Konten"

// Semua rute di RUTE kecuali dasbor petugas. Rute anak (mis. /berita/judul) ikut terhitung.
const RUTE_PUBLIK: string[] = Object.values(RUTE).filter(
  (r) => r !== RUTE.dasbor
)

function halamanPublik(pathname: string) {
  return (
    pathname === "/" ||
    RUTE_PUBLIK.some((r) => pathname === r || pathname.startsWith(`${r}/`))
  )
}

export function LandingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/"

  if (!halamanPublik(pathname)) return <>{children}</>

  return (
    <>
      <SiteNavbar />
      {/* flex-1 mendorong footer ke dasar halaman walau isinya pendek. */}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  )
}
