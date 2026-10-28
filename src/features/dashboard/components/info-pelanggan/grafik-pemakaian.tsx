// Batang pemakaian per periode (terlama → terbaru). CSS murni, tanpa pustaka
// grafik. Periode yang sedang dilihat memakai warna seri grafik pertama.
// Tinggi mengisi sisa kartu (flex-1) sehingga kartu grafik dan rincian sama tinggi.
import { cn } from "@/lib/utils"
import { fmtAngka, fmtPeriode, fmtPeriodeSingkat } from "./format"
import type { BarisRiwayat } from "./tipe"

export function GrafikPemakaian({
  periode,
  pemakaianM3,
  riwayat,
}: {
  periode: string
  pemakaianM3: number | null
  riwayat: BarisRiwayat[]
}) {
  const data = [
    ...[...riwayat].reverse().map((r) => ({
      periode: r.periode,
      nilai: r.pemakaianM3,
      aktif: false,
    })),
    { periode, nilai: pemakaianM3, aktif: true },
  ]
  const maks = Math.max(1, ...data.map((d) => d.nilai ?? 0))
  const ringkas = data
    .map((d) => `${fmtPeriode(d.periode)} ${fmtAngka(d.nilai)} meter kubik`)
    .join(", ")

  return (
    <div role="img" aria-label={`Pemakaian: ${ringkas}`} className="flex min-h-44 flex-1 gap-3">
      {data.map((d) => (
        <div key={d.periode} className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="relative min-h-0 flex-1">
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 rounded-t-sm",
                d.aktif ? "bg-chart-1" : "bg-muted-foreground/30"
              )}
              style={{
                height: `${d.nilai == null ? 0 : Math.max(4, (d.nilai / maks) * 100)}%`,
              }}
            />
          </div>
          <div className="text-center leading-tight">
            <p className={cn("text-sm tabular-nums", d.aktif ? "font-semibold" : "font-medium")}>
              {fmtAngka(d.nilai)}
            </p>
            <p className="text-xs text-muted-foreground">{fmtPeriodeSingkat(d.periode)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}