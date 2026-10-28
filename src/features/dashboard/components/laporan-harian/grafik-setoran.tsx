import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { angka, tanggalPendek } from "./format"
import { GAYA_HARI, KONFIG_GRAFIK, WARNA_BATANG } from "./konstanta"
import { Legenda } from "./legenda"
import { Seksi } from "./seksi"
import type { JenisHari, TitikGrafik } from "./tipe"

export function GrafikSetoran({
  grafik,
  jenisPer,
  rataKerja,
}: {
  grafik: TitikGrafik[]
  jenisPer: Map<string, JenisHari>
  rataKerja: number
}) {
  return (
    <Seksi
      judul="Setoran per Tanggal"
      chip={`${grafik.length} Hari`}
      deskripsi={`Rata-rata hari kerja ${angka(rataKerja)} setoran per hari.`}
    >
      <div className="flex flex-col gap-3 p-4">
        <ChartContainer config={KONFIG_GRAFIK} className="h-52 w-full sm:h-64">
          <BarChart data={grafik} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="tanggal"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v: string) => String(Number(v.slice(-2)))}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis tickLine={false} axisLine={false} width={44} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => {
                    const t = String(v)
                    return `${tanggalPendek(t)} · ${GAYA_HARI[jenisPer.get(t) ?? "kerja"].label}`
                  }}
                  formatter={(v) => ` ${angka(Number(v))} setoran`}
                />
              }
            />
            {rataKerja > 0 && (
              <ReferenceLine
                y={rataKerja}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
            )}
            <Bar dataKey="jumlah" radius={[3, 3, 0, 0]} maxBarSize={24}>
              {grafik.map((g) => (
                <Cell key={g.tanggal} fill={WARNA_BATANG[g.jenis]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <Legenda />
      </div>
    </Seksi>
  )
}
