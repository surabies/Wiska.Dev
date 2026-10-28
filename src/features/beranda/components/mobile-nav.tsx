"use client"

import * as React from "react"
import Link from "next/link"
import { Menu } from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { TombolPasang } from "@/components/pwa/tombol-pasang"
import { NAV_LAYANAN } from "./nav-links"

export function MobileNav({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string
  ctaLabel: string
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Buka menu navigasi">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 gap-0 p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-sm font-semibold">PERUMDA Tirtawening</SheetTitle>
          <SheetDescription className="text-xs">
            Layanan pelanggan air minum Kota Bandung
          </SheetDescription>
        </SheetHeader>

        <nav aria-label="Navigasi layanan" className="flex flex-col px-2 py-3">
          {NAV_LAYANAN.map((item) =>
            item.nonaktif ? (
              <span
                key={item.href}
                aria-disabled="true"
                title="Sementara tidak tersedia"
                className="flex cursor-not-allowed flex-col gap-0.5 px-3 py-3 opacity-50"
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">Sementara tidak tersedia</span>
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="group flex flex-col gap-0.5 rounded-md px-3 py-3 transition-colors hover:bg-accent"
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.deskripsi}</span>
              </Link>
            )
          )}
        </nav>

        <div className="border-t border-border px-2 py-2">
          <TombolPasang bentuk="menu" onSesudah={() => setOpen(false)} />
        </div>

        <div className="mt-auto border-t border-border px-5 py-4">
          <Button asChild className="h-10 w-full">
            <Link href={ctaHref} onClick={() => setOpen(false)}>
              {ctaLabel}
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
