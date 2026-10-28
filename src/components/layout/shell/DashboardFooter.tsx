// components/layout/shell/DashboardFooter.tsx
// Footer bergaya status bar: kondisi sistem (+ waktu sinkron bila ada) di kiri,
// versi + hak cipta instansi di kanan. Kredit pembuat ditaruh di dialog "Tentang".
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type SystemStatus = "normal" | "degraded" | "offline" | "unknown"

const STATUS: Record<SystemStatus, { label: string; dot: string }> = {
  normal: { label: "Sistem normal", dot: "bg-emerald-500" },
  degraded: { label: "Sistem terganggu", dot: "bg-amber-500" },
  offline: { label: "Sistem tidak tersedia", dot: "bg-red-500" },
  unknown: { label: "Status belum diketahui", dot: "bg-muted-foreground/50" },
}

export type DashboardFooterProps = {
  /** Dari health check nyata. Kosong / tak dikenal = "unknown". */
  status?: SystemStatus
  /** Waktu sinkron terakhir (ISO 8601). Jika kosong, segmen sinkron disembunyikan. */
  syncedAt?: string | null
  /** Versi aplikasi tanpa awalan "v" (mis. "1.0.0"). */
  version?: string
  /** Nama instansi untuk baris hak cipta. */
  organization?: string
  /** Pemicu dialog "Tentang" (kredit pembuat, lisensi, changelog). */
  aboutTrigger?: ReactNode
  className?: string
}

const syncFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
  hourCycle: "h23",
})

function Divider() {
  return <span aria-hidden="true" className="h-3 w-px bg-border" />
}

export function DashboardFooter({
  status = "unknown",
  syncedAt,
  version,
  organization,
  aboutTrigger,
  className,
}: DashboardFooterProps) {
  const { label, dot } = STATUS[status] ?? STATUS.unknown

  const syncedDate = syncedAt ? new Date(syncedAt) : null
  const hasSynced = syncedDate !== null && !Number.isNaN(syncedDate.getTime())

  const versionNode = aboutTrigger ?? (version ? <span>v{version}</span> : null)

  return (
    <footer
      className={cn(
        "border-t border-t-(--pattern-fg) px-3 py-3 text-xs/5 text-muted-foreground sm:px-5 lg:px-8",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* role="status": perubahan kondisi diumumkan pembaca layar secara sopan */}
          <p role="status" className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", dot)} />
            {label}
          </p>

          {hasSynced && syncedDate ? (
            <>
              <Divider />
              <p className="tabular-nums">
                Sinkron terakhir{" "}
                <time dateTime={syncedAt ?? undefined}>
                  {syncFormatter.format(syncedDate)} WIB
                </time>
              </p>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
          {versionNode}
          {versionNode && organization ? <Divider /> : null}
          <small className="text-[length:inherit]">
            &copy; {new Date().getFullYear()}
            {organization ? ` ${organization}` : ""}
          </small>
        </div>
      </div>
    </footer>
  )
}