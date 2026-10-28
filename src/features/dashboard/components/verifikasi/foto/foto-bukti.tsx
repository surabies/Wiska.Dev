"use client"

// features/dashboard/components/verifikasi/foto-bukti.tsx — lampiran foto
// meter di panel verifikasi.
//
// Frame SELALU potret 3:4 (BingkaiPotret) dan empty state memakai bentuk yang
// sama, jadi panel tidak berubah tinggi ketika sebuah laporan tidak berfoto.
// Klik foto membuka lightbox: zoom, putar, geser, Esc.
import { ImageNotFound01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import { BingkaiPotret, FotoZoom } from "./foto-viewer"

// Pemakai lama (tab-foto.tsx, dialog-verifikasi.tsx) tetap mengimpor dari sini.
export { FotoZoom }

/// Empty state yang menjelaskan diri. Laporan petugas dari sistem lama memang
/// tidak menyertakan foto, jadi ini jalur normal, bukan kegagalan.
/// `penuh` = mengisi tinggi wadah (modal); bawaan = frame potret 3:4 (panel).
export function FotoKosong({
  label,
  keterangan,
  penuh = false,
}: {
  label: string
  keterangan?: string
  penuh?: boolean
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center",
        penuh ? "h-full min-h-64" : "aspect-3/4",
      )}
    >
      <HugeiconsIcon icon={ImageNotFound01Icon} strokeWidth={2} className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground">{keterangan ?? "Belum ada foto yang diunggah."}</p>
    </div>
  )
}

export function FotoBukti({
  url,
  label,
  keterangan,
}: {
  url: string | null | undefined
  label: string
  /** Teks empty state bila foto tidak ada. */
  keterangan?: string
}) {
  if (!url) return <FotoKosong label={label} keterangan={keterangan} />

  return (
    <div className="flex flex-col gap-1">
      <BingkaiPotret url={url} alt={label} />
      <p className="text-center text-[11px] text-muted-foreground">Klik foto untuk perbesar, putar & zoom</p>
    </div>
  )
}