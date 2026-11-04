"use client"

import { Search, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { PillButton } from "@/components/shared/PillButton"
import type { TicketEvent } from "@/types/home"

interface SearchExperienceProps {
  events: TicketEvent[]
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
      [event.title, event.venue, event.city, event.date]
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
        aria-label="Search events"
        className="ml-6 hidden w-max min-w-92.5 shrink-0 items-center gap-2 rounded-full bg-surface-muted px-4 py-3 text-left whitespace-nowrap text-ink-muted xl:flex"
      >
        <Search size={24} aria-hidden="true" />
        <span>Search by event, venue or city</span>
      </button>

      <PillButton
        type="button"
        size="icon"
        aria-label="Search events"
        onClick={(event) => {
          activeTriggerRef.current = event.currentTarget
          setOpen(true)
        }}
        className="ml-2 size-8 p-0 md:mx-2.5 lg:size-10 xl:hidden"
      >
        <Search size={24} aria-hidden="true" />
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
                aria-label="Search events"
                className="mx-auto w-full max-w-[600px]"
              >
                <div className="flex h-10 items-center gap-3 rounded-full bg-white px-4 text-black">
                  <Search size={18} aria-hidden="true" className="shrink-0" />
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by event, venue or city"
                    aria-label="Search by event, venue or city"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
                  />
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close search"
                    className="shrink-0 text-ink-muted"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                {normalizedQuery ? (
                  <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-md bg-white p-3 text-black shadow-lg">
                    <h2 className="mb-2 text-xs font-bold">Search results</h2>
                    {results.length > 0 ? (
                      <ul className="space-y-1">
                        {results.map((event) => (
                          <li
                            key={event.id}
                            className="flex min-h-14 items-center gap-3 rounded-sm p-1"
                          >
                            <div
                              aria-hidden="true"
                              className="size-12 shrink-0 rounded-sm"
                              style={{ backgroundColor: event.accentColor }}
                            />
                            <div className="min-w-0 text-xs leading-[1.4]">
                              <p className="truncate font-bold">
                                {event.title}
                              </p>
                              <p className="truncate text-ink-muted">
                                {event.date}
                              </p>
                              <p className="truncate text-ink-muted">
                                {event.venue}, {event.city}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="py-3 text-center text-xs text-ink-muted">
                        No events found
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
