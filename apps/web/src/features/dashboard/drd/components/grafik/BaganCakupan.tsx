"use client"

import * as React from "react"
import ReactECharts from "echarts-for-react"
import { PanelDasbor } from "@/features/dashboard/shared/PanelDasbor"
import type { TitikCakupanDrd } from "../../types/TipeDrd"
import {
  WARNA_DRD,
  buatTooltipECharts,
  dapatkanOpsiGrid,
  dapatkanOpsiLegenda,
  dapatkanOpsiSumbuKategori,
  dapatkanOpsiSumbuNilai,
} from "../../lib/BantuanGrafikDrd"

interface BaganCakupanProps {
  data: TitikCakupanDrd[]
}

export function BaganCakupan({ data }: BaganCakupanProps) {
  const kategori = data.map((d) => d.kelurahan)
  const dataSl = data.map((d) => d.sl)
  const dataVolume = data.map((d) => d.pemakaianM3)

  const option = React.useMemo(() => {
    return {
      backgroundColor: "transparent",
      legend: dapatkanOpsiLegenda({ posisi: "top", align: "right" }),
      grid: dapatkanOpsiGrid({ left: 12, right: 16, top: 40, bottom: 20 }),
      tooltip: buatTooltipECharts({
        formatNilai: (val, seri) =>
          seri === "Sambungan Langganan"
            ? `${val.toLocaleString("id-ID")} SL`
            : `${val.toLocaleString("id-ID")} m³`,
      }),
      xAxis: dapatkanOpsiSumbuKategori(kategori, "x", 15),
      yAxis: [
        dapatkanOpsiSumbuNilai("angka", "y", "SL"),
        {
          ...dapatkanOpsiSumbuNilai("volume", "y", "Volume m³"),
          position: "right" as const,
          splitLine: { show: false }, // Jangan timpa garis grid sumbu kiri
        },
      ],
      series: [
        {
          name: "Sambungan Langganan",
          type: "bar",
          yAxisIndex: 0,
          data: dataSl,
          barMaxWidth: 20,
          itemStyle: {
            color: WARNA_DRD.biru,
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: "Volume Pemakaian",
          type: "line",
          yAxisIndex: 1,
          data: dataVolume,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          itemStyle: {
            color: WARNA_DRD.amber,
          },
          lineStyle: {
            width: 2.5,
            color: WARNA_DRD.amber,
          },
        },
      ],
    }
  }, [kategori, dataSl, dataVolume])

  return (
    <PanelDasbor
      label="Cakupan Layanan Wilayah"
      chip="SL vs Pemakaian"
      deskripsi="Perbandingan jumlah sambungan pelanggan (SL) dengan volume konsumsi air per kelurahan."
    >
      <div className="flex h-full flex-col justify-between p-4">
        <div className="h-75 w-full">
          {data.length > 0 ? (
            <ReactECharts
              option={option}
              style={{ height: "100%", width: "100%" }}
              notMerge={true}
              lazyUpdate={true}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Belum ada data cakupan layanan untuk periode ini.
            </div>
          )}
        </div>
      </div>
    </PanelDasbor>
  )
}
