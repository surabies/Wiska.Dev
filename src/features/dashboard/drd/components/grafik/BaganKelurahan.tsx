"use client"

import * as React from "react"
import ReactECharts from "echarts-for-react"
import { Button } from "@/components/ui/button"
import { PanelDasbor } from "@/features/dashboard/shared/PanelDasbor"
import type { TitikKelurahanDrd } from "../../types/TipeDrd"
import {
  WARNA_DRD,
  buatTooltipECharts,
  dapatkanOpsiGrid,
  dapatkanOpsiSumbuKategori,
  dapatkanOpsiSumbuNilai,
} from "../../lib/BantuanGrafikDrd"

interface BaganKelurahanProps {
  data: TitikKelurahanDrd[]
}

export function BaganKelurahan({ data }: BaganKelurahanProps) {
  const [metrik, setMetrik] = React.useState<"tagihan" | "pemakaian">("tagihan")

  // Urutkan data berdasarkan metrik terpilih dan balik agar peringkat #1 di paling atas
  const dataSorted = React.useMemo(() => {
    const salinan = [...data]
    salinan.sort((a, b) =>
      metrik === "tagihan"
        ? a.totalTagihan - b.totalTagihan
        : a.pemakaianM3 - b.pemakaianM3
    )
    return salinan
  }, [data, metrik])

  const kategori = dataSorted.map((d) => d.kelurahan)
  const nilai = dataSorted.map((d) =>
    metrik === "tagihan" ? d.totalTagihan : d.pemakaianM3
  )

  const option = React.useMemo(() => {
    return {
      backgroundColor: "transparent",
      grid: dapatkanOpsiGrid({ left: 8, right: 24, top: 16, bottom: 8 }),
      tooltip: buatTooltipECharts({
        tipeNilai: metrik === "tagihan" ? "rupiah" : "volume",
      }),
      xAxis: dapatkanOpsiSumbuNilai(
        metrik === "tagihan" ? "rupiah" : "volume",
        "x"
      ),
      yAxis: dapatkanOpsiSumbuKategori(kategori, "y"),
      series: [
        {
          name: metrik === "tagihan" ? "Total Tagihan" : "Pemakaian Air",
          type: "bar",
          data: nilai,
          barMaxWidth: 18,
          itemStyle: {
            color: metrik === "tagihan" ? WARNA_DRD.biru : WARNA_DRD.teal,
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    }
  }, [kategori, nilai, metrik])

  return (
    <PanelDasbor
      label="Distribusi Kelurahan"
      chip="Top 8 Wilayah"
      deskripsi="Peringkat kelurahan dengan kontribusi tagihan dan pemakaian air terbesar."
    >
      <div className="flex h-full flex-col justify-between p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {metrik === "tagihan"
              ? "Nilai total tagihan rekening air per wilayah kelurahan."
              : "Volume pemakaian air (m³) per wilayah kelurahan."}
          </p>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-muted/40">
            <Button
              type="button"
              variant={metrik === "tagihan" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMetrik("tagihan")}
              className="h-6 px-2.5 text-[11px]"
            >
              Tagihan (Rp)
            </Button>
            <Button
              type="button"
              variant={metrik === "pemakaian" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMetrik("pemakaian")}
              className="h-6 px-2.5 text-[11px]"
            >
              Pemakaian (m³)
            </Button>
          </div>
        </div>

        <div className="h-[270px] w-full">
          {data.length > 0 ? (
            <ReactECharts
              option={option}
              style={{ height: "100%", width: "100%" }}
              notMerge={true}
              lazyUpdate={true}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Belum ada data kelurahan untuk periode ini.
            </div>
          )}
        </div>
      </div>
    </PanelDasbor>
  )
}
