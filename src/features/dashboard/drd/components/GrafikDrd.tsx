"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { PanelDasbor } from "@/features/dashboard/shared/PanelDasbor"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/features/dashboard/api/ApiDashboard"
import { ambilGrafikDrd } from "../api/ApiDrd"
import type { TitikGrafikDrd } from "../types/TipeDrd"

const METRIK = [
  {
    kunci: "jumlahPelanggan",
    judul: "Pelanggan",
    warna: "var(--chart-1)",
    format: (nilai: number) => nilai.toLocaleString("id-ID"),
  },
  {
    kunci: "pemakaianM3",
    judul: "Pemakaian (m³)",
    warna: "var(--chart-2)",
    format: (nilai: number) => `${nilai.toLocaleString("id-ID")} m³`,
  },
  {
    kunci: "totalTagihan",
    judul: "Nilai tagihan",
    warna: "var(--chart-3)",
    format: (nilai: number) => `Rp ${nilai.toLocaleString("id-ID")}`,
  },
] as const

const KONFIG: ChartConfig = {
  jumlahPelanggan: {
    label: METRIK[0].judul,
    color: METRIK[0].warna,
  },
  pemakaianM3: {
    label: METRIK[1].judul,
    color: METRIK[1].warna,
  },
  totalTagihan: {
    label: METRIK[2].judul,
    color: METRIK[2].warna,
  },
}

function GrafikMetrik({
  data,
  metrik,
}: {
  data: TitikGrafikDrd[]
  metrik: (typeof METRIK)[number]
}) {
  const config = { [metrik.kunci]: KONFIG[metrik.kunci] }

  return (
    <PanelDasbor label={metrik.judul} className="min-w-0 p-3 sm:p-4">
      <ChartContainer config={config} className="h-56 w-full min-w-0">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={(nilai: number) =>
              metrik.kunci === "totalTagihan"
                ? formatSumbuRupiah(nilai)
                : formatSumbuAngka(nilai)
            }
          />
          <YAxis
            type="category"
            dataKey="kategori"
            width={88}
            tickLine={false}
            axisLine={false}
            tickFormatter={(nilai: string) =>
              nilai.length > 14 ? `${nilai.slice(0, 13)}…` : nilai
            }
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.45 }}
            content={
              <ChartTooltipContent
                formatter={(nilai) => metrik.format(Number(nilai))}
              />
            }
          />
          <Bar
            dataKey={metrik.kunci}
            fill={`var(--color-${metrik.kunci})`}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ChartContainer>
    </PanelDasbor>
  )
}

function formatSumbuAngka(nilai: number) {
  if (nilai >= 1_000_000) return `${(nilai / 1_000_000).toFixed(1)} jt`
  if (nilai >= 1_000) return `${(nilai / 1_000).toFixed(0)} rb`
  return nilai.toLocaleString("id-ID")
}

function formatSumbuRupiah(nilai: number) {
  if (nilai >= 1_000_000_000)
    return `Rp ${(nilai / 1_000_000_000).toFixed(1)} M`
  if (nilai >= 1_000_000) return `Rp ${(nilai / 1_000_000).toFixed(0)} jt`
  if (nilai >= 1_000) return `Rp ${(nilai / 1_000).toFixed(0)} rb`
  return `Rp ${nilai}`
}

export function GrafikDrd({ periode }: { periode: number | null }) {
  const [data, setData] = React.useState<TitikGrafikDrd[]>([])
  const [galat, setGalat] = React.useState<string | null>(null)
  const [memuat, setMemuat] = React.useState(false)

  React.useEffect(() => {
    if (periode === null) {
      setData([])
      setGalat(null)
      setMemuat(false)
      return
    }

    let batal = false
    setMemuat(true)
    setGalat(null)
    ambilGrafikDrd(periode, "ringkasan")
      .then((hasil) => {
        if (!batal) setData(hasil)
      })
      .catch((error: unknown) => {
        if (!batal) {
          setData([])
          setGalat(
            error instanceof ApiError
              ? error.message
              : "Grafik DRD gagal dimuat."
          )
        }
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })

    return () => {
      batal = true
    }
  }, [periode])

  if (galat) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{galat}</AlertDescription>
      </Alert>
    )
  }

  if (memuat) {
    return (
      <div className="grid shrink-0 grid-cols-1 gap-3 pb-1 sm:grid-cols-2 xl:grid-cols-3">
        {METRIK.map((metrik) => (
          <Skeleton key={metrik.kunci} className="h-72 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada data untuk ditampilkan sebagai grafik.
      </p>
    )
  }

  return (
    <div className="shrink-0 space-y-2">
      <p className="text-xs text-muted-foreground">
        8 kelompok teratas berdasarkan total tagihan
      </p>
      <div className="grid grid-cols-1 gap-3 pb-1 sm:grid-cols-2 xl:grid-cols-3">
        {METRIK.map((metrik) => (
          <div key={metrik.kunci} className="min-w-0">
            <GrafikMetrik data={data} metrik={metrik} />
          </div>
        ))}
      </div>
    </div>
  )
}
