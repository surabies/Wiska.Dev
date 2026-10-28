import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Seksi({
  judul,
  deskripsi,
  chip,
  className,
  children,
}: {
  judul: string
  deskripsi?: string
  chip?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{judul}</h3>
          {deskripsi && <p className="mt-0.5 text-xs text-muted-foreground">{deskripsi}</p>}
        </div>
        {chip && (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
            {chip}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}
