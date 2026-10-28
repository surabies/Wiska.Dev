// features/dashboard/components/dashboard/progres-petugas.tsx — progres baca
// meter per petugas pada periode kerja dengan gaya bar latar belakang ala Vercel.
import type { BarisPetugas } from "../../lib/queries-meter"
import { Panel } from "../panel"

export function ProgresPetugas({ data }: { data: BarisPetugas[] }) {
  // Cari nilai maksimum untuk kalkulasi relatif lebar bar latar belakang (opsional, 
  // atau bisa langsung memakai persentase p.persen 0-100%).
  return (
    <Panel
      label="Progres Baca per Petugas"
      chip={data.length > 0 ? `${data.length} Petugas` : undefined}
      deskripsi="Tercatat dari beban kerja periode ini. Yang paling tertinggal di atas."
    >
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Daftar catat periode ini belum tersedia.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {data.map((p) => {
            return (
              <li
                key={p.id}
                className="relative overflow-hidden rounded-md px-3 py-2 text-xs transition-colors"
              >
                {/* Bar latar belakang transparan ala Vercel (menunjukkan progress) */}
                <div
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-muted/50 dark:bg-muted/30 transition-all"
                  style={{ width: `${Math.max(p.persen, 2)}%` }}
                />

                {/* Konten baris di atas background bar */}
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <span className="truncate font-medium text-foreground">{p.nama}</span>
                  <span className="num shrink-0 text-muted-foreground">
                    {p.dicatat.toLocaleString("id-ID")}/{p.total.toLocaleString("id-ID")} ·{" "}
                    <strong className="text-foreground font-medium">{p.persen.toFixed(0)}%</strong>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-3">
        <span>Menampilkan progres penyelesaian tugas</span>
        <span>Total beban kerja</span>
      </div>
    </Panel>
  )
}