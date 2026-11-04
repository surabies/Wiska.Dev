"use client"

// features/dashboard/ringkasan/components/TrenPenjualan.tsx — tren kubikasi
// (m³) dan nilai tagihan (Rp) per periode, satu panel dengan toggle.
// Data mencakup enam periode sampai periode yang dipilih.
//
// Grafik SVG ringan (tanpa pustaka grafik) supaya tata letaknya terkendali:
//   - label sumbu-Y diletakkan DI DALAM area, di atas garis bantu → tidak ada
//     kolom kosong di kiri, jadi margin kiri = kanan = padding panel
//   - label sumbu-X menampilkan keenam bulan
//   - tooltip memakai TooltipGrafik bersama, mengikuti ujung kursor (berbalik
//     dan dijepit bila tidak muat) sehingga tidak keluar dari panel
import { useId, useMemo, useState } from "react"
import { cn } from "@/lib/Utilitas"
import { formatPeriode } from "@/features/public/lib/Format"
import type { TitikTren } from "../types/TipeRingkasan"
import { Panel } from "./Panel"
import { AngkaPenuh, formatAngkaPenuh } from "./AngkaPenuh"
import { TooltipGrafik, type SeriTooltip } from "./TooltipGrafik"
import {
  jalurHalus,
  skalaRapi,
  singkatPeriode,
  useTooltipKursor,
  useUkuran,
} from "../lib/GrafikUtilitas"

type Mode = "m3" | "rupiah"

const MODE = {
  m3: {
    tombol: "m³",
    kunci: "pemakaianM3",
    label: "Kubikasi (m³)",
    warna: "var(--chart-1)",
    penuh: (n: number) => `${n.toLocaleString("id-ID")} m³`,
  },
  rupiah: {
    tombol: "Rupiah",
    kunci: "nilai",
    label: "Nilai tagihan",
    warna: "var(--chart-2)",
    penuh: (n: number) => `Rp ${n.toLocaleString("id-ID")}`,
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
  titik: { label: string; nilai: number | null; status: TitikTren["status"] }[]
  kunci: string
  warna: string
  formatNilai: (n: number) => string
  seri: Record<string, SeriTooltip>
}) {
  const { pasang: pasangWadah, w, h } = useUkuran<HTMLDivElement>()
  const [aktif, setAktif] = useState<number | null>(null)
  const [kursor, setKursor] = useState<{ x: number; y: number } | null>(null)
  const { pasang: pasangTip, style: gayaTip } =
    useTooltipKursor<HTMLDivElement>({ w, h }, kursor)
  const gid = useId().replace(/:/g, "")

  const n = titik.length
  const tinggi = Math.max(h - ATAS - BAWAH, 0)
  const nilaiTersedia = titik.flatMap((t) =>
    t.nilai === null ? [] : [t.nilai]
  )
  const { puncak, ticks } = skalaRapi(Math.max(...nilaiTersedia, 0))

  const x = (i: number) => (n > 1 ? (i / (n - 1)) * w : w / 2)
  const y = (v: number) => ATAS + tinggi - (v / puncak) * tinggi
  const dasar = ATAS + tinggi

  const segmen: { indeks: number; nilai: number }[][] = []
  for (const [indeks, t] of titik.entries()) {
    const terakhir = segmen.at(-1)
    if (t.nilai === null) continue
    if (terakhir && terakhir.at(-1)?.indeks === indeks - 1) {
      terakhir.push({ indeks, nilai: t.nilai })
    } else {
      segmen.push([{ indeks, nilai: t.nilai }])
    }
  }

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

            {w > 0 &&
              segmen.map((bagian) => {
                const koordinat = bagian.map(
                  (t) => [x(t.indeks), y(t.nilai)] as const
                )
                const garis = jalurHalus(koordinat)
                const pertama = bagian[0]
                const terakhir = bagian.at(-1)!
                return (
                  <g key={pertama.indeks}>
                    {bagian.length > 1 && (
                      <path
                        d={`${garis}L${x(terakhir.indeks)},${dasar}L${x(pertama.indeks)},${dasar}Z`}
                        fill={`url(#${gid})`}
                      />
                    )}
                    <path
                      d={garis}
                      fill="none"
                      style={{ stroke: warna }}
                      strokeWidth={1.75}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </g>
                )
              })}

            {aktif !== null && titikAktif && (
              <g>
                <line
                  x1={x(aktif)}
                  x2={x(aktif)}
                  y1={ATAS}
                  y2={dasar}
                  style={{ stroke: "var(--border)" }}
                />
                {titikAktif.nilai !== null && (
                  <circle
                    cx={x(aktif)}
                    cy={y(titikAktif.nilai)}
                    r={4}
                    style={{ fill: warna, stroke: "var(--card)" }}
                    strokeWidth={2}
                  />
                )}
              </g>
            )}

            {titik.map(
              (t, i) =>
                t.status === "berjalan" &&
                t.nilai !== null && (
                  <circle
                    key={t.label}
                    cx={x(i)}
                    cy={y(t.nilai)}
                    r={4}
                    fill="var(--card)"
                    style={{ stroke: warna }}
                    strokeWidth={2}
                    strokeDasharray="2 2"
                  />
                )
            )}

            {/* Label sumbu-Y di dalam area, di atas garis bantu masing-masing. */}
            {ticks.map((t) => (
              <text key={t} x={0} y={y(t) - 4} fontSize={10} style={teksSumbu}>
                {formatAngkaPenuh(t)}
              </text>
            ))}

            {titik.map((t, i) => (
              <text
                key={t.label}
                x={x(i)}
                y={h - 6}
                fontSize={10}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                style={{ fill: "var(--muted-foreground)" }}
              >
                <title>{t.label}</title>
                {singkatPeriode(t.label)}
              </text>
            ))}
          </svg>

          {titikAktif && titikAktif.nilai !== null && (
            <div
              ref={pasangTip}
              className="pointer-events-none absolute w-max"
              style={gayaTip}
            >
              <TooltipGrafik
                active
                payload={[{ dataKey: kunci, value: titikAktif.nilai }]}
                label={titikAktif.label}
                seri={seri}
                format={(v) => formatNilai(v)}
                judul={(label) =>
                  `${String(label)}${titikAktif.status === "berjalan" ? " · sementara" : ""}`
                }
              />
            </div>
          )}
          {titikAktif && titikAktif.nilai === null && (
            <div
              ref={pasangTip}
              className="surface-floating pointer-events-none absolute w-max rounded-lg px-3 py-2.5 text-xs"
              style={gayaTip}
            >
              <p className="label-micro text-[10px] text-muted-foreground">
                {titikAktif.label}
              </p>
              <p className="mt-1 text-foreground">
                {kunci === "nilai"
                  ? "Tagihan belum terbit"
                  : "Kubikasi belum tersedia"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function TrenPenjualan({ data }: { data: TitikTren[] }) {
  const [mode, setMode] = useState<Mode>("m3")

  const dataGrafik = useMemo(
    () => data.map((t) => ({ ...t, label: formatPeriode(t.periode) })),
    [data]
  )

  const terakhir = data.at(-1)

  if (!terakhir) {
    return (
      <Panel label="Tren Kubikasi & Tagihan" deskripsi="Per periode.">
        <p className="text-sm text-muted-foreground">Belum ada data periode.</p>
      </Panel>
    )
  }

  const m = MODE[mode]
  const kunci = m.kunci
  const nilaiTerakhir = terakhir[kunci]
  const periodeTerbit = data.filter(
    (t) => t.status === "terbit" && t[kunci] !== null
  )
  const sebelumnya = periodeTerbit.at(-2)
  const nilaiLalu = sebelumnya?.[kunci] ?? null
  const rata =
    periodeTerbit.length > 0
      ? periodeTerbit.reduce((a, t) => a + t[kunci]!, 0) / periodeTerbit.length
      : null
  const delta =
    terakhir.status === "terbit" &&
    nilaiTerakhir !== null &&
    nilaiLalu !== null &&
    nilaiLalu > 0
      ? ((nilaiTerakhir - nilaiLalu) / nilaiLalu) * 100
      : undefined

  const titik = dataGrafik.map((t) => ({
    label: t.label,
    nilai: t[kunci],
    status: t.status,
  }))

  return (
    <Panel
      label="Tren Kubikasi & Tagihan"
      deskripsi={
        terakhir.status === "berjalan"
          ? mode === "m3"
            ? "Kubikasi periode berjalan bersifat sementara."
            : "Tagihan periode berjalan belum diterbitkan."
          : "Per periode."
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              {nilaiTerakhir === null ? (
                <span className="truncate text-2xl leading-8 num-display">
                  {mode === "rupiah" ? "Belum terbit" : "Belum tersedia"}
                </span>
              ) : (
                <AngkaPenuh
                  nilai={nilaiTerakhir}
                  awalan={mode === "rupiah" ? "Rp" : undefined}
                  akhiran={mode === "m3" ? "m³" : undefined}
                  className="leading-8"
                />
              )}
              {delta !== undefined && (
                <span className="shrink-0 text-xs num text-muted-foreground">
                  {delta >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(delta).toLocaleString("id-ID", {
                    maximumFractionDigits: 1,
                  })}
                  %
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPeriode(terakhir.periode)}
              {terakhir.status === "berjalan" && nilaiTerakhir !== null
                ? " · sementara"
                : ""}
              {" · rata-rata "}
              <span className="num text-foreground/80">
                {rata === null ? (
                  "–"
                ) : (
                  <AngkaPenuh
                    nilai={Math.round(rata)}
                    awalan={mode === "rupiah" ? "Rp" : undefined}
                    akhiran={mode === "m3" ? "m³" : undefined}
                    kecil
                  />
                )}
              </span>
            </p>
          </div>

          <div className="inline-flex h-7 shrink-0 items-center rounded-md bg-muted p-0.5 text-xs">
            {(["m3", "rupiah"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                aria-pressed={mode === k}
                className={cn(
                  "h-full rounded-sm px-2.5 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
