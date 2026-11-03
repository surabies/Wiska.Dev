"use client"

import * as React from "react"
import ReactECharts from "echarts-for-react"
import { PanelDasbor } from "@/features/dashboard/shared/PanelDasbor"
import { formatRupiah } from "@/features/public/lib/Format"
import type { TitikTarifDrd } from "../../types/TipeDrd"
import {
  WARNA_DRD,
  buatTooltipECharts,
  dapatkanOpsiGrid,
  dapatkanOpsiSumbuKategori,
  dapatkanOpsiSumbuNilai,
  formatRibuan,
} from "../../lib/BantuanGrafikDrd"

interface BaganDomestikProps {
  data: TitikTarifDrd[]
}

export function BaganDomestik({ data }: BaganDomestikProps) {
  const kategori = data.map((d) => d.kode)
  const nilaiVolume = data.map((d) => d.pemakaianM3)

  const { totalPelanggan, totalVolume, totalTagihan } = React.useMemo(() => {
    return data.reduce(
      (acc, d) => ({
        totalPelanggan: acc.totalPelanggan + d.jumlahPelanggan,
        totalVolume: acc.totalVolume + d.pemakaianM3,
        totalTagihan: acc.totalTagihan + d.totalTagihan,
      }),
      { totalPelanggan: 0, totalVolume: 0, totalTagihan: 0 }
    )
  }, [data])

  const rataVolume =
    totalPelanggan > 0
      ? (totalVolume / totalPelanggan).toLocaleString("id-ID", {
          maximumFractionDigits: 1,
        })
      : "0"

  const option = React.useMemo(() => {
    return {
      backgroundColor: "transparent",
      grid: dapatkanOpsiGrid({ left: 12, right: 16, top: 24, bottom: 20 }),
      tooltip: buatTooltipECharts({
        formatNilai: (val) => `${formatRibuan(val)} m³`,
      }),
      xAxis: dapatkanOpsiSumbuKategori(kategori, "x", 0),
      yAxis: dapatkanOpsiSumbuNilai("volume", "y", "Volume m³"),
      series: [
        {
          name: "Pemakaian Domestik",
          type: "bar",
          data: nilaiVolume,
          barMaxWidth: 26,
          itemStyle: {
            color: WARNA_DRD.teal,
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }
  }, [kategori, nilaiVolume])

  return (
    <PanelDasbor
      label="Segmentasi Domestik"
      chip="Tangga Tarif RT"
      deskripsi="Volume pemakaian air pada kelompok tangga tarif rumah tangga (1A, 2A1–2A5, 3A)."
    >
      <div className="flex h-full flex-col justify-between p-4">
        <div className="h-[260px] w-full">
          {data.length > 0 ? (
            <ReactECharts
              option={option}
              style={{ height: "100%", width: "100%" }}
              notMerge={true}
              lazyUpdate={true}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Belum ada data domestik untuk periode ini.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
          <span className="text-muted-foreground">
            Total SL Domestik:{" "}
            <strong className="text-foreground">
              {formatRibuan(totalPelanggan)} SL
            </strong>{" "}
            · Rata-rata:{" "}
            <strong className="text-foreground">{rataVolume} m³/SL</strong>
          </span>
          <span className="font-semibold text-foreground tabular-nums">
            {formatRupiah(totalTagihan)}
          </span>
        </div>
      </div>
    </PanelDasbor>
  )
}
