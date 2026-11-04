import type { ReactNode } from "react"
import { cn } from "@/lib/Utilitas"

function IkonBawaan() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export function PanelDasbor({
  label,
  chip,
  deskripsi,
  ikon,
  tanpaPadding = false,
  className,
  children,
}: {
  label: string
  chip?: string
  deskripsi?: string
  ikon?: ReactNode
  tanpaPadding?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border/70 bg-muted/50 p-1 pt-0">
      <div className="flex h-9 items-center justify-between gap-3 px-2 text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          {ikon ?? <IkonBawaan />}
          <h2 className="truncate font-mono text-xs tracking-tight">{label}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {deskripsi && <p className="hidden text-xs sm:block">{deskripsi}</p>}
          {chip && (
            <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase">
              {chip}
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card",
          !tanpaPadding && "p-4 sm:p-5",
          className
        )}
      >
        {children}
      </div>
    </section>
  )
}
