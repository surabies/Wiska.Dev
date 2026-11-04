"use client"

import { Search, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { PillButton } from "@/components/shared/PillButton"
import type { TicketEvent } from "@/types/home"

interface SearchExperienceProps {
  events: TicketEvent[]
}

const URL_LAYANAN: Record<string, string> = {
  "1": "/cek-tagihan",
  "2": "/lapor-meter",
  "3": "/pengaduan-air",
  "4": "/peta-pengaduan",
  "5": "/pasang-baru",
  "6": "/info-gangguan",
}

export function SearchExperience({ events }: SearchExperienceProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const activeTriggerRef = useRef<HTMLButtonElement>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase()

  const results = useMemo(() => {
    if (!normalizedQuery) return []

    return events.filter((event) =>
      [event.title, event.venue, event.city, event.date, event.price]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    )
  }, [events, normalizedQuery])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    inputRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        setQuery("")
        activeTriggerRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    setQuery("")
    activeTriggerRef.current?.focus()
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          activeTriggerRef.current = event.currentTarget
          setOpen(true)
        }}
        aria-label="Cari layanan"
        className="mx-4 hidden w-60 lg:w-72 shrink items-center gap-2 rounded-full bg-surface-muted px-3.5 py-2 text-left whitespace-nowrap text-ink-muted xl:flex"
      >
        <Search size={18} aria-hidden="true" className="shrink-0" />
        <span className="text-xs lg:text-sm truncate">Cari layanan, tagihan...</span>
      </button>

      <PillButton
        type="button"
        size="icon"
        aria-label="Cari layanan"
        onClick={(event) => {
          activeTriggerRef.current = event.currentTarget
          setOpen(true)
        }}
        className="ml-2 size-8 p-0 md:mx-2.5 lg:size-10 xl:hidden"
      >
        <Search size={20} aria-hidden="true" />
      </PillButton>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-4 pt-14 backdrop-blur-[4px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close()
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Cari layanan Tirtawening"
                className="mx-auto w-full max-w-[600px]"
              >
                <div className="flex h-11 items-center gap-3 rounded-full bg-white px-4 text-black shadow-lg">
                  <Search size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ketik nama layanan, tagihan, meter, gangguan..."
                    aria-label="Cari layanan"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                  />
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Tutup pencarian"
                    className="shrink-0 text-muted-foreground hover:text-black"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                {normalizedQuery ? (
                  <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-xl bg-white p-3 text-black shadow-2xl">
                    <h2 className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Hasil Pencarian
                    </h2>
                    {results.length > 0 ? (
                      <ul className="space-y-1">
                        {results.map((event) => {
                          const href = URL_LAYANAN[event.id] ?? "/cek-tagihan"
                          return (
                            <li key={event.id}>
                              <Link
                                href={href}
                                onClick={close}
                                className="flex min-h-14 items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
                              >
                                <div
                                  aria-hidden="true"
                                  className="size-11 shrink-0 rounded-md"
                                  style={{ backgroundColor: event.accentColor }}
                                />
                                <div className="min-w-0 text-xs leading-[1.4]">
                                  <p className="truncate font-bold text-sm text-foreground">
                                    {event.title}
                                  </p>
                                  <p className="truncate text-muted-foreground">
                                    {event.date} · {event.price}
                                  </p>
                                  <p className="truncate text-muted-foreground">
                                    {event.venue}, {event.city}
                                  </p>
                                </div>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        Tidak ada layanan yang cocok dengan kata kunci tersebut.
                      </p>
                    )}
                  </div>
                ) : null}
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
