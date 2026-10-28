// components/layout/navigation/sidebar/SidebarSearch.tsx
// Kotak "Cari menu" di puncak sidebar (pengganti NavbarSearch).
// Tugas: tombol pemicu + shortcut Ctrl/Cmd+K. Dialog-nya tetap SearchDialog.

"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { SearchDialog } from "@/components/layout/search/SearchDialog"
import { FOCUS_RING } from "./types/styles"
import { useIsClient } from "./types/useIsClient"
import { useIsMac } from "./types/useIsMac"
import { cn } from "@/lib/utils"

export function SidebarSearch() {
  // Tahap 1: state buka/tutup + ref tombol (untuk cek sidebar ini terlihat atau tidak)
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const isMac = useIsMac()
  const isClient = useIsClient()

  // Tahap 2: useCallback agar `close` tidak berubah tiap render
  const close = React.useCallback(() => setOpen(false), [])

  // Tahap 3: shortcut Ctrl/Cmd+K
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return

      // Sidebar tersembunyi (display:none, mis. di layar kecil) -> abaikan,
      // supaya sidebar kedua yang terlihat tidak ikut membuka dialog ganda.
      if (!triggerRef.current?.getClientRects().length) return

      e.preventDefault()
      setOpen((prev) => !prev)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Cari menu"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-control w-full items-center gap-2 rounded-lg border border-sidebar-border bg-card px-2.5 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-hover",
          FOCUS_RING,
        )}
      >
        <HugeiconsIcon
          icon={Search01Icon}
          size={16}
          strokeWidth={1.8}
          className="shrink-0"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">Cari menu...</span>
        <kbd className="inline-flex h-5 shrink-0 items-center rounded border border-sidebar-border bg-sidebar px-1.5 font-sans text-xs text-sidebar-foreground">
          {isMac ? "⌘K" : "Ctrl\u00a0K"}
        </kbd>
      </button>

      {/* Dialog dipindah ke <body> lewat portal. Tanpa ini ia ikut terkunci di
          lapisan z-index sidebar dan tertimpa konten halaman. Pembungkus z-[100]
          menjamin dialog selalu di atas navbar (z-10) dan isi halaman. */}
      {isClient &&
        createPortal(
          <div className="relative z-100">
            <SearchDialog open={open} onClose={close} />
          </div>,
          document.body,
        )}
    </>
  )
}