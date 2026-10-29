// features/dashboard/components/panel.tsx — bingkai panel dashboard.
//
// Frame abu-abu tipis dengan strip judul di atas (ikon + label mono). Sisi
// kiri, kanan, dan bawah SAMA tebalnya (p-1 = 4px). Kartu putih di dalamnya
// `flex-1`, jadi ikut memenuhi tinggi frame saat dua panel sebaris di grid
// (tanpa itu, panel yang lebih pendek meninggalkan celah lebih tebal di bawah).
//
// Murni presentasional — boleh diimpor komponen client.
import { cn } from "@/lib/utils"

/** Ikon bawaan di strip judul (empat sudut bingkai). */
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

export function Panel({
  label,
  chip,
  deskripsi,
  icon,
  flush = false,
  className,
  children,
}: {
  label: string
  /** Chip mono kecil di kanan strip judul, mis. "6 PERIODE". */
  chip?: string
  /** Keterangan singkat di kanan strip judul (disembunyikan di ponsel). */
  deskripsi?: string
  /** Ikon di kiri label. Bawaan: ikon bingkai. */
  icon?: React.ReactNode
  /** Tanpa padding isi — untuk konten yang mengatur jarak sendiri. */
  flush?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-muted/50 border-border/70 flex flex-col rounded-xl border p-1 pt-0">
      <div className="text-muted-foreground flex h-9 items-center justify-between gap-3 px-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon ?? <IkonBawaan />}
          <h2 className="truncate font-mono text-xs tracking-tight">{label}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {deskripsi && <p className="hidden text-xs sm:block">{deskripsi}</p>}
          {chip && (
            <span className="border-border bg-background rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase">
              {chip}
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "border-border bg-card flex flex-1 flex-col overflow-hidden rounded-lg border",
          !flush && "p-4 sm:p-5",
          className
        )}
      >
        {children}
      </div>
    </section>
  )
}