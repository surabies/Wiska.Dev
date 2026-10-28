// Kartu grafik pemakaian per periode (kiri baris kedua, seperti PDF).
import { GrafikPemakaian } from "./grafik-pemakaian"
import type { BarisRiwayat, DataCatat } from "./tipe"

export function KartuGrafik({
  catat,
  riwayat,
}: {
  catat: DataCatat
  riwayat: BarisRiwayat[]
}) {
  return (
    <section
      aria-label="Grafik pemakaian"
      className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-panel"
    >
      <h2 className="text-sm font-semibold">
        Pemakaian per periode{" "}
        <span className="font-normal text-muted-foreground">(m³)</span>
      </h2>
      <GrafikPemakaian
        periode={catat.periode}
        pemakaianM3={catat.pemakaianM3}
        riwayat={riwayat}
      />
    </section>
  )
}