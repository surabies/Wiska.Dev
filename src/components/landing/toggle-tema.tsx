"use client"

// Toggle tema berbentuk pil: Sistem / Terang / Gelap. Memakai next-themes.
import { ComputerIcon, Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

import { cn } from "@/lib/utils"

const PILIHAN = [
  { nilai: "system", label: "Ikuti sistem", ikon: ComputerIcon },
  { nilai: "light", label: "Tema terang", ikon: Sun01Icon },
  { nilai: "dark", label: "Tema gelap", ikon: Moon02Icon },
] as const

// true hanya di browser. Server dan render pertama false, supaya HTML server
// sama dengan hidrasi pertama (tema pilihan pengguna belum diketahui server).
const langgananKosong = () => () => {}
const diBrowser = () => true
const diServer = () => false

export function ToggleTema({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const siap = useSyncExternalStore(langgananKosong, diBrowser, diServer)

  return (
    <div
      role="radiogroup"
      aria-label="Pilih tema tampilan"
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5", className)}
    >
      {PILIHAN.map(({ nilai, label, ikon }) => {
        const aktif = siap && theme === nilai
        return (
          <button
            key={nilai}
            type="button"
            role="radio"
            aria-checked={aktif}
            aria-label={label}
            title={label}
            onClick={() => setTheme(nilai)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              aktif && "border border-border bg-card text-foreground shadow-xs",
            )}
          >
            <HugeiconsIcon icon={ikon} size={14} strokeWidth={1.8} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}