"use client"

// features/dashboard/ringkasan/components/TrenAnomali.tsx — jumlah anomali per
// periode, batang ditumpuk per kode kondisi (DK, TTB, BMK_BMB, MTA, lainnya).
//
// Grafik SVG ringan (tanpa pustaka grafik):
//   - batang tumpuk: jumlah per periode terbaca langsung, kode kecil tetap
//     terlihat walau satu kode (mis. "Lainnya") jauh lebih besar
//   - label sumbu-Y di dalam area → margin kiri = kanan = padding panel
//   - label sumbu-X menampilkan bulan pada setiap periode
//   - legenda bisa diklik untuk menyembunyikan/menampilkan kode (minimal satu)
//   - tooltip memakai TooltipGrafik bersama, mengikuti ujung kursor
import { useMemo, useState } from "react"
import { cn } from "@/lib/Utilitas"
import { formatPeriode } from "@/features/public/lib/Format"
import type { TitikAnomali } from "../types/TipeRingkasan"
import { formatAngkaPenuh } from "./AngkaPenuh"
import { Panel } from "./Panel"
import { TooltipGrafik, type SeriTooltip } from "./TooltipGrafik"
import {
  singkatPeriode,
  skalaRapi,
  useTooltipKursor,
  useUkuran,
} from "../lib/GrafikUtilitas"

const KUNCI = ["DK", "TTB", "BMK_BMB", "MTA", "lainnya"] as const
type Kunci = (typeof KUNCI)[number]

const WARNA: Record<Kunci, string> = {
  DK: "var(--chart-1)",
  TTB: "var(--chart-2)",
  BMK_BMB: "var(--chart-3)",
  MTA: "var(--chart-4)",
  lainnya: "var(--chart-5)",
}

const LABEL: Record<Kunci, string> = {
  DK: "DK",
  TTB: "TTB",
  BMK_BMB: "BMK/BMB",
  MTA: "MTA",
  lainnya: "Lainnya",
}

const SERI: Record<string, SeriTooltip> = Object.fromEntries(
  KUNCI.map((k) => [k, { label: LABEL[k], warna: WARNA[k] }])
)

const jumlah = (t: TitikAnomali) => t.DK + t.TTB + t.BMK_BMB + t.MTA + t.lainnya

const ATAS = 16
const BAWAH = 24

const teksSumbu = {
  fill: "var(--muted-foreground)",
  paintOrder: "stroke",
  stroke: "var(--card)",
  strokeWidth: 3,
} as const

type Baris = TitikAnomali & { label: string }

function GrafikBatang({ baris, tampil }: { baris: Baris[]; tampil: Kunci[] }) {
  const { pasang: pasangWadah, w, h } = useUkuran<HTMLDivElement>()
  const [aktif, setAktif] = useState<number | null>(null)
  const [kursor, setKursor] = useState<{ x: number; y: number } | null>(null)
  const { pasang: pasangTip, style: gayaTip } =
    useTooltipKursor<HTMLDivElement>({ w, h }, kursor)

  const n = baris.length
  const tinggi = Math.max(h - ATAS - BAWAH, 0)
  const total = (b: Baris) => tampil.reduce((a, k) => a + b[k], 0)
  const { puncak, ticks } = skalaRapi(Math.max(...baris.map(total), 0), true)

  const slot = n > 0 ? w / n : 0
  const lebar = Math.min(slot * 0.5, 44)
  const y = (v: number) => ATAS + tinggi - (v / puncak) * tinggi
  const segmen = baris.map((b, i) => {
    let kumulatif = 0
    return tampil.flatMap((k) => {
      const v = b[k]
      if (v <= 0) return []
      const y0 = y(kumulatif)
      kumulatif += v
      const y1 = y(kumulatif)
      return [{ k, x: slot * i + (slot - lebar) / 2, y: y1, tinggi: y0 - y1 }]
    })
  })

  function geser(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - r.left) / slot)
    setKursor({ x: e.clientX - r.left, y: e.clientY - r.top })
    setAktif(Math.min(n - 1, Math.max(0, i)))
  }

  const barisAktif = aktif !== null ? baris[aktif] : null

  return (
    <div ref={pasangWadah} className="relative min-h-44 flex-1">
      {w > 0 && h > 0 && (
        <>
          <svg
            width={w}
            height={h}
            role="img"
            aria-label="Grafik batang anomali per periode"
            className="absolute inset-0 touch-pan-y overflow-visible"
            onPointerMove={geser}
            onPointerDown={geser}
            onPointerLeave={() => setAktif(null)}
          >
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

            {aktif !== null && (
              <rect
                x={slot * aktif}
                y={ATAS}
                width={slot}
                height={tinggi}
                rx={4}
                style={{ fill: "var(--muted)" }}
                opacity={0.6}
              />
            )}

            {segmen.map((satu, i) =>
              satu.map((s) => (
                <rect
                  key={`${i}-${s.k}`}
                  x={s.x}
                  y={s.y}
                  width={lebar}
                  height={Math.max(s.tinggi, 0)}
                  style={{ fill: WARNA[s.k], stroke: "var(--card)" }}
                  strokeWidth={1}
                />
              ))
            )}

            {ticks.map((t) => (
              <text key={t} x={0} y={y(t) - 4} fontSize={10} style={teksSumbu}>
                {formatAngkaPenuh(t)}
              </text>
            ))}

            {baris.map((t, i) => (
              <text
                key={t.periode}
                x={slot * i + slot / 2}
                y={h - 6}
                fontSize={10}
                textAnchor="middle"
                style={{ fill: "var(--muted-foreground)" }}
              >
                <title>{t.label}</title>
                {singkatPeriode(t.label)}
              </text>
            ))}
          </svg>

          {barisAktif && (
            <div
              ref={pasangTip}
              className="pointer-events-none absolute w-max"
              style={gayaTip}
            >
              <TooltipGrafik
                active
                payload={tampil.map((k) => ({
                  dataKey: k,
                  value: barisAktif[k],
                }))}
                label={barisAktif.label}
                seri={SERI}
                tampilkanTotal
                sembunyikanNol
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function TrenAnomali({ data }: { data: TitikAnomali[] }) {
  const [tersembunyi, setTersembunyi] = useState<Kunci[]>([])

  const baris = useMemo<Baris[]>(
    () => data.map((t) => ({ ...t, label: formatPeriode(t.periode) })),
    [data]
  )

  const total = data.reduce((a, t) => a + jumlah(t), 0)

  if (total === 0) {
    return (
      <Panel label="Tren Anomali" deskripsi="Selain NORMAL, per periode.">
        <p className="text-sm text-muted-foreground">
          Belum ada anomali tercatat.
        </p>
      </Panel>
    )
  }

  const terakhir = data.at(-1)
  const totalTerakhir = terakhir ? jumlah(terakhir) : 0
  const dominan =
    terakhir && totalTerakhir > 0
      ? [...KUNCI].sort((a, b) => terakhir[b] - terakhir[a])[0]
      : undefined

  const tampil = KUNCI.filter((k) => !tersembunyi.includes(k))

  function ganti(k: Kunci) {
    setTersembunyi((lama) => {
      if (lama.includes(k)) return lama.filter((x) => x !== k)
      if (lama.length >= KUNCI.length - 1) return lama // minimal satu tampil
      return [...lama, k]
    })
  }

  return (
    <Panel label="Tren Anomali" deskripsi="Per kode kondisi.">
      <div className="flex flex-1 flex-col gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl leading-8 num-display">
              {totalTerakhir.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-muted-foreground">anomali</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {terakhir ? formatPeriode(terakhir.periode) : "Periode terakhir"}
            {dominan ? ` · terbanyak ${LABEL[dominan]}` : ""}
          </p>
        </div>

        {/* Legenda: klik untuk sembunyikan/tampilkan. Angka = periode terakhir. */}
        <div className="-mx-2 -my-1 flex flex-wrap gap-x-1">
          {KUNCI.map((k) => {
            const sembunyi = tersembunyi.includes(k)
            return (
              <button
                key={k}
                type="button"
                onClick={() => ganti(k)}
                aria-pressed={!sembunyi}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring",
                  sembunyi && "opacity-40"
                )}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-xs"
                  style={{ background: WARNA[k] }}
                />
                <span
                  className={cn(
                    "text-muted-foreground",
                    sembunyi && "line-through"
                  )}
                >
                  {LABEL[k]}
                </span>
                <span className="font-medium num text-foreground">
                  {(terakhir?.[k] ?? 0).toLocaleString("id-ID")}
                </span>
              </button>
            )
          })}
        </div>

        <GrafikBatang baris={baris} tampil={tampil} />
      </div>
    </Panel>
  )
}
