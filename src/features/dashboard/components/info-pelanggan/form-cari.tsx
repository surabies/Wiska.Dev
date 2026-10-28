"use client"

// Bilah pencarian tunggal: No. Langganan + Periode + tombol. Periode
// berformat YYYYMM; kosong berarti periode terbaru.
// Dipasang di dalam pita judul berwarna (biru di tema terang), jadi teks
// bantuan di bawah bilah memakai warna teks pita. Semua warna dari token.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function FormCari({
  nomor,
  periode,
  memuat,
  onCari,
}: {
  nomor: string
  periode: string
  memuat: boolean
  onCari: (nomor: string, periode: string) => void
}) {
  const [n, setN] = React.useState(nomor)
  const [p, setP] = React.useState(periode)
  const [galat, setGalat] = React.useState<string | null>(null)

  // Ikuti perubahan URL (tombol back/forward, tautan dari halaman lain).
  // Disesuaikan saat render (bukan di useEffect): simpan prop sebelumnya,
  // lalu salin ke state hanya jika prop berubah.
  const [nomorSebelum, setNomorSebelum] = React.useState(nomor)
  if (nomor !== nomorSebelum) {
    setNomorSebelum(nomor)
    setN(nomor)
  }
  const [periodeSebelum, setPeriodeSebelum] = React.useState(periode)
  if (periode !== periodeSebelum) {
    setPeriodeSebelum(periode)
    setP(periode)
  }

  function kirim(e: React.FormEvent) {
    e.preventDefault()
    const nomorBersih = n.trim()
    const periodeBersih = p.trim()
    if (!nomorBersih) return setGalat("Isi No. Langganan terlebih dahulu.")
    if (periodeBersih && !/^\d{6}$/.test(periodeBersih))
      return setGalat("Periode terdiri dari 6 digit tahun dan bulan, mis. 202607.")
    setGalat(null)
    onCari(nomorBersih, periodeBersih)
  }

  const kelasInput =
    "h-9 w-full min-w-0 bg-transparent text-sm tabular-nums outline-none placeholder:text-muted-foreground"

  return (
    <form onSubmit={kirim} aria-label="Cari pelanggan" className="w-full max-w-2xl">
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-1.5 text-card-foreground shadow-panel focus-within:ring-2 focus-within:ring-ring/30 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={n}
            onChange={(e) => setN(e.target.value)}
            inputMode="numeric"
            placeholder="No. Langganan"
            aria-label="No. Langganan"
            autoFocus
            className={kelasInput}
          />
        </div>
        <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />
        <div className="px-2.5 sm:w-36">
          <input
            value={p}
            onChange={(e) => setP(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="Periode, 202607"
            aria-label="Periode"
            className={kelasInput}
          />
        </div>
        <Button type="submit" className="h-9 px-5" disabled={memuat}>
          {memuat ? "Mencari…" : "Cari pelanggan"}
        </Button>
      </div>
      <p
        role={galat ? "alert" : undefined}
        className={cn(
          "mt-2 text-xs",
          galat
            ? "font-medium text-info-foreground dark:text-destructive"
            : "text-info-foreground/80 dark:text-muted-foreground"
        )}
      >
        {galat ?? "Kosongkan periode untuk melihat pencatatan terbaru."}
      </p>
    </form>
  )
}