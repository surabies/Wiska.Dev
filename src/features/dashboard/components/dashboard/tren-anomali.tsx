"use client"

// features/dashboard/components/dashboard/tren-anomali.tsx — jumlah anomali
// per periode, ditumpuk per kode kondisi (DK, TTB, BMK_BMB, MTA, lainnya).
//
// Grafik memakai EvilBarChart (EvilCharts), tata letak ala Vercel:
//   - header: total periode terakhir (kiri), legenda berisi jumlah per kode (kanan)
//   - legenda bisa diklik untuk menyembunyikan/menampilkan kode (minimal satu
//     tampil). <Legend isClickable> bawaan EvilCharts berfungsi sebagai
//     "pilih/sorot", bukan sembunyikan, jadi legenda kustom dipertahankan.
//     Kode tersembunyi cukup tidak dirender sebagai <Bar>.
//   - sumbu-X hanya berlabel di periode awal dan akhir
//
// PERLU DIVERIFIKASI terhadap dokumentasi EvilBarChart (ditandai [VERIFIKASI]):
//   1. path import komponen
//   2. nama sub-komponen <EvilBarChart.Bar>
//   3. prop `stackType="stacked"` untuk menumpuk (meniru EvilAreaChart)
import { useId, useMemo, useState } from "react"
// [VERIFIKASI 1] sesuaikan path dengan hasil instalasi EvilCharts.
import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart"
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart"
import { cn } from "@/lib/utils"
import { formatPeriode } from "@/features/public/lib/format"
import type { TitikAnomali } from "../../lib/queries-meter"
import { Panel } from "../panel"

const KUNCI = ["DK", "TTB", "BMK_BMB", "MTA", "lainnya"] as const
type Kunci = (typeof KUNCI)[number]

// Satu warna per kode, urutan slot --chart-* tetap.
const WARNA: Record<Kunci, string> = {
  DK: "var(--chart-1)",
  TTB: "var(--chart-2)",
  BMK_BMB: "var(--chart-3)",
  MTA: "var(--chart-4)",
  lainnya: "var(--chart-5)",
}

const LABEL: Record<Kunci, string> = {
  DK: "DK",
  TTB: "TTB",
  BMK_BMB: "BMK/BMB",
  MTA: "MTA",
  lainnya: "Lainnya",
}

const config = {
  DK: { label: LABEL.DK, colors: { light: [WARNA.DK], dark: [WARNA.DK] } },
  TTB: { label: LABEL.TTB, colors: { light: [WARNA.TTB], dark: [WARNA.TTB] } },
  BMK_BMB: { label: LABEL.BMK_BMB, colors: { light: [WARNA.BMK_BMB], dark: [WARNA.BMK_BMB] } },
  MTA: { label: LABEL.MTA, colors: { light: [WARNA.MTA], dark: [WARNA.MTA] } },
  lainnya: { label: LABEL.lainnya, colors: { light: [WARNA.lainnya], dark: [WARNA.lainnya] } },
} satisfies ChartConfig

const jumlah = (t: TitikAnomali) => t.DK + t.TTB + t.BMK_BMB + t.MTA + t.lainnya

export function TrenAnomali({ data }: { data: TitikAnomali[] }) {
  // Kode yang sedang disembunyikan lewat legenda.
  const [tersembunyi, setTersembunyi] = useState<Kunci[]>([])
  // Dipakai untuk remount grafik saat set kode berubah (animasi diulang bersih).
  const idGrafik = useId()

  // Sumbu-X dan judul tooltip memakai `label` (periode terformat).
  const dataGrafik = useMemo(
    () => data.map((t) => ({ ...t, label: formatPeriode(t.periode) })),
    [data]
  )

  const total = data.reduce((a, t) => a + jumlah(t), 0)

  if (total === 0) {
    return (
      <Panel label="Tren Anomali" deskripsi="Selain NORMAL, per periode.">
        <p className="text-sm text-muted-foreground">Belum ada anomali tercatat.</p>
      </Panel>
    )
  }

  const terakhir = data.at(-1)
  const totalTerakhir = terakhir ? jumlah(terakhir) : 0
  // Kode terbesar pada periode terakhir (hanya bila ada anomali).
  const dominan =
    terakhir && totalTerakhir > 0
      ? [...KUNCI].sort((a, b) => terakhir[b] - terakhir[a])[0]
      : undefined

  const totalKode = Object.fromEntries(
    KUNCI.map((k) => [k, data.reduce((a, t) => a + t[k], 0)])
  ) as Record<Kunci, number>

  const tampil = KUNCI.filter((k) => !tersembunyi.includes(k))

  function ganti(k: Kunci) {
    setTersembunyi((lama) => {
      if (lama.includes(k)) return lama.filter((x) => x !== k)
      // Jangan biarkan semua kode tersembunyi: grafik jadi kosong.
      if (lama.length >= KUNCI.length - 1) return lama
      return [...lama, k]
    })
  }

  return (
    <Panel label="Tren Anomali" deskripsi="Per kode kondisi.">
      {/* Header ala Vercel: angka utama (kiri), legenda + jumlah per kode (kanan) */}
      <div className="mb-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="num-display text-2xl leading-8">{totalTerakhir.toLocaleString("id-ID")}</span>
            <span className="text-muted-foreground text-xs">anomali</span>
          </div>
          <p className="text-muted-foreground text-xs">
            {terakhir ? formatPeriode(terakhir.periode) : "Periode terakhir"}
            {dominan ? ` · terbanyak ${LABEL[dominan]}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-x-1">
          {KUNCI.map((k) => {
            const sembunyi = tersembunyi.includes(k)
            return (
              <button
                key={k}
                type="button"
                onClick={() => ganti(k)}
                aria-pressed={!sembunyi}
                className={cn(
                  "hover:bg-hover flex flex-col items-start gap-0.5 rounded-md px-2 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sembunyi && "opacity-40"
                )}
              >
                <span className={cn("text-muted-foreground", sembunyi && "line-through")}>
                  {LABEL[k]}
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: WARNA[k] }} />
                  <span className="num text-foreground font-medium">
                    {totalKode[k].toLocaleString("id-ID")}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* [VERIFIKASI 3] stackType: batang ditumpuk seperti pada EvilAreaChart. */}
      <EvilBarChart
        key={idGrafik + tersembunyi.join(",")}
        xDataKey="label"
        data={dataGrafik}
        config={config}
        className="h-55 max-sm:h-44 w-full"
        stackType="stacked"
      >
        <EvilBarChart.Grid />
        {/* Gaya Vercel: hanya periode awal dan akhir yang diberi label. */}
        <EvilBarChart.XAxis
          dataKey="label"
          ticks={[dataGrafik[0].label, dataGrafik[dataGrafik.length - 1].label]}
        />
        <EvilBarChart.YAxis tickCount={4} width={40} allowDecimals={false} />
        <EvilBarChart.Tooltip />
        {/* [VERIFIKASI 2] hanya kode yang tampil yang dirender. */}
        {tampil.map((k) => (
          <EvilBarChart.Bar key={k} dataKey={k} />
        ))}
      </EvilBarChart>
    </Panel>
  )
}