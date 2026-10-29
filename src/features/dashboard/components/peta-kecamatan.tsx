"use client";

import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";

interface EChartsParams {
  name?: string;
  value?: number | string;
  seriesType?: string;
  data?: {
    item?: {
      tiket?: string;
      judul?: string;
      prioritas?: string;
      kelurahan?: string;
      alamat?: string;
    };
  };
}

interface PetaKecamatanProps {
  data?: Array<{ name: string; value: number }>;
  geoJsonData?: unknown;
}

export function PetaKecamatan({ data = [], geoJsonData }: PetaKecamatanProps) {
  if (geoJsonData) {
    echarts.registerMap("bandung_kelurahan", geoJsonData as Parameters<typeof echarts.registerMap>[1]);
  }

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (params: EChartsParams) => {
        if (params.seriesType === "effectScatter" && params.data?.item) {
          const item = params.data.item;
          return `
            <div style="font-family: inherit; font-size: 12px; padding: 4px;">
              <b>[${item.tiket}] ${item.judul}</b><br/>
              Prioritas: <span style="color: #ef4444; font-weight: bold;">${item.prioritas}</span><br/>
              Kelurahan: ${item.kelurahan || "-"}<br/>
              Alamat: ${item.alamat || "-"}
            </div>
          `;
        }
        return `
          <div style="font-family: inherit; font-size: 12px; padding: 4px;">
            <b>Kelurahan ${params.name || ""}</b><br/>
            Total: <b>${params.value !== undefined ? Number(params.value).toLocaleString("id-ID") : 0}</b>
          </div>
        `;
      },
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      borderColor: "rgba(255, 255, 255, 0.1)",
      textStyle: { color: "#fff" },
      borderRadius: 8,
      padding: 10,
    },
    visualMap: {
      type: "continuous" as const,
      min: 0,
      max: 100,
      left: "left",
      bottom: "bottom",
      text: ["Tinggi", "Rendah"],
      calculable: true,
      inRange: {
        color: ["#f0f9ff", "#bae6fd", "#38bdf8", "#0284c7", "#0369a1"],
      },
    },
    series: [
      {
        name: "Wilayah",
        type: "map",
        map: "bandung_kelurahan",
        roam: true,
        data: data,
        emphasis: {
          label: { show: true, color: "#000", fontSize: 10 },
          itemStyle: { areaColor: "#7dd3fc" },
        },
        itemStyle: {
          areaColor: "#f1f5f9",
          borderColor: "#cbd5e1",
          borderWidth: 0.5,
        },
        nameProperty: "nama",
      },
    ],
  };

  return (
    <div className="h-[538px] w-full">
      <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}