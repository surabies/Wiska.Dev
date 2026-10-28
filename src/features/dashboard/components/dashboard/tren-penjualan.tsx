"use client"

// features/dashboard/components/dashboard/tren-penjualan.tsx — tren kubikasi
// (m³) dan nilai tagihan (Rp) per periode dalam SATU panel dengan toggle.
// Data dari ambilTren() tanpa perubahan.
//
// Grafik memakai EvilAreaChart (EvilCharts). Header dibuat ringkas:
//   baris 1: angka utama + selisih, toggle m³/Rupiah di kanan
//   baris 2: periode terakhir · rata-rata
//
// Judul tooltip: EvilCharts memakai nilai sumbu-X sebagai label tooltip, jadi
// sumbu-X memakai kolom `label` (periode terformat), bukan `periode` mentah.
import { useMemo, useState } from "react"
import { EvilAreaChart } from "@/components/evilcharts/charts/recharts-area-chart"
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart"
import { cn } from "@/lib/utils"
import { formatPeriode } from "@/features/public/lib/format"
import { Panel } from "../panel"

interface Titik {
  periode: number
  nilai: number
  jumlahTagihan: number
  pemakaianM3: number
}

type Mode = "m3" | "rupiah"

// Key config = key data (pemakaianM3 / nilai), bukan nama mode.
const config = {
  pemakaianM3: {
    label: "Kubikasi (m³)",
    colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
  },
  nilai: {
    label: "Nilai tagihan",
    colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
  },
} satisfies ChartConfig

// Mode → kunci data pada Titik.
const KUNCI = { m3: "pemakaianM3", rupiah: "nilai" } as const

function ringkasRupiah(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)} jt`
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`
  return `Rp ${n}`
}

function ringkasM3(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} rb`
  return String(n)
}

export function TrenPenjualan({ data }: { data: Titik[] }) {
  const [mode, setMode] = useState<Mode>("m3")

  // Hook harus dipanggil sebelum early return di bawah.
  const dataGrafik = useMemo(
    () => data.map((t) => ({ ...t, label: formatPeriode(t.periode) })),
    [data]
  )

  const terakhir = data.at(-1)
  const sebelumnya = data.at(-2)

  // Kurang dari dua periode: belum ada tren yang layak digambar.
  if (!terakhir || !sebelumnya) {
    return (
      <Panel label="Tren Kubikasi & Tagihan" deskripsi="Butuh minimal dua periode.">
        <p className="text-sm text-muted-foreground">
          {terakhir
            ? `Baru ada periode ${formatPeriode(terakhir.periode)}: ${terakhir.pemakaianM3.toLocaleString("id-ID")} m³ · Rp ${terakhir.nilai.toLocaleString("id-ID")}`
            : "Belum ada data tagihan."}
        </p>
      </Panel>
    )
  }

  const kunci = KUNCI[mode]
  const ringkas = mode === "m3" ? ringkasM3 : ringkasRupiah

  const nilaiTerakhir = terakhir[kunci]
  const nilaiLalu = sebelumnya[kunci]
  const rata = data.reduce((a, t) => a + t[kunci], 0) / data.length
  const delta = nilaiLalu > 0 ? ((nilaiTerakhir - nilaiLalu) / nilaiLalu) * 100 : undefined

  const angkaUtama =
    mode === "m3" ? `${nilaiTerakhir.toLocaleString("id-ID")} m³` : ringkasRupiah(nilaiTerakhir)
  const angkaPenuh =
    mode === "m3"
      ? `${nilaiTerakhir.toLocaleString("id-ID")} m³`
      : `Rp ${nilaiTerakhir.toLocaleString("id-ID")}`
  const rataTeks = mode === "m3" ? `${ringkasM3(Math.round(rata))} m³` : ringkasRupiah(Math.round(rata))

  return (
    <Panel label="Tren Kubikasi & Tagihan" deskripsi="Per periode.">
      {/* Header ringkas: angka utama + selisih (kiri), toggle (kanan) */}
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span title={angkaPenuh} className="num-display text-2xl leading-8">
              {angkaUtama}
            </span>
            {delta !== undefined && (
              <span className="num text-muted-foreground text-xs">
                {delta >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(delta).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {formatPeriode(terakhir.periode)} · rata-rata{" "}
            <span className="num text-foreground/80">{rataTeks}</span>
          </p>
        </div>

        {/* Segmented tanpa garis: latar muted, tombol aktif terangkat */}
        <div className="bg-muted inline-flex h-7 shrink-0 items-center rounded-md p-0.5 text-xs">
          {(["m3", "rupiah"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "h-full rounded-sm px-2.5 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "m3" ? "m³" : "Rupiah"}
            </button>
          ))}
        </div>
      </div>

      {/* `key` memaksa animasi intro diulang saat mode berganti.
          Hanya satu <Area> dirender, sesuai mode aktif. */}
      <EvilAreaChart
        key={mode}
        data={dataGrafik}
        config={config}
        className="h-55 max-sm:h-44 w-full"
        curveType="monotone"
      >
        <EvilAreaChart.Grid />
        {/* Gaya Vercel: hanya periode awal dan akhir yang diberi label. */}
        <EvilAreaChart.XAxis
          dataKey="label"
          ticks={[dataGrafik[0].label, dataGrafik[dataGrafik.length - 1].label]}
        />
        <EvilAreaChart.YAxis
          tickCount={4}
          width={mode === "m3" ? 44 : 56}
          tickFormatter={(v: number) => ringkas(v)}
        />
        <EvilAreaChart.Tooltip />
        {/* Bawaan stroke-nya putus-putus (0.8px); dibuat solid seperti sebelumnya. */}
        <EvilAreaChart.Area dataKey={kunci} variant="gradient" strokeVariant="solid" strokeWidth={1.75}>
          <EvilAreaChart.ActiveDot variant="default" />
        </EvilAreaChart.Area>
      </EvilAreaChart>
    </Panel>
  )
}