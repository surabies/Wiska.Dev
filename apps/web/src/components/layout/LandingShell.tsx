"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { SiteFooter } from "@/components/layout/SiteFooter"
import { SiteHeader } from "@/components/layout/SiteHeader"

const RUTE_PUBLIK: string[] = [
  "/cek-tagihan",
  "/lapor-meter",
  "/pengaduan-air",
  "/info-gangguan",
  "/tarif-air",
  "/cara-pembayaran",
  "/pasang-baru",
  "/faq",
  "/profil",
  "/berita",
  "/kontak",
  "/kebijakan-privasi",
  "/syarat-ketentuan",
]

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
    <div className="flex min-h-screen flex-col bg-white text-black font-body">
      <SiteHeader />
      <main className="flex flex-1 flex-col pt-22 [&_.section-white+.section-white]:pt-0">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
