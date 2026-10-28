import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, TriangleAlertIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { HasilImpor } from "./tipe"

const RINCIAN = [
  { kunci: "tersimpan", label: "Pembacaan", titik: "bg-emerald-500" },
  { kunci: "dilampirkan", label: "Foto dilampirkan", titik: "bg-blue-500" },
  { kunci: "duplikat", label: "Duplikat", titik: "bg-foreground/30" },
  { kunci: "tanpaPencatatan", label: "Tanpa pencatatan", titik: "bg-amber-500" },
  { kunci: "gagal", label: "Gagal", titik: "bg-red-500" },
] as const

export function PanelHasil({ hasil }: { hasil: HasilImpor }) {
  // Hanya baris yang ditolak yang dirinci; yang berhasil cukup diringkas.
  const bermasalah = hasil.hasil.filter((h) => h.status === "GAGAL" || h.status === "TANPA_PENCATATAN")
  const bersih = hasil.gagal === 0
  const tampil = RINCIAN.filter((r) => hasil[r.kunci] > 0)

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <HugeiconsIcon
          icon={bersih ? CheckmarkCircle02Icon : TriangleAlertIcon}
          strokeWidth={2}
          className={cn("size-5 shrink-0", bersih ? "text-emerald-600" : "text-amber-600")}
          aria-hidden
        />
        <div>
          <h3 className="text-base font-semibold tracking-tight">Hasil impor</h3>
          <p className="text-xs text-muted-foreground tabular-nums">
            {hasil.total.toLocaleString("id-ID")} berkas diproses
          </p>
        </div>
      </header>

      {tampil.length > 0 && (
        <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
          {tampil.map((r) => (
            <div key={r.kunci} className="flex flex-col gap-1 bg-card px-5 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", r.titik)} />
                {r.label}
              </dt>
              <dd className="text-xl font-semibold tracking-tight tabular-nums">
                {hasil[r.kunci].toLocaleString("id-ID")}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {bermasalah.length > 0 && (
        <div className="border-t border-border">
          <p className="px-5 pt-4 pb-2 text-sm font-medium">Perlu perhatian</p>
          <ul className="divide-y divide-border border-t border-border text-sm">
            {bermasalah.map((h) => (
              <li key={h.index} className="flex items-start justify-between gap-4 px-5 py-2.5">
                <span className="shrink-0 font-mono text-xs">
                  {h.nomorLangganan || "?"}
                  <span className="ml-2 font-sans text-muted-foreground">{h.jenis}</span>
                </span>
                <span className="text-right text-xs text-muted-foreground">{h.pesan ?? "Gagal."}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
