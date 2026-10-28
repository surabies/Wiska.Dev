"use client"

// components/layout/page/TabLembaran.tsx — tab bergaya map/buku catatan:
// tab menempel di tepi atas lembaran, tab aktif menyatu dengan isinya, dan
// isi bergeser halus saat berganti. Dipakai bersama oleh halaman yang
// memakai gaya ini supaya tampilannya seragam.
import * as React from "react"
import type { ReactNode } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "@/lib/utils"

export interface ItemTab<K extends string> {
  kunci: K
  label: string
  icon?: IconSvgElement
}

export function TabLembaran<K extends string>({
  label,
  tab,
  aktif,
  onGanti,
  className,
  panelClassName,
  children,
}: {
  label: string
  tab: ItemTab<K>[]
  aktif: K
  onGanti: (kunci: K) => void
  className?: string
  panelClassName?: string
  /** Isi tab yang sedang aktif. */
  children: ReactNode
}) {
  const id = React.useId()
  const [arah, setArah] = React.useState<1 | -1>(1)

  function pilih(kunci: K) {
    if (kunci === aktif) return
    const dari = tab.findIndex((t) => t.kunci === aktif)
    const ke = tab.findIndex((t) => t.kunci === kunci)
    setArah(ke > dari ? 1 : -1)
    onGanti(kunci)
  }

  function onKey(e: React.KeyboardEvent, i: number) {
    const geser = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0
    if (!geser) return
    e.preventDefault()
    const tujuan = tab[(i + geser + tab.length) % tab.length]!
    pilih(tujuan.kunci)
    document.getElementById(`${id}-tab-${tujuan.kunci}`)?.focus()
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div role="tablist" aria-label={label} className="relative z-10 flex shrink-0 items-end gap-1 px-4">
        {tab.map((t, i) => {
          const dipilih = t.kunci === aktif
          return (
            <button
              key={t.kunci}
              id={`${id}-tab-${t.kunci}`}
              type="button"
              role="tab"
              aria-selected={dipilih}
              aria-controls={`${id}-panel`}
              tabIndex={dipilih ? 0 : -1}
              onClick={() => pilih(t.kunci)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "relative -mb-px flex items-center gap-2 rounded-t-lg border border-b-0 px-4 text-sm font-medium outline-none",
                "transition-all duration-300 ease-out focus-visible:ring-2 focus-visible:ring-ring/50",
                dipilih
                  ? "h-10 border-border bg-card text-foreground"
                  : "h-9 border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t.icon && (
                <HugeiconsIcon
                  icon={t.icon}
                  strokeWidth={2}
                  className={cn("size-4 transition-opacity duration-300", !dipilih && "opacity-70")}
                  aria-hidden
                />
              )}
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card shadow-panel">
        <div
          key={aktif}
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${aktif}`}
          className={cn(
            "flex h-full min-h-0 flex-col animate-in fade-in-0 duration-300 ease-out motion-reduce:animate-none",
            arah === 1 ? "slide-in-from-right-4" : "slide-in-from-left-4",
            panelClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}