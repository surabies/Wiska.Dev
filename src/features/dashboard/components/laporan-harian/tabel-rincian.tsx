import { cn } from "@/lib/utils"
import { angka, persenDari, tanggalPendek, warnaProgres } from "./format"
import { GAYA_HARI } from "./konstanta"
import { Legenda } from "./legenda"
import { LencanaStatus } from "./lencana-status"
import { Seksi } from "./seksi"
import type { Progres, Ringkasan } from "./tipe"

const KOLOM_RANGKUMAN = [
  { judul: "Setor", lebar: 80, rata: "text-right" },
  { judul: "Target", lebar: 80, rata: "text-right" },
  { judul: "Capaian", lebar: 130, rata: "text-left" },
  { judul: "Status", lebar: 120, rata: "text-left" },
] as const

const TH = "border border-border/60 bg-muted p-0"
const TH_TEKS = "px-2 py-1.5 text-[11px] font-medium tracking-wide uppercase"

export function TabelRincian({ data, ringkas }: { data: Progres; ringkas: Ringkasan }) {
  const capaianTotal = persenDari(ringkas.tersetor, ringkas.target)

  return (
    <Seksi
      judul="Rincian per Petugas per Tanggal"
      chip={`${data.pencatat.length} Petugas`}
      deskripsi="Angka = jumlah setoran hari itu. Sel merah = tidak menyetor pada hari kerja."
    >
      <div className="scrollbar-tipis w-full overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={cn(TH, "sticky left-0 z-20 text-left")} style={{ minWidth: 170 }}>
                <div className={TH_TEKS}>Petugas</div>
              </th>
              {data.hari.map((h) => (
                <th
                  key={h.tanggal}
                  className="border border-border/60 bg-card p-0"
                  style={{ minWidth: 40 }}
                  title={`${tanggalPendek(h.tanggal)} · ${GAYA_HARI[h.jenis].label}`}
                >
                  <div className={cn("px-2 py-1.5 text-center text-[11px] font-medium tabular-nums", GAYA_HARI[h.jenis].kepala)}>
                    {Number(h.tanggal.slice(-2))}
                  </div>
                </th>
              ))}
              {KOLOM_RANGKUMAN.map((k) => (
                <th key={k.judul} className={TH} style={{ minWidth: k.lebar }}>
                  <div className={cn(TH_TEKS, k.rata)}>{k.judul}</div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.pencatat.map((p) => {
              const persen = persenDari(p.tersetor, p.target)
              return (
                <tr key={p.id} className="group [&>td]:border [&>td]:border-border/60 [&>td]:px-2 [&>td]:py-1.5 [&>td]:whitespace-nowrap">
                  <td className="sticky left-0 z-10 bg-card px-3! font-medium group-hover:bg-muted">{p.nama}</td>
                  {data.hari.map((h) => {
                    const n = p.perTanggal[h.tanggal] ?? 0
                    const bolong = n === 0 && h.jenis === "kerja"
                    return (
                      <td
                        key={h.tanggal}
                        className={cn(
                          "text-center font-mono tabular-nums group-hover:bg-muted/50",
                          bolong
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : cn(GAYA_HARI[h.jenis].sel, n === 0 ? "text-muted-foreground/40" : GAYA_HARI[h.jenis].teks)
                        )}
                        title={
                          bolong
                            ? `${p.nama} tidak menyetor ${tanggalPendek(h.tanggal)} (hari kerja)`
                            : `${p.nama} · ${tanggalPendek(h.tanggal)} · ${angka(n)} setoran`
                        }
                      >
                        {n === 0 ? (bolong ? "0" : "·") : angka(n)}
                      </td>
                    )
                  })}
                  <td className="text-right font-mono font-medium tabular-nums">{angka(p.tersetor)}</td>
                  <td className="text-right font-mono text-muted-foreground tabular-nums">{angka(p.target)}</td>
                  <td>
                    {persen === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", warnaProgres(persen))}
                            style={{ width: `${Math.min(100, persen)}%` }}
                          />
                        </div>
                        <span className="w-9 text-right font-mono text-xs tabular-nums">{persen}%</span>
                      </div>
                    )}
                  </td>
                  <td><LencanaStatus status={p.status} /></td>
                </tr>
              )
            })}
          </tbody>

          <tfoot>
            <tr className="[&>td]:border [&>td]:border-border/60 [&>td]:bg-muted [&>td]:px-2 [&>td]:py-1.5 [&>td]:font-medium [&>td]:whitespace-nowrap">
              <td className="sticky left-0 z-10 px-3!">Total</td>
              {data.totalPerTanggal.map((t) => (
                <td key={t.tanggal} className="text-center font-mono tabular-nums">
                  {t.jumlah === 0 ? "·" : angka(t.jumlah)}
                </td>
              ))}
              <td className="text-right font-mono tabular-nums">{angka(ringkas.tersetor)}</td>
              <td className="text-right font-mono tabular-nums">{angka(ringkas.target)}</td>
              <td className="font-mono tabular-nums">{capaianTotal === null ? "—" : `${capaianTotal}%`}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="border-t border-border px-4 py-3">
        <Legenda />
      </div>
    </Seksi>
  )
}
