// components/layout/navigation/sidebar/NavRow.tsx
// Isi sebuah baris (ikon + teks + aksesori kanan) dan potongan kecil pendamping.
// Pembungkusnya (Link / button) tetap ditentukan pemanggil, dengan navRowClass().

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

export function NavRowContent({
  icon,
  iconClassName,
  trailing,
  children,
}: {
  icon: IconSvgElement
  iconClassName?: string
  trailing?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      {/* Ikon mewarisi warna teks (currentColor): ikut berubah saat hover/aktif. */}
      <HugeiconsIcon
        icon={icon}
        size={17}
        strokeWidth={1.6}
        className={cn("shrink-0", iconClassName)}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </>
  )
}

/** Panah kanan penanda baris yang membuka grup. */
export function RowChevron() {
  return (
    <HugeiconsIcon
      icon={ArrowRight01Icon}
      size={16}
      strokeWidth={1.8}
      className="shrink-0 text-sidebar-foreground/50 transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-sidebar-accent-foreground motion-reduce:transition-none"
      aria-hidden="true"
    />
  )
}

/** Garis pemisah antar bagian sidebar. */
export function RowSeparator() {
  return <div className="mx-2 my-2 h-px bg-sidebar-border" role="separator" />
}
