// components/layout/navbar/NavbarSearch.tsx
// Tugas: tombol pemicu + shortcut Ctrl/Cmd+K. Tampilan dialog diserahkan ke SearchDialog.
"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { SearchDialog } from "../search/SearchDialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"

// Deteksi Mac tanpa setState di effect.
// - server: selalu false (supaya HTML server = HTML awal client, tanpa hydration error)
// - client: dibaca dari userAgent, React otomatis render ulang bila hasilnya beda
const subscribe = () => () => {}
const getIsMac = () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
const getIsMacServer = () => false

export function NavbarSearch() {
  // Tahap 1: state buka/tutup
  const [open, setOpen] = React.useState(false)
  const isMac = React.useSyncExternalStore(subscribe, getIsMac, getIsMacServer)

  // Tahap 2: useCallback agar fungsi `close` tidak berubah tiap render
  const close = React.useCallback(() => setOpen(false), [])

  // Tahap 3: shortcut Ctrl/Cmd+K
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      {/* Tombol ikon: mobile */}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Cari menu"
        className="lg:hidden"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" />
      </Button>

      {/* Tombol desktop: class & SVG disalin dari hasil inspeksi tailwindcss.com */}
      <button
        type="button"
        aria-label="Cari menu"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full bg-gray-950/2 px-2 py-1 inset-ring inset-ring-gray-950/8 max-lg:hidden dark:bg-white/5 dark:inset-ring-white/2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="-ml-0.5 size-4 fill-gray-600 dark:fill-gray-500"
        >
          <path
            fillRule="evenodd"
            d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
            clipRule="evenodd"
          />
        </svg>
        <kbd className="font-sans text-xs/4 text-gray-500 dark:text-gray-400">
          {isMac ? "⌘K" : "Ctrl\u00a0K"}
        </kbd>
      </button>

      <SearchDialog open={open} onClose={close} />
    </>
  )
}
