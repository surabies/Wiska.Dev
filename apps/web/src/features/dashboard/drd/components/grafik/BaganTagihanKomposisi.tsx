"use client"

import * as React from "react"
import ReactECharts from "echarts-for-react"
import { PanelDasbor } from "@/features/dashboard/shared/PanelDasbor"
import { formatRupiah } from "@/features/public/lib/Format"
import type { KomposisiTagihanDrd } from "../../types/TipeDrd"
import {
  WARNA_DRD,
  buatTooltipECharts,
  dapatkanOpsiGrid,
  dapatkanOpsiLegenda,
  formatRingkasRupiah,
} from "../../lib/BantuanGrafikDrd"

interface BaganTagihanKomposisiProps {
  komposisi: KomposisiTagihanDrd
}

export function BaganTagihanKomposisi({ komposisi }: BaganTagihanKomposisiProps) {
  const total =
    komposisi.totalTagihan > 0
      ? komposisi.totalTagihan
      : komposisi.hargaAir +
        komposisi.beaBeban +
        komposisi.beaAdmin +
        komposisi.airKotor +
        komposisi.lainLain

  const elemen = [
    {
      kunci: "hargaAir",
      label: "Harga Air",
      nilai: komposisi.hargaAir,
      warna: WARNA_DRD.biru,
      deskripsi: "Biaya tarif konsumsi m³",
    },
    {
      kunci: "beaBeban",
      label: "Beban Tetap",
      nilai: komposisi.beaBeban,
      warna: WARNA_DRD.amber,
      deskripsi: "Biaya pemeliharaan meter",
    },
    {
      kunci: "beaAdmin",
      label: "Administrasi",
      nilai: komposisi.beaAdmin,
      warna: WARNA_DRD.hijau,
      deskripsi: "Jasa pelayanan & loket",
    },
    {
      kunci: "airKotor",
      label: "Air Kotor",
      nilai: komposisi.airKotor,
      warna: WARNA_DRD.ungu,
      deskripsi: "Retribusi pengolahan limbah",
    },
    {
      kunci: "lainLain",
      label: "Lain-lain",
      nilai: komposisi.lainLain,
      warna: WARNA_DRD.slate,
      deskripsi: "Denda & retribusi pendukung",
    },
  ]

  const option = React.useMemo(() => {
    return {
      backgroundColor: "transparent",
      legend: dapatkanOpsiLegenda({ posisi: "top", align: "right" }),
      grid: dapatkanOpsiGrid({ left: 8, right: 16, top: 32, bottom: 8 }),
      tooltip: buatTooltipECharts({
        formatNilai: (val) => {
          const persen = total > 0 ? ((val / total) * 100).toFixed(1) : "0"
          return `${formatRupiah(val)} (${persen}%)`
        },
      }),
      xAxis: {
        type: "value" as const,
        max: total > 0 ? total : 100,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "category" as const,
        data: ["Komposisi Rekening"],
        show: false,
      },
      series: elemen.map((el) => ({
        name: el.label,
        type: "bar",
        stack: "total",
        data: [el.nilai],
        barWidth: 22,
        itemStyle: {
          color: el.warna,
        },
      })),
    }
  }, [elemen, total])

  return (
    <PanelDasbor
      label="Struktur Komponen Tagihan DRD"
      chip="Breakdown Rekening"
      deskripsi="Rincian pendapatan DRD berdasarkan komponen pembentuk rekening air."
    >
      <div className="flex flex-col gap-4 p-4">
        {/* Visualisasi ECharts Stacked Bar */}
        <div className="h-14 w-full">
          <ReactECharts
            option={option}
            style={{ height: "100%", width: "100%" }}
            notMerge={true}
            lazyUpdate={true}
          />
        </div>

        {/* Grid 5 Kartu Rincian Komponen Pembentuk Rekening */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {elemen.map((item, idx) => {
            const persen =
              total > 0 ? ((item.nilai / total) * 100).toFixed(1) : "0"
            return (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-lg border border-border/80 bg-card p-3 shadow-xs transition-colors"
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.warna }}
                    />
                    <p className="truncate text-xs font-semibold text-foreground">
                      {item.label}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {item.deskripsi}
                  </p>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatRingkasRupiah(item.nilai)}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
                    {persen}% dari DRD
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </PanelDasbor>
  )
}
