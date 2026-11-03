"use client"

import * as React from "react"
import ReactECharts from "echarts-for-react"
import { PanelDasbor } from "@/features/dashboard/shared/PanelDasbor"
import { formatRupiah } from "@/features/public/lib/Format"
import type { TitikTarifDrd } from "../../types/TipeDrd"
import {
  PALET_WARNA_DRD,
  WARNA_DRD,
  buatTooltipECharts,
} from "../../lib/BantuanGrafikDrd"

interface BaganTarifProps {
  data: TitikTarifDrd[]
}

export function BaganTarif({ data }: BaganTarifProps) {
  const totalOmzet = React.useMemo(
    () => data.reduce((acc, d) => acc + d.totalTagihan, 0),
    [data]
  )

  const seriData = React.useMemo(() => {
    return data.map((d) => ({
      name: `${d.kode} - ${d.nama}`,
      value: d.totalTagihan,
      kode: d.kode,
      pelanggan: d.jumlahPelanggan,
      pemakaian: d.pemakaianM3,
    }))
  }, [data])

  const option = React.useMemo(() => {
    return {
      backgroundColor: "transparent",
      color: PALET_WARNA_DRD,
      tooltip: buatTooltipECharts({
        formatNilai: (val) => formatRupiah(val),
      }),
      legend: {
        type: "scroll",
        orient: "vertical",
        right: 12,
        top: 20,
        bottom: 20,
        itemWidth: 10,
        itemHeight: 10,
        borderRadius: 2,
        textStyle: {
          color: WARNA_DRD.teksMuted,
          fontSize: 11,
          fontFamily: "inherit",
        },
        formatter: (nama: string) => {
          const item = seriData.find((d) => d.name === nama)
          if (!item || totalOmzet === 0) return nama
          const persen = ((item.value / totalOmzet) * 100).toFixed(1)
          const kodeRingkas = item.kode.length > 8 ? `${item.kode.slice(0, 7)}…` : item.kode
          return `${kodeRingkas} (${persen}%)`
        },
      },
      series: [
        {
          name: "Golongan Tarif",
          type: "pie",
          radius: ["44%", "72%"],
          center: ["32%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: "#ffffff",
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: "bold",
              formatter: "{b}\n{d}%",
            },
          },
          data: seriData,
        },
      ],
    }
  }, [seriData, totalOmzet])

  const dominan = data[0]
  const persenDominan =
    dominan && totalOmzet > 0
      ? ((dominan.totalTagihan / totalOmzet) * 100).toFixed(1)
      : "0"

  return (
    <PanelDasbor
      label="Struktur Tarif DRD"
      chip="Seluruh Golongan"
      deskripsi="Proporsi tagihan rekening air berdasarkan golongan tarif pelanggan."
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
              Belum ada data tarif untuk periode ini.
            </div>
          )}
        </div>

        {dominan && (
          <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
            <span className="text-muted-foreground">
              Kontribusi Terbesar:{" "}
              <strong className="text-foreground">
                {dominan.kode} ({dominan.nama})
              </strong>
            </span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatRupiah(dominan.totalTagihan)} ({persenDominan}%)
            </span>
          </div>
        )}
      </div>
    </PanelDasbor>
  )
}
