// features/dashboard/ringkasan/components/ProgresPetugas.tsx — progres baca
// meter per petugas pada periode kerja dengan gaya bar latar belakang ala Vercel.
//
// Warna bar mengikuti tingkat capaian (token dari globals.css, otomatis
// menyesuaikan mode terang/gelap):
//   < 40%   destructive — jauh tertinggal
//   40–69%  warning     — perlu dikejar
//   70–89%  info        — berjalan baik
//   ≥ 90%   success     — hampir/sudah selesai
import type { BarisPetugas } from "../types/TipeRingkasan"
import { Panel } from "./Panel"

type Tingkat = {
  /** Warna isi bar (transparan, ala Vercel). */
  bar: string
  /** Warna titik penanda di samping nama & legenda. */
  titik: string
  label: string
}

const TINGKAT: Record<"kritis" | "kurang" | "baik" | "selesai", Tingkat> = {
  kritis: { bar: "bg-destructive/20", titik: "bg-destructive", label: "< 40%" },
  kurang: { bar: "bg-warning/25", titik: "bg-warning", label: "40–69%" },
  baik: { bar: "bg-info/20", titik: "bg-info", label: "70–89%" },
  selesai: { bar: "bg-success/20", titik: "bg-success", label: "≥ 90%" },
}

function tingkatDari(persen: number): Tingkat {
  if (persen >= 90) return TINGKAT.selesai
  if (persen >= 70) return TINGKAT.baik
  if (persen >= 40) return TINGKAT.kurang
  return TINGKAT.kritis
}

export function ProgresPetugas({ data }: { data: BarisPetugas[] }) {
  return (
    <Panel
      label="Progres Baca per Petugas"
      chip={data.length > 0 ? `${data.length} Petugas` : undefined}
      deskripsi="Tercatat dari beban kerja periode ini. Yang paling tertinggal di Bawah."
    >
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Daftar catat periode ini belum tersedia.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {data.map((p) => {
            const t = tingkatDari(p.persen)
            return (
              // `isolate` membuat konteks tumpukan sendiri per baris, jadi z-index
              // di dalamnya tidak bocor dan tidak bisa menimpa header sticky halaman.
              <li
                key={p.id}
                className="relative isolate overflow-hidden rounded-md px-3 py-2 text-xs transition-colors"
              >
                {/* Bar latar belakang transparan ala Vercel (menunjukkan progress) */}
                <div
                  aria-hidden
                  className={`absolute inset-y-0 left-0 transition-all ${t.bar}`}
                  style={{ width: `${Math.min(Math.max(p.persen, 2), 100)}%` }}
                />

                {/* Konten baris di atas background bar */}
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${t.titik}`}
                    />
                    <span className="truncate font-medium text-foreground">
                      {p.nama}
                    </span>
                  </span>
                  <span className="shrink-0 num text-muted-foreground">
                    {p.dicatat.toLocaleString("id-ID")}/
                    {p.total.toLocaleString("id-ID")} ·{" "}
                    <strong className="font-medium text-foreground">
                      {p.persen.toFixed(0)}%
                    </strong>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Legenda warna */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/40 pt-3 text-xs text-muted-foreground">
        {Object.values(TINGKAT).map((t) => (
          <span key={t.label} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2 rounded-xs ${t.titik}`} />
            {t.label}
          </span>
        ))}
      </div>
    </Panel>
  )
}
