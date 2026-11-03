"use client"

import * as React from "react"
import ReactECharts from "echarts-for-react"
import { PanelDasbor } from "@/features/dashboard/shared/PanelDasbor"
import {
  WARNA_DRD,
  buatTooltipECharts,
  formatRibuan,
} from "../../lib/BantuanGrafikDrd"

interface BaganTaaStatusProps {
  status: {
    normal: number
    taa: number
    persenTaa: number
    sebaranTarif: Array<{ kode: string; jumlahTaa: number }>
  }
}

export function BaganTaaStatus({ status }: BaganTaaStatusProps) {
  const dataPie = React.useMemo(() => {
    return [
      {
        name: "Layanan Normal",
        value: status.normal,
        itemStyle: { color: WARNA_DRD.hijau },
      },
      {
        name: "Tidak Ada Air (TAA)",
        value: status.taa,
        itemStyle: { color: WARNA_DRD.merah },
      },
    ]
  }, [status.normal, status.taa])

  const option = React.useMemo(() => {
    return {
      backgroundColor: "transparent",
      tooltip: buatTooltipECharts({
        formatNilai: (val) => `${formatRibuan(val)} Sambungan`,
      }),
      series: [
        {
          name: "Status Aliran Air",
          type: "pie",
          radius: ["48%", "74%"],
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
          data: dataPie,
        },
      ],
    }
  }, [dataPie])

  return (
    <PanelDasbor
      label="Rasio Layanan & Status TAA"
      chip="Indikator Kelancaran"
      deskripsi="Perbandingan sambungan yang mengalir normal vs mengalami kendala Tidak Ada Air."
    >
      <div className="flex h-full flex-col justify-between p-4">
        <div className="grid h-[260px] grid-cols-1 gap-2 sm:grid-cols-12 items-center">
          {/* Kolom Donut ECharts */}
          <div className="h-full sm:col-span-7">
            <ReactECharts
              option={option}
              style={{ height: "100%", width: "100%" }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>

          {/* Kolom Sebaran Tarif Terdampak */}
          <div className="flex flex-col justify-center rounded-lg border border-border/70 bg-muted/20 p-3 sm:col-span-5">
            <p className="text-[11px] font-semibold text-foreground mb-2">
              Tarif Terdampak Gangguan
            </p>
            {status.sebaranTarif.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {status.sebaranTarif.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-muted-foreground">
                      {item.kode}
                    </span>
                    <span className="font-semibold text-destructive tabular-nums">
                      {formatRibuan(item.jumlahTaa)} SL
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tidak ada data tarif terdampak.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
          <span className="text-muted-foreground">
            Tingkat Gangguan Layanan:
          </span>
          <span className="font-semibold text-foreground tabular-nums">
            {status.persenTaa.toFixed(2)}% dari total sambungan
          </span>
        </div>
      </div>
    </PanelDasbor>
  )
}
