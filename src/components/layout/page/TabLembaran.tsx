"use client"

// components/layout/page/TabLembaran.tsx — tab bergaya map/buku catatan:
// tab menempel di tepi atas lembaran, tab aktif menyatu dengan isinya, dan
// isi bergeser halus saat berganti. Dipakai bersama oleh halaman yang
// memakai gaya ini supaya tampilannya seragam.
import * as React from "react"
import type { ReactNode } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "@/lib/Utilitas"
import { useAreaTinggiLayar } from "./AreaTinggiLayar"

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
  tabListClassName,
  tinggiLayar = false,
  kerangkaHalaman = false,
  transisi = true,
  warnaTab = "transparan",
  warnaTabAktif = "card",
  warnaTabTidakAktif = "standar",
  children,
}: {
  label: string
  tab: ItemTab<K>[]
  aktif: K
  onGanti: (kunci: K) => void
  className?: string
  panelClassName?: string
  tabListClassName?: string
  /** Isi ruang layar yang tersedia di bawah header halaman. */
  tinggiLayar?: boolean
  /** Jadikan komponen kerangka halaman tanpa bingkai panel tambahan. */
  kerangkaHalaman?: boolean
  /** Aktifkan animasi saat tab berganti. */
  transisi?: boolean
  /** Warna latar baris tab; pertahankan transparan agar mengikuti parent. */
  warnaTab?: "muted" | "transparan"
  /** Warna tab aktif; default mengikuti permukaan card lama. */
  warnaTabAktif?: "card" | "background"
  /** Variasi kontras tab tidak aktif pada halaman yang memakai bar muted. */
  warnaTabTidakAktif?: "standar" | "lebihGelap"
  /** Isi tab yang sedang aktif. */
  children: ReactNode
}) {
  const id = React.useId()
  const [arah, setArah] = React.useState<1 | -1>(1)
  const ref = useAreaTinggiLayar()

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
    <div
      ref={tinggiLayar ? ref : undefined}
      className={cn(
        "flex flex-col",
        kerangkaHalaman && "w-full min-w-0",
        tinggiLayar && "min-h-90",
        className
      )}
    >
      {tab.length > 0 && (
        <div
          role="tablist"
          aria-label={label}
          className={cn(
            "relative z-10 flex shrink-0 items-end gap-1 px-0 border-b border-border",
            warnaTab === "muted" && "bg-muted",
            tabListClassName
          )}
        >
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
                  "relative -mb-px flex items-center gap-2 border border-b-0 px-4 text-sm font-medium outline-none",
                  i === 0 ? "rounded-tl-none rounded-tr-lg" : "rounded-t-lg",
                  kerangkaHalaman && i === 0 && "border-l-0",
                  transisi && "transition-all duration-300 ease-out",
                  "focus-visible:ring-2 focus-visible:ring-ring/50",
                  dipilih
                    ? cn(
                        "h-10 border-border font-medium text-foreground",
                        warnaTabAktif === "card" ? "bg-card" : "bg-background"
                      )
                    : cn(
                        "h-9 border-transparent text-muted-foreground hover:text-foreground",
                        warnaTabTidakAktif === "lebihGelap"
                          ? "bg-black/5 hover:bg-black/10 dark:bg-black/20 dark:hover:bg-black/30"
                          : "bg-muted/60 hover:bg-muted"
                      )
                )}
              >
                {t.icon && (
                  <HugeiconsIcon
                    icon={t.icon}
                    strokeWidth={2}
                    className={cn(
                      "size-4 shrink-0",
                      transisi && "transition-all duration-300",
                      !dipilih && "opacity-70"
                    )}
                    aria-hidden
                  />
                )}
                {t.label}
              </button>
            )
          })}
        </div>
      )}

      <div
        className={cn(
          "relative min-h-0 min-w-0 flex-1 overflow-hidden bg-background",
          !kerangkaHalaman &&
            "rounded-lg rounded-tl-none border border-border bg-card shadow-panel"
        )}
      >
        <div
          key={transisi ? aktif : undefined}
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={tab.length > 0 ? `${id}-tab-${aktif}` : undefined}
          className={cn(
            "flex h-full min-h-0 flex-col",
            transisi &&
              "animate-in duration-300 ease-out fade-in-0 motion-reduce:animate-none",
            transisi &&
              (arah === 1 ? "slide-in-from-right-4" : "slide-in-from-left-4"),
            panelClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
