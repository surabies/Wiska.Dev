// features/dashboard/components/panel.tsx — bingkai panel dashboard dengan
// strip header micro-label, grammar yang sama dengan KartuBerbingkai di
// permukaan publik (features/publik/components/halaman-publik.tsx) supaya
// dashboard dan situs publik terasa satu sistem.
//
// Murni presentasional — boleh diimpor komponen client (Recharts dkk.).
import { cn } from "@/lib/utils"

export function Panel({
  label,
  chip,
  deskripsi,
  className,
  children,
}: {
  label: string
  /** Chip mono kecil di kanan strip header, mis. "6 PERIODE". */
  chip?: string
  deskripsi?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    // Padding menyusut satu tingkat di ponsel — 20px kiri-kanan memakan 11%
    // lebar layar 360px sebelum satu huruf pun tergambar.
    <section className="border border-border/70 bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-2 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{label}</h2>
          {deskripsi && <p className="mt-1 text-xs text-muted-foreground">{deskripsi}</p>}
        </div>
        {chip && (
          <span className="shrink-0 border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {chip}
          </span>
        )}
      </div>
      <div className={cn("p-4 sm:p-5", className)}>{children}</div>
    </section>
  )
}
