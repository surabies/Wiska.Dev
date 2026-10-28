// components/layout/navigation/MobileSidebar.tsx
// Tugas: panel menu (sidebar) untuk mobile, muncul di bawah bar kedua navbar.
// Isi menunya sama dengan sidebar desktop (SidebarNav), jadi selalu sinkron.
// State buka/tutup dipegang induknya (NavbarMobileBar), dikirim lewat props.
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { SidebarNav } from "./SidebarNav"

export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  // Tahap 1: saat terbuka, kunci scroll halaman & dengarkan tombol Escape
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  // Tahap 2: kalau layar dibesarkan ke desktop saat panel terbuka, tutup otomatis
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) onClose()
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [onClose])

  return (
    // `top-28` = 7rem = tinggi bar utama (h-14) + bar kedua (h-14).
    // Panel SELALU ada di halaman, hanya diubah tampilannya (transisi halus).
    <div
      inert={!open}
      aria-hidden={!open}
      className={cn(
        "fixed inset-x-0 top-28 bottom-0 overflow-y-auto overscroll-contain bg-background px-4 py-6 sm:px-6 lg:hidden",
        "transition-[opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
        open
          ? "visible opacity-100"
          : "pointer-events-none invisible opacity-0",
      )}
    >
      <SidebarNav />
    </div>
  )
}
