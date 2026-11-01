// features/dashboard/ringkasan/components/StatPanel.tsx — kartu KPI terpisah berbingkai Panel.
//
// Server component (tanpa hooks). Pengganti tampilan <StatGrid>/<StatCard> untuk
// halaman yang ingin tiap angka berdiri sendiri sebagai panel, seragam dengan
// panel grafik. stat-card.tsx TIDAK diubah, jadi halaman lain tetap utuh.
//
//   <StatPanelGrid>  grid dengan jarak antar panel (bukan garis pemisah).
//   <StatPanel>      satu panel: strip judul (ikon + titik status + label mono)
//                    dan kartu putih berisi angka, keterangan, bilah progres.
//
// Prinsip warna sama dengan StatCard: warna HANYA untuk status (titik kecil,
// bilah progres, angka merah untuk `perhatian`). Ikon selalu netral.
import type { LucideIcon } from "lucide-react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "@/lib/Utilitas"
import { Panel } from "./Panel"

type Nada = "netral" | "perhatian" | "peringatan" | "info" | "sukses"

const NADA: Record<Nada, { angka: string; titik?: string; bilah: string }> = {
  netral: { angka: "text-foreground", bilah: "bg-foreground/60" },
  perhatian: {
    angka: "text-destructive",
    titik: "bg-red-500",
    bilah: "bg-red-500",
  },
  peringatan: {
    angka: "text-foreground",
    titik: "bg-amber-500",
    bilah: "bg-amber-500",
  },
  info: {
    angka: "text-foreground",
    titik: "bg-blue-500",
    bilah: "bg-blue-500",
  },
  sukses: {
    angka: "text-foreground",
    titik: "bg-green-500",
    bilah: "bg-green-500",
  },
}

// Hugeicons (array data) maupun Lucide (komponen), dipilah dengan Array.isArray.
function Ikon({ icon }: { icon: LucideIcon | IconSvgElement }) {
  const kelas = "size-3.5 shrink-0"
  if (Array.isArray(icon)) {
    return (
      <HugeiconsIcon
        icon={icon as IconSvgElement}
        strokeWidth={1.6}
        className={kelas}
        aria-hidden
      />
    )
  }
  const Lucide = icon as LucideIcon
  return <Lucide strokeWidth={1.6} className={kelas} aria-hidden />
}

// Kelas ditulis lengkap karena Tailwind hanya mengenali nama kelas utuh.
const KOLOM = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
} as const

export function StatPanelGrid({
  children,
  kolom = 4,
  className,
}: {
  children: React.ReactNode
  kolom?: keyof typeof KOLOM
  className?: string
}) {
  return (
    <div className={cn("grid gap-3 sm:gap-4", KOLOM[kolom], className)}>
      {children}
    </div>
  )
}

export function StatPanel({
  label,
  nilai,
  keterangan,
  judulLengkap,
  icon,
  nada = "netral",
  progres,
}: {
  label: string
  /** Sudah diringkas bila berupa uang — lihat formatRupiahRingkas(). */
  nilai: string
  keterangan?: string
  /** Nilai penuh, muncul sebagai tooltip saat kursor menyentuh angka ringkas. */
  judulLengkap?: string
  icon: LucideIcon | IconSvgElement
  nada?: Nada
  /** 0–100. Bila diisi, bilah tipis digambar di dasar kartu. */
  progres?: number
}) {
  const n = NADA[nada]
  const persen =
    progres === undefined ? undefined : Math.min(100, Math.max(0, progres))

  return (
    <Panel
      label={label}
      flush
      icon={
        <>
          <Ikon icon={icon} />
          {n.titik && (
            <>
              <span
                aria-hidden
                className={cn("size-1.5 shrink-0 rounded-full", n.titik)}
              />
              {/* Titik tidak terbaca pembaca layar, jadi statusnya ditulis. */}
              <span className="sr-only">({nada})</span>
            </>
          )}
        </>
      }
    >
      <div className="relative flex flex-1 flex-col justify-center gap-0.5 px-4 py-3">
        <p
          title={judulLengkap}
          className={cn(
            "truncate text-xl leading-8 num-display sm:text-2xl",
            n.angka
          )}
        >
          {nilai}
        </p>
        {keterangan && (
          <p className="truncate text-xs text-muted-foreground">{keterangan}</p>
        )}

        {persen !== undefined && (
          <div
            role="progressbar"
            aria-label={`Progres ${label}`}
            aria-valuenow={persen}
            aria-valuemin={0}
            aria-valuemax={100}
            className="absolute inset-x-0 bottom-0 h-0.5 bg-border/60"
          >
            <div
              className={cn("h-full transition-[width] duration-500", n.bilah)}
              style={{ width: `${persen}%` }}
            />
          </div>
        )}
      </div>
    </Panel>
  )
}
