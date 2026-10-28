"use client"

// Identitas pelanggan, tata letak sama dengan PDF: nama + alamat di kiri,
// No. Langganan (bisa disalin) + status di kanan, chip ciri teknis di bawah.
import * as React from "react"
import { cn } from "@/lib/utils"
import { LABEL_STATUS_PELANGGAN } from "../../lib/label"
import type { DataPelanggan } from "./tipe"

const NADA_STATUS: Record<string, string> = {
  AKTIF: "bg-success-muted text-success",
  TUTUP_SEMENTARA: "bg-warning-muted text-warning",
  DISEGEL: "bg-destructive/10 text-destructive",
  TUTUP_SPT: "bg-destructive/10 text-destructive",
}

function Chip({ label, nilai }: { label: string; nilai: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{nilai}</span>
    </span>
  )
}

function TombolSalin({ teks }: { teks: string }) {
  const [tersalin, setTersalin] = React.useState(false)

  async function salin() {
    try {
      await navigator.clipboard.writeText(teks)
      setTersalin(true)
      setTimeout(() => setTersalin(false), 1500)
    } catch {
      /* clipboard tidak tersedia — abaikan */
    }
  }

  return (
    <button
      type="button"
      onClick={salin}
      className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {tersalin ? "Tersalin" : "Salin"}
    </button>
  )
}

export function ProfilPelanggan({ pelanggan: p }: { pelanggan: DataPelanggan }) {
  const labelStatus = p.status
    ? ((LABEL_STATUS_PELANGGAN as Record<string, string>)[p.status] ?? p.status)
    : null

  return (
    <section aria-label="Identitas pelanggan" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h2 className="text-3xl font-semibold tracking-heading-32 text-balance">
            {p.nama || "Tanpa nama"}
          </h2>
          {p.alamat && (
            <p className="mt-1.5 max-w-2xl text-sm/6 text-muted-foreground">{p.alamat}</p>
          )}
        </div>

        <div className="flex flex-col sm:items-end">
          <span className="text-xs text-muted-foreground">No. Langganan</span>
          <span className="flex items-center gap-1">
            <span className="font-mono text-xl font-semibold tabular-nums">
              {p.nomorLangganan}
            </span>
            <TombolSalin teks={p.nomorLangganan} />
          </span>
          {labelStatus && (
            <span
              className={cn(
                "mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                NADA_STATUS[p.status ?? ""] ?? "bg-muted text-foreground"
              )}
            >
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {labelStatus}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {p.golongan && <Chip label="Golongan" nilai={p.golongan} />}
        {p.nomorMeter && <Chip label="Meter" nilai={p.nomorMeter} />}
        {p.ukuranMeter && <Chip label="Ukuran" nilai={p.ukuranMeter} />}
        {p.noHp && p.noHp !== "0" && <Chip label="Telepon" nilai={p.noHp} />}
      </div>
    </section>
  )
}