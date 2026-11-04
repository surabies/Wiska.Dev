// features/dashboard/drd/lib/BantuanGrafikDrd.ts
// Helper pemformat teks, warna, sumbu, tooltip, dan konfigurasi ECharts untuk Laporan DRD.

/** Palet warna konsisten dengan token desain Geist & Tailwind */
export const WARNA_DRD = {
  biru: "#2563eb", // --chart-1
  amber: "#f59e0b", // --chart-2
  hijau: "#10b981", // --chart-3
  ungu: "#8b5cf6", // --chart-4
  teal: "#06b6d4", // --chart-5
  merah: "#ef4444", // --destructive
  merahMuda: "#ec4899",
  jingga: "#f97316",
  slate: "#64748b",
  teksMuted: "#64748b",
  teksUtama: "#0f172a",
  garisPemisah: "#e2e8f0",
  garisGrid: "#f1f5f9",
  latarTooltip: "rgba(15, 23, 42, 0.94)",
} as const

export const PALET_WARNA_DRD: string[] = [
  WARNA_DRD.biru,
  WARNA_DRD.amber,
  WARNA_DRD.hijau,
  WARNA_DRD.ungu,
  WARNA_DRD.teal,
  WARNA_DRD.merahMuda,
  WARNA_DRD.jingga,
  WARNA_DRD.slate,
]

/** Format rupiah ringkas untuk sumbu dan legend (misal: "Rp 1,5 M", "Rp 850 jt", "Rp 120 rb") */
export function formatRingkasRupiah(n: number): string {
  const mutlak = Math.abs(n)
  const tanda = n < 0 ? "-" : ""
  if (mutlak >= 1_000_000_000) {
    return `${tanda}Rp ${(mutlak / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
  }
  if (mutlak >= 1_000_000) {
    return `${tanda}Rp ${(mutlak / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
  }
  if (mutlak >= 1_000) {
    return `${tanda}Rp ${(mutlak / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`
  }
  return `${tanda}Rp ${mutlak.toLocaleString("id-ID")}`
}

/** Format volume kubikasi ringkas (misal: "12,4 rb m³", "1,2 jt m³") */
export function formatRingkasVolume(n: number): string {
  const mutlak = Math.abs(n)
  const tanda = n < 0 ? "-" : ""
  if (mutlak >= 1_000_000) {
    return `${tanda}${(mutlak / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt m³`
  }
  if (mutlak >= 1_000) {
    return `${tanda}${(mutlak / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb m³`
  }
  return `${tanda}${mutlak.toLocaleString("id-ID")} m³`
}

/** Format angka cacah ringkas (misal: "1,5 rb SL", "25 rb") */
export function formatRingkasAngka(n: number): string {
  const mutlak = Math.abs(n)
  const tanda = n < 0 ? "-" : ""
  if (mutlak >= 1_000_000) {
    return `${tanda}${(mutlak / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
  }
  if (mutlak >= 1_000) {
    return `${tanda}${(mutlak / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`
  }
  return `${tanda}${mutlak.toLocaleString("id-ID")}`
}

/** Format ribuan standar Indonesia */
export function formatRibuan(n: number): string {
  return n.toLocaleString("id-ID")
}

/** Potong teks jika melebihi batas karakter */
export function potongTeks(teks: string, batas = 14): string {
  if (!teks) return ""
  return teks.length > batas ? `${teks.slice(0, batas - 1)}…` : teks
}

/** Opsi grid ECharts seimbang dan responsif */
export function dapatkanOpsiGrid(opsi?: {
  left?: number | string
  right?: number | string
  top?: number | string
  bottom?: number | string
}) {
  return {
    left: opsi?.left ?? 16,
    right: opsi?.right ?? 20,
    top: opsi?.top ?? 36,
    bottom: opsi?.bottom ?? 16,
    containLabel: true,
  }
}

/** Opsi sumbu kategori (sumbu X atau Y) dengan font dan tata letak seimbang */
export function dapatkanOpsiSumbuKategori(
  kategori: string[],
  posisi: "x" | "y" = "x",
  rotasi = 0
) {
  return {
    type: "category" as const,
    data: kategori,
    axisLine: {
      lineStyle: { color: WARNA_DRD.garisPemisah },
    },
    axisTick: {
      alignWithLabel: true,
      lineStyle: { color: WARNA_DRD.garisPemisah },
    },
    axisLabel: {
      color: WARNA_DRD.teksMuted,
      fontSize: 11,
      fontFamily: "inherit",
      rotate: rotasi,
      formatter: (val: string) => potongTeks(val, posisi === "y" ? 14 : 11),
    },
  }
}

/** Opsi sumbu nilai numerik (Rupiah, m³, atau jumlah) */
export function dapatkanOpsiSumbuNilai(
  tipe: "rupiah" | "volume" | "angka",
  posisi: "x" | "y" = "y",
  namaSumbu?: string
) {
  const formatter = (val: number) => {
    if (tipe === "rupiah") return formatRingkasRupiah(val)
    if (tipe === "volume") return formatRingkasVolume(val)
    return formatRingkasAngka(val)
  }

  return {
    type: "value" as const,
    name: namaSumbu,
    nameTextStyle: {
      color: WARNA_DRD.teksMuted,
      fontSize: 11,
      fontFamily: "inherit",
      padding: [0, 0, 4, 0],
    },
    axisLine: {
      show: posisi === "x",
      lineStyle: { color: WARNA_DRD.garisPemisah },
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: WARNA_DRD.teksMuted,
      fontSize: 11,
      fontFamily: "inherit",
      formatter,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: WARNA_DRD.garisGrid,
        type: "dashed" as const,
      },
    },
  }
}

interface ItemTooltipECharts {
  seriesName?: string
  marker?: string
  color?: string
  value?: number | string | Array<number | string>
  name?: string
  percent?: number
}

/** Format tooltip ECharts dengan desain popover modern, tajam, dan mudah dibaca */
export function buatTooltipECharts(opsi?: {
  tipeNilai?: "rupiah" | "volume" | "angka" | "persen"
  formatNilai?: (v: number, seri?: string) => string
}) {
  return {
    trigger: "axis" as const,
    backgroundColor: WARNA_DRD.latarTooltip,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    padding: [10, 12],
    extraCssText:
      "border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px);",
    textStyle: {
      color: "#f8fafc",
      fontSize: 12,
      fontFamily: "inherit",
    },
    formatter: (rawParams: unknown) => {
      const items = (Array.isArray(rawParams) ? rawParams : [rawParams]) as ItemTooltipECharts[]
      if (!items.length) return ""

      const judul = items[0]?.name || items[0]?.seriesName || ""
      const baris = items
        .map((it) => {
          let nilai = it.value
          if (Array.isArray(nilai)) {
            // Jika koordinat [x, y], ambil nilai y
            nilai = nilai[1] ?? nilai[0]
          }
          const num = typeof nilai === "number" ? nilai : Number(nilai) || 0

          let tampilanNilai = opsi?.formatNilai
            ? opsi.formatNilai(num, it.seriesName)
            : opsi?.tipeNilai === "rupiah"
              ? `Rp ${formatRibuan(num)}`
              : opsi?.tipeNilai === "volume"
                ? `${formatRibuan(num)} m³`
                : opsi?.tipeNilai === "persen"
                  ? `${num.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
                  : `${formatRibuan(num)}`

          if (it.percent !== undefined) {
            tampilanNilai += ` (${it.percent.toFixed(1)}%)`
          }

          const warna = it.color || WARNA_DRD.biru

          return `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${warna};"></span>
                <span style="color: #cbd5e1; font-size: 11px;">${it.seriesName || "Nilai"}</span>
              </div>
              <span style="font-weight: 600; font-family: monospace; font-size: 12px; color: #ffffff;">${tampilanNilai}</span>
            </div>
          `
        })
        .join("")

      return `
        <div style="min-width: 140px;">
          <div style="font-weight: 600; font-size: 12px; color: #ffffff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px;">
            ${judul}
          </div>
          ${baris}
        </div>
      `
    },
  }
}

/** Konfigurasi legenda standar */
export function dapatkanOpsiLegenda(opsi?: {
  posisi?: "top" | "bottom"
  align?: "left" | "right" | "center"
}) {
  return {
    show: true,
    [opsi?.posisi ?? "top"]: 6,
    [opsi?.align ?? "right"]: 12,
    itemWidth: 12,
    itemHeight: 8,
    borderRadius: 2,
    textStyle: {
      color: WARNA_DRD.teksMuted,
      fontSize: 11,
      fontFamily: "inherit",
    },
  }
}
