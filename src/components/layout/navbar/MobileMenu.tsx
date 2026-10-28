// components/layout/navbar/MobileMenu.tsx
// Tugas: ikon titik 3 + overlay layar penuh dengan transisi halus.
// Tidak lagi memakai Sheet: overlay dibuat sendiri agar logo tetap diam.
"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { mobileMenuLinks } from "@/config/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreVerticalIcon, Cancel01Icon } from "@hugeicons/core-free-icons"

export function MobileMenu() {
  // Tahap 1: state buka/tutup
  const [open, setOpen] = React.useState(false)

  // Tahap 2: saat terbuka, kunci scroll halaman & dengarkan tombol Escape
  React.useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    document.body.style.overflow = "hidden"

    // Cleanup: kembalikan seperti semula saat menutup
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = ""
    }
  }, [open])

  // Tahap 3: kalau layar dibesarkan ke desktop saat menu terbuka, tutup otomatis
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return (
    <>
      {/* Tahap 4: tombol titik 3 di navbar (pemicu) */}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="More options"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon
          icon={MoreVerticalIcon}
          strokeWidth={2}
          className="size-4"
        />
      </Button>

      {/* Tahap 5: overlay SELALU ada di halaman (tidak di-unmount),
          hanya diubah tampilannya lewat class. Inilah kunci transisi yang halus.
          - Tertutup: opacity-0 + invisible + pointer-events-none
          - Terbuka : opacity-100 + visible
          `inert` mencegah elemen di dalamnya bisa difokus saat tertutup. */}
      <div
        inert={!open}
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-50 bg-background lg:hidden",
          // transisi opacity 250ms; visibility ikut berubah di akhir saat menutup
          "transition-[opacity,visibility] duration-250 ease-out motion-reduce:transition-none",
          open
            ? "visible opacity-100"
            : "pointer-events-none invisible opacity-0",
        )}
      >
        {/* Tahap 6: baris atas. Ukuran & padding SAMA PERSIS dengan bar utama navbar
            (h-14, px-4, sm:px-6) agar logo & tombol X tepat menimpa posisi
            logo & titik 3 di bawahnya, sehingga terlihat DIAM. */}
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Link href="/" onClick={() => setOpen(false)} aria-label="Home">
            <Image src="/logo.png" alt="Logo" width={32} height={32} />
          </Link>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              className="size-4"
            />
          </Button>
        </div>

        {/* Tahap 7: daftar link. Tiap link bergeser turun sedikit sambil muncul,
            dengan jeda bertingkat (stagger) berdasarkan urutannya. */}
        <nav className="flex flex-col gap-5 px-4 pt-4 text-xl font-medium sm:px-6">
          {mobileMenuLinks.map((link, index) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setOpen(false)}
              {...(link.href.startsWith("http")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
              className={cn(
                "w-fit transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none",
                // Terbuka: posisi normal. Tertutup: naik 12px (-translate-y-3) & transparan.
                open ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
              )}
              style={{
                // Saat membuka: tiap link menunggu sedikit lebih lama dari sebelumnya.
                // Saat menutup: tanpa jeda, supaya menutup terasa cepat.
                transitionDelay: open ? `${80 + index * 40}ms` : "0ms",
              }}
            >
              {link.name}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
