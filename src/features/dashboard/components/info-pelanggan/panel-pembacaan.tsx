// Baris tiga kotak, sama dengan PDF: stand awal, stand akhir (roda angka),
// dan kartu Pemakaian dengan kalimat perbandingan periode sebelumnya.
import { cn } from "@/lib/utils"
import { fmtAngka, fmtBulan } from "./format"
import { Odometer } from "./odometer"
import type { BarisRiwayat, DataCatat } from "./tipe"

/** Perubahan pemakaian terhadap periode sebelumnya, dalam kalimat. */
export function bandingkan(catat: DataCatat, riwayat: BarisRiwayat[]) {
  const sebelum = riwayat[0]
  const kini = catat.pemakaianM3
  if (!sebelum || kini == null || sebelum.pemakaianM3 == null || sebelum.pemakaianM3 <= 0)
    return null
  const persen = Math.round(((kini - sebelum.pemakaianM3) / sebelum.pemakaianM3) * 100)
  const bulan = fmtBulan(sebelum.periode)
  return {
    teks:
      persen === 0
        ? `Sama dengan ${bulan}`
        : `${persen > 0 ? "Naik" : "Turun"} ${Math.abs(persen)}% dari ${bulan}`,
    perhatian: Math.abs(persen) >= 50,
  }
}

export function PanelPembacaan({
  catat,
  riwayat,
}: {
  catat: DataCatat | null
  riwayat: BarisRiwayat[]
}) {
  if (!catat) {
    return (
      <section
        aria-label="Pencatatan meter"
        className="rounded-lg border border-dashed border-border px-5 py-10 text-center"
      >
        <p className="text-sm font-medium">Belum ada pencatatan untuk periode ini</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Coba periode lain, atau kosongkan periode untuk melihat yang terbaru.
        </p>
      </section>
    )
  }

  const banding = bandingkan(catat, riwayat)

  return (
    <section
      aria-label="Stand meter dan pemakaian"
      className="grid gap-3 md:grid-cols-[1fr_1fr_1.15fr]"
    >
      <div className="flex rounded-lg border border-border bg-card p-4 shadow-panel">
        <Odometer label="Stand awal" nilai={catat.standLalu} />
      </div>
      <div className="flex rounded-lg border border-border bg-card p-4 shadow-panel">
        <Odometer label="Stand akhir" nilai={catat.standAkhir} />
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg bg-info p-4 text-center text-info-foreground">
        <p className="text-xs text-info-foreground/80">Pemakaian</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-5xl leading-none font-semibold tracking-tight tabular-nums">
            {fmtAngka(catat.pemakaianM3)}
          </span>
          <span className="text-lg text-info-foreground/80">m³</span>
        </p>
        {banding && (
          <p
            className={cn(
              "mt-2 w-fit text-xs",
              banding.perhatian
                ? "rounded bg-info-foreground/20 px-1.5 py-0.5 font-medium"
                : "text-info-foreground/80"
            )}
          >
            {banding.teks}
          </p>
        )}
      </div>
    </section>
  )
}