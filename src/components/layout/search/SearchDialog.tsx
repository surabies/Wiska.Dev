// components/layout/search/SearchDialog.tsx
// Tugas: tampilan modal pencarian (desktop & mobile) + navigasi keyboard.
// State buka/tutup dipegang oleh induknya (NavbarSearch), dikirim lewat props.
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { searchDocs } from "@/lib/search-data"
import { Highlight } from "./Highlight"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

export function SearchDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  // Tahap 1: state kata kunci & item yang sedang dipilih (disorot biru)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)

  // Tahap 2: reset input SAAT dialog dibuka (tanpa setState di useEffect)
  const [prevOpen, setPrevOpen] = React.useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setQuery("")
      setActiveIndex(0)
    }
  }

  // Tahap 3: hitung hasil. `flat` = daftar datar, dipakai untuk navigasi panah.
  const groups = searchDocs(query)
  const flat = groups.flatMap((g) => g.results)

  // Nomor awal tiap grup, supaya indeks global cocok dengan activeIndex
  const groupsWithStart = groups.map((group, groupIndex) => ({
    group,
    start: groups
      .slice(0, groupIndex)
      .reduce((total, g) => total + g.results.length, 0),
  }))

  // Tahap 4: saat dialog dibuka -> fokus ke input
  React.useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Tahap 5: Escape menutup dialog + kunci scroll halaman saat terbuka
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

  // Tahap 6: saat item aktif berubah, scroll daftar agar item itu tetap terlihat
  React.useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  // Tahap 7: buka halaman tujuan lalu tutup dialog
  const goTo = (href: string) => {
    router.push(href)
    onClose()
  }

  // Tahap 8: navigasi keyboard di input: panah atas/bawah & Enter
  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (flat.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % flat.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      goTo(flat[activeIndex].href)
    }
  }

  return (
    // Overlay: abu-abu transparan + blur. Klik area kosong = tutup.
    <div
      inert={!open}
      aria-hidden={!open}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center px-3 pt-[8vh] sm:px-4 sm:pt-[10vh]",
        "bg-black/20 backdrop-blur-sm",
        "transition-[opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
        open
          ? "visible opacity-100"
          : "pointer-events-none invisible opacity-0",
      )}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cari menu"
        className={cn(
          "flex max-h-[80dvh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-background shadow-2xl ring-1 ring-black/5",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          open ? "scale-100" : "scale-[0.98]",
        )}
      >
        {/* ===== Baris input ===== */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="size-4 shrink-0 text-muted-foreground"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Cari menu atau halaman"
            className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pencarian"
            className="rounded-md border bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            esc
          </button>
        </div>

        {/* ===== Badan hasil (bisa di-scroll) ===== */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {query.trim() === "" && (
            <p className="px-4 py-14 text-center text-sm text-muted-foreground">
              Ketik untuk mencari menu
            </p>
          )}

          {query.trim() !== "" && flat.length === 0 && (
            <p className="px-4 py-14 text-center text-sm text-muted-foreground">
              Tidak ada hasil untuk &ldquo;{query}&rdquo;
            </p>
          )}

          {groupsWithStart.map(({ group, start }) => (
            <section key={group.category} className="px-4 pt-5 pb-2 sm:px-6">
              <h3 className="mb-3 text-sm font-semibold">{group.category}</h3>

              <div className="space-y-2">
                {group.results.map((entry, i) => {
                  const index = start + i
                  const isActive = index === activeIndex

                  return (
                    <button
                      key={entry.href}
                      type="button"
                      data-active={isActive}
                      onClick={() => goTo(entry.href)}
                      onMouseMove={() => setActiveIndex(index)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-lg px-4 py-3 text-left transition-colors",
                        isActive
                          ? "bg-sky-500 text-white [&_mark]:text-white"
                          : "bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md border text-sm",
                          isActive
                            ? "border-white/30 bg-white/10 text-white"
                            : "bg-background text-muted-foreground",
                        )}
                      >
                        #
                      </span>

                      {/* Nama menu (kecil, tebal) + deskripsi (sorot kata cocok) */}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">
                          <Highlight text={entry.page} query={query} />
                        </span>
                        <span className="mt-0.5 block truncate text-sm">
                          <Highlight text={entry.title} query={query} />
                        </span>
                      </span>

                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        className="size-4 shrink-0 opacity-70"
                      />
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {/* ===== Footer ===== */}
        <div className="shrink-0 border-t px-4 py-3 text-right text-xs text-muted-foreground sm:px-6">
          Cari berdasarkan nama menu
        </div>
      </div>
    </div>
  )
}
