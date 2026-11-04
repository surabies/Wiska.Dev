"use client"

import * as React from "react"
import ReactECharts from "echarts-for-react"
import { PanelDasbor } from "@/features/dashboard/shared/PanelDasbor"
import type { TitikTaaKelurahanDrd } from "../../types/TipeDrd"
import {
  WARNA_DRD,
  buatTooltipECharts,
  dapatkanOpsiGrid,
  dapatkanOpsiSumbuKategori,
  dapatkanOpsiSumbuNilai,
  formatRibuan,
} from "../../lib/BantuanGrafikDrd"

interface BaganTaaKelurahanProps {
  data: TitikTaaKelurahanDrd[]
}

export function BaganTaaKelurahan({ data }: BaganTaaKelurahanProps) {
  // Balik agar peringkat teratas muncul di atas
  const dataSorted = React.useMemo(() => {
    return [...data].reverse()
  }, [data])

  const kategori = dataSorted.map((d) => d.kelurahan)
  const nilai = dataSorted.map((d) => d.jumlahTaa)

  const totalTaaTop = React.useMemo(() => {
    return data.reduce((acc, d) => acc + d.jumlahTaa, 0)
  }, [data])

  const option = React.useMemo(() => {
    return {
      backgroundColor: "transparent",
      grid: dapatkanOpsiGrid({ left: 8, right: 24, top: 20, bottom: 8 }),
      tooltip: buatTooltipECharts({
        formatNilai: (val) => `${formatRibuan(val)} kasus TAA`,
      }),
      xAxis: dapatkanOpsiSumbuNilai("angka", "x"),
      yAxis: dapatkanOpsiSumbuKategori(kategori, "y"),
      series: [
        {
          name: "Kasus TAA",
          type: "bar",
          data: nilai,
          barMaxWidth: 18,
          itemStyle: {
            color: WARNA_DRD.merah,
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    }
  }, [kategori, nilai])

  return (
    <PanelDasbor
      label="Sebaran Kasus TAA per Kelurahan"
      chip="Titik Gangguan"
      deskripsi="Kelurahan dengan konsentrasi insiden Tidak Ada Air (TAA) tertinggi pada periode aktif."
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
              Tidak ada laporan kasus TAA pada periode ini.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
          <span className="text-muted-foreground">
            Akumulasi Top {data.length} Wilayah Terdampak:
          </span>
          <span className="font-semibold text-destructive tabular-nums">
            {formatRibuan(totalTaaTop)} kasus TAA
          </span>
        </div>
      </div>
    </PanelDasbor>
  )
}
