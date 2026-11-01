"use client"

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatPeriode } from "@/features/public/lib/Format"
import type { DataProgresHarian } from "../types/TipeRingkasan"
import { AngkaPenuh, formatAngkaPenuh } from "./AngkaPenuh"
import { Panel } from "./Panel"

const KONFIG_GRAFIK = {
  jumlah: { label: "Masuk per hari", color: "var(--chart-1)" },
  kumulatif: { label: "Akumulasi periode", color: "var(--chart-2)" },
} satisfies ChartConfig

const tanggalPendek = (tanggal: string) => {
  const [tahun, bulan, hari] = tanggal.split("-")
  return `${Number(hari)} ${formatPeriode(Number(`${tahun}${bulan}`))
    .split(" ")[0]
    .slice(0, 3)}`
}

export function GrafikProgresHarian({
  data,
  periode,
}: {
  data: DataProgresHarian
  periode: number
}) {
  const total = (data.titik.at(-1)?.kumulatif ?? 0) + data.tanpaTanggal
  const puncak = data.titik.reduce(
    (tertinggi, titik) => (titik.jumlah > tertinggi.jumlah ? titik : tertinggi),
    { tanggal: "", jumlah: 0, kumulatif: 0 }
  )
  const nilaiHarianMaks = Math.max(0, ...data.titik.map((t) => t.jumlah))
  const nilaiAkumulasiMaks = Math.max(0, ...data.titik.map((t) => t.kumulatif))
  const lebarSumbu = (nilai: number) =>
    Math.min(76, Math.max(40, formatAngkaPenuh(nilai).length * 6 + 8))

  return (
    <Panel
      label="Progres Data Masuk"
      chip={`${formatAngkaPenuh(total)} laporan`}
      deskripsi="Jumlah laporan harian dan akumulasi periode berdasarkan tanggal catat WIB."
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="min-w-0 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <p className="label-micro text-[10px] text-muted-foreground">
              Total laporan
            </p>
            <p className="mt-1 min-w-0">
              <AngkaPenuh nilai={total} akhiran="laporan" kecil />
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {formatPeriode(periode)}
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <p className="label-micro text-[10px] text-muted-foreground">
              Puncak harian
            </p>
            <p className="mt-1 min-w-0">
              <AngkaPenuh nilai={puncak.jumlah} akhiran="laporan" kecil />
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {puncak.tanggal
                ? tanggalPendek(puncak.tanggal)
                : "Belum ada data"}
            </p>
          </div>
        </div>

        {data.titik.length > 0 ? (
          <ChartContainer
            config={KONFIG_GRAFIK}
            className="h-60 w-full min-w-0 sm:h-64"
          >
            <ComposedChart
              data={data.titik}
              margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="tanggal"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(tanggal: string) =>
                  String(Number(tanggal.slice(-2)))
                }
                interval="preserveStartEnd"
                minTickGap={12}
              />
              <YAxis
                yAxisId="harian"
                tickLine={false}
                axisLine={false}
                width={lebarSumbu(nilaiHarianMaks)}
                tickFormatter={formatAngkaPenuh}
              />
              <YAxis
                yAxisId="akumulasi"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={lebarSumbu(nilaiAkumulasiMaks)}
                tickFormatter={formatAngkaPenuh}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.45 }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(tanggal) =>
                      `${tanggalPendek(String(tanggal))} · ${formatPeriode(periode)}`
                    }
                    formatter={(nilai, nama) => (
                      <div className="flex w-full items-center justify-between gap-5">
                        <span className="text-muted-foreground">
                          {nama === "jumlah"
                            ? "Masuk per hari"
                            : "Akumulasi periode"}
                        </span>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {formatAngkaPenuh(Number(nilai))} laporan
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend
                verticalAlign="bottom"
                content={
                  <ChartLegendContent className="flex-wrap gap-x-5 gap-y-2 text-xs" />
                }
              />
              <Bar
                yAxisId="harian"
                dataKey="jumlah"
                fill="var(--color-jumlah)"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
              />
              <Line
                yAxisId="akumulasi"
                dataKey="kumulatif"
                type="monotone"
                stroke="var(--color-kumulatif)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada tanggal berjalan pada periode ini.
          </p>
        )}

        {data.tanpaTanggal > 0 && (
          <p className="text-xs text-warning">
            {formatAngkaPenuh(data.tanpaTanggal)} laporan tidak ditampilkan
            karena tanggal catat belum tersedia.
          </p>
        )}
      </div>
    </Panel>
  )
}
