"use client"

// features/dashboard/components/dashboard/tren-penjualan.tsx — tren kubikasi
// (m³) dan nilai tagihan (Rp) per periode, satu panel dengan toggle.
// Data dari ambilTren() tanpa perubahan.
//
// Grafik SVG ringan (tanpa pustaka grafik) supaya tata letaknya terkendali:
//   - label sumbu-Y diletakkan DI DALAM area, di atas garis bantu → tidak ada
//     kolom kosong di kiri, jadi margin kiri = kanan = padding panel
//   - label sumbu-X hanya periode awal (rata kiri) dan akhir (rata kanan) →
//     tidak pernah meluber
//   - tooltip memakai TooltipGrafik bersama, mengikuti ujung kursor (berbalik
//     dan dijepit bila tidak muat) sehingga tidak keluar dari panel
import { useId, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { formatPeriode } from "@/features/public/lib/format"
import { Panel } from "../panel"
import { TooltipGrafik, type SeriTooltip } from "./tooltip-grafik"
import { jalurHalus, ringkasAngka, skalaRapi, useTooltipKursor, useUkuran } from "./grafik-util"

interface Titik {
  periode: number
  nilai: number
  jumlahTagihan: number
  pemakaianM3: number
}

type Mode = "m3" | "rupiah"

const MODE = {
  m3: {
    tombol: "m³",
    kunci: "pemakaianM3",
    label: "Kubikasi (m³)",
    warna: "var(--chart-1)",
    penuh: (n: number) => `${n.toLocaleString("id-ID")} m³`,
    ringkas: (n: number) => `${ringkasAngka(n)} m³`,
  },
  rupiah: {
    tombol: "Rupiah",
    kunci: "nilai",
    label: "Nilai tagihan",
    warna: "var(--chart-2)",
    penuh: (n: number) => `Rp ${n.toLocaleString("id-ID")}`,
    ringkas: (n: number) => `Rp ${ringkasAngka(n)}`,
  },
} as const

const ATAS = 16 // ruang untuk label teratas
const BAWAH = 24 // ruang untuk label sumbu-X

const teksSumbu = {
  fill: "var(--muted-foreground)",
  paintOrder: "stroke",
  stroke: "var(--card)",
  strokeWidth: 3,
} as const

function GrafikGaris({
  titik,
  kunci,
  warna,
  formatNilai,
  seri,
}: {
  titik: { label: string; nilai: number }[]
  kunci: string
  warna: string
  formatNilai: (n: number) => string
  seri: Record<string, SeriTooltip>
}) {
  const { pasang: pasangWadah, w, h } = useUkuran<HTMLDivElement>()
  const [aktif, setAktif] = useState<number | null>(null)
  const [kursor, setKursor] = useState<{ x: number; y: number } | null>(null)
  const { pasang: pasangTip, style: gayaTip } = useTooltipKursor<HTMLDivElement>({ w, h }, kursor)
  const gid = useId().replace(/:/g, "")

  const n = titik.length
  const tinggi = Math.max(h - ATAS - BAWAH, 0)
  const { puncak, ticks } = skalaRapi(Math.max(...titik.map((t) => t.nilai)))

  const x = (i: number) => (n > 1 ? (i / (n - 1)) * w : w / 2)
  const y = (v: number) => ATAS + tinggi - (v / puncak) * tinggi
  const dasar = ATAS + tinggi

  const garis = w > 0 ? jalurHalus(titik.map((t, i) => [x(i), y(t.nilai)] as const)) : ""

  function geser(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / w) * (n - 1))
    setKursor({ x: e.clientX - r.left, y: e.clientY - r.top })
    setAktif(Math.min(n - 1, Math.max(0, i)))
  }

  const titikAktif = aktif !== null ? titik[aktif] : null

  return (
    <div ref={pasangWadah} className="relative min-h-44 flex-1">
      {w > 0 && h > 0 && (
        <>
          <svg
            width={w}
            height={h}
            role="img"
            aria-label="Grafik tren per periode"
            className="absolute inset-0 touch-pan-y overflow-visible"
            onPointerMove={geser}
            onPointerDown={geser}
            onPointerLeave={() => setAktif(null)}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={warna} stopOpacity={0.2} />
                <stop offset="100%" stopColor={warna} stopOpacity={0} />
              </linearGradient>
            </defs>

            {ticks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={w}
                y1={y(t)}
                y2={y(t)}
                style={{ stroke: "var(--border)" }}
                strokeDasharray={t === 0 ? undefined : "3 3"}
              />
            ))}

            <path d={`${garis}L${w},${dasar}L0,${dasar}Z`} fill={`url(#${gid})`} />
            <path
              d={garis}
              fill="none"
              style={{ stroke: warna }}
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {aktif !== null && titikAktif && (
              <g>
                <line
                  x1={x(aktif)}
                  x2={x(aktif)}
                  y1={ATAS}
                  y2={dasar}
                  style={{ stroke: "var(--border)" }}
                />
                <circle
                  cx={x(aktif)}
                  cy={y(titikAktif.nilai)}
                  r={4}
                  style={{ fill: warna, stroke: "var(--card)" }}
                  strokeWidth={2}
                />
              </g>
            )}

            {/* Label sumbu-Y di dalam area, di atas garis bantu masing-masing. */}
            {ticks.map((t) => (
              <text key={t} x={0} y={y(t) - 4} fontSize={10} style={teksSumbu}>
                {ringkasAngka(t)}
              </text>
            ))}

            {/* Sumbu-X: awal rata kiri, akhir rata kanan. */}
            <text x={0} y={h - 6} fontSize={11} textAnchor="start" style={{ fill: "var(--muted-foreground)" }}>
              {titik[0].label}
            </text>
            <text x={w} y={h - 6} fontSize={11} textAnchor="end" style={{ fill: "var(--muted-foreground)" }}>
              {titik[n - 1].label}
            </text>
          </svg>

          {titikAktif && (
            <div ref={pasangTip} className="pointer-events-none absolute w-max" style={gayaTip}>
              <TooltipGrafik
                active
                payload={[{ dataKey: kunci, value: titikAktif.nilai }]}
                label={titikAktif.label}
                seri={seri}
                format={(v) => formatNilai(v)}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function TrenPenjualan({ data }: { data: Titik[] }) {
  const [mode, setMode] = useState<Mode>("m3")

  const dataGrafik = useMemo(
    () => data.map((t) => ({ ...t, label: formatPeriode(t.periode) })),
    [data]
  )

  const terakhir = data.at(-1)
  const sebelumnya = data.at(-2)

  if (!terakhir || !sebelumnya) {
    return (
      <Panel label="Tren Kubikasi & Tagihan" deskripsi="Butuh minimal dua periode.">
        <p className="text-sm text-muted-foreground">
          {terakhir
            ? `Baru ada periode ${formatPeriode(terakhir.periode)}: ${terakhir.pemakaianM3.toLocaleString("id-ID")} m³ · Rp ${terakhir.nilai.toLocaleString("id-ID")}`
            : "Belum ada data tagihan."}
        </p>
      </Panel>
    )
  }

  const m = MODE[mode]
  const kunci = m.kunci
  const nilaiTerakhir = terakhir[kunci]
  const nilaiLalu = sebelumnya[kunci]
  const rata = data.reduce((a, t) => a + t[kunci], 0) / data.length
  const delta = nilaiLalu > 0 ? ((nilaiTerakhir - nilaiLalu) / nilaiLalu) * 100 : undefined

  const titik = dataGrafik.map((t) => ({ label: t.label, nilai: t[kunci] }))

  return (
    <Panel label="Tren Kubikasi & Tagihan" deskripsi="Per periode.">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span title={m.penuh(nilaiTerakhir)} className="num-display truncate text-2xl leading-8">
                {m.ringkas(nilaiTerakhir)}
              </span>
              {delta !== undefined && (
                <span className="num text-muted-foreground shrink-0 text-xs">
                  {delta >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(delta).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {formatPeriode(terakhir.periode)} · rata-rata{" "}
              <span className="num text-foreground/80">{m.ringkas(Math.round(rata))}</span>
            </p>
          </div>

          <div className="bg-muted inline-flex h-7 shrink-0 items-center rounded-md p-0.5 text-xs">
            {(["m3", "rupiah"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                aria-pressed={mode === k}
                className={cn(
                  "focus-visible:ring-ring h-full rounded-sm px-2.5 font-medium transition-colors outline-none focus-visible:ring-2",
                  mode === k
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {MODE[k].tombol}
              </button>
            ))}
          </div>
        </div>

        <GrafikGaris
          key={mode}
          titik={titik}
          kunci={kunci}
          warna={m.warna}
          formatNilai={m.penuh}
          seri={{ [kunci]: { label: m.label, warna: m.warna } }}
        />
      </div>
    </Panel>
  )
}