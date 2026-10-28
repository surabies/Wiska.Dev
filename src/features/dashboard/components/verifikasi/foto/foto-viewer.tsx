"use client"

// features/dashboard/components/verifikasi/foto-viewer.tsx — dua hal:
//
// 1. BingkaiPotret: frame foto UKURAN TETAP, selalu potret 3:4. Foto landscape
//    dari petugas/konsumen dipotong tengah (object-cover) — bentuk frame tidak
//    pernah berubah mengikuti file, jadi panel tidak melar-menciut.
// 2. PenampilFoto: penampil dengan zoom, geser, putar, reset. Dipakai di
//    lightbox (klik foto di panel, ada tombol Esc) dan tertanam di modal.
import * as React from "react"
import {
  Add01Icon,
  ArrowReloadHorizontalIcon,
  Cancel01Icon,
  ImageNotFound01Icon,
  MinusSignIcon,
  RotateLeft01Icon,
  RotateRight01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const SKALA_MIN = 0.5
const SKALA_MAKS = 6
const LANGKAH = 0.25
const batas = (n: number) => Math.min(SKALA_MAKS, Math.max(SKALA_MIN, Math.round(n * 100) / 100))

function TombolAlat({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

export function PenampilFoto({
  url,
  label,
  onTutup,
  className,
}: {
  url: string
  label: string
  /** Bila diisi, tombol "Tutup · Esc" muncul di pojok kanan atas. */
  onTutup?: () => void
  className?: string
}) {
  const [skala, setSkala] = React.useState(1)
  const [putar, setPutar] = React.useState(0)
  const [geser, setGeser] = React.useState({ x: 0, y: 0 })
  const [menyeret, setMenyeret] = React.useState(false)
  const [gagal, setGagal] = React.useState(false)
  const awal = React.useRef<{ x: number; y: number; gx: number; gy: number } | null>(null)

  const ubahSkala = (delta: number) => {
    const n = batas(skala + delta)
    setSkala(n)
    if (n <= 1) setGeser({ x: 0, y: 0 })
  }
  const reset = () => {
    setSkala(1)
    setPutar(0)
    setGeser({ x: 0, y: 0 })
  }

  // Pintasan hanya aktif saat penampil sedang fokus (tidak bentrok dengan
  // kotak isian di modal). Esc ditangani Dialog sendiri.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "+" || e.key === "=") ubahSkala(LANGKAH)
    else if (e.key === "-") ubahSkala(-LANGKAH)
    else if (e.key.toLowerCase() === "r") setPutar((p) => p + (e.shiftKey ? -90 : 90))
    else if (e.key === "0") reset()
    else return
    e.preventDefault()
  }

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={`Penampil foto: ${label}`}
      onKeyDown={onKeyDown}
      onWheel={(e) => ubahSkala(e.deltaY < 0 ? LANGKAH : -LANGKAH)}
      onPointerDown={(e) => {
        if (skala <= 1) return
        e.currentTarget.setPointerCapture(e.pointerId)
        awal.current = { x: e.clientX, y: e.clientY, gx: geser.x, gy: geser.y }
        setMenyeret(true)
      }}
      onPointerMove={(e) => {
        const a = awal.current
        if (a) setGeser({ x: a.gx + e.clientX - a.x, y: a.gy + e.clientY - a.y })
      }}
      onPointerUp={() => {
        awal.current = null
        setMenyeret(false)
      }}
      onPointerCancel={() => {
        awal.current = null
        setMenyeret(false)
      }}
      onDoubleClick={() => {
        setSkala(skala > 1 ? 1 : 2)
        setGeser({ x: 0, y: 0 })
      }}
      className={cn(
        "relative flex touch-none items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        skala > 1 ? (menyeret ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
        className,
      )}
    >
      {gagal ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <HugeiconsIcon icon={ImageNotFound01Icon} strokeWidth={2} className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">Foto gagal dimuat.</p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          draggable={false}
          onError={() => setGagal(true)}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(${geser.x}px, ${geser.y}px) rotate(${putar}deg) scale(${skala})`,
            transition: menyeret ? "none" : "transform 150ms ease-out",
          }}
        />
      )}

      {onTutup && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute top-2 right-2 h-8 gap-1.5 bg-background/90 backdrop-blur"
          onClick={onTutup}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" aria-hidden />
          Tutup
          <kbd className="rounded bg-muted px-1 text-[10px] text-muted-foreground">Esc</kbd>
        </Button>
      )}

      <div
        className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border bg-background/90 p-1 shadow-panel backdrop-blur"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <TombolAlat label="Perkecil (−)" onClick={() => ubahSkala(-LANGKAH)} disabled={skala <= SKALA_MIN}>
          <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} className="size-4" aria-hidden />
        </TombolAlat>
        <span className="w-11 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
          {Math.round(skala * 100)}%
        </span>
        <TombolAlat label="Perbesar (+)" onClick={() => ubahSkala(LANGKAH)} disabled={skala >= SKALA_MAKS}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" aria-hidden />
        </TombolAlat>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <TombolAlat label="Putar kiri (Shift+R)" onClick={() => setPutar((p) => p - 90)}>
          <HugeiconsIcon icon={RotateLeft01Icon} strokeWidth={2} className="size-4" aria-hidden />
        </TombolAlat>
        <TombolAlat label="Putar kanan (R)" onClick={() => setPutar((p) => p + 90)}>
          <HugeiconsIcon icon={RotateRight01Icon} strokeWidth={2} className="size-4" aria-hidden />
        </TombolAlat>
        <TombolAlat label="Atur ulang (0)" onClick={reset}>
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} strokeWidth={2} className="size-4" aria-hidden />
        </TombolAlat>
      </div>
    </div>
  )
}

/// Penampil tertanam (modal verifikasi) — mengisi tinggi kolomnya.
export function FotoZoom({ url, label, className }: { url: string; label: string; className?: string }) {
  return <PenampilFoto url={url} label={label} className={cn("h-full min-h-64 w-full", className)} />
}

export function FotoLightbox({
  url,
  label,
  buka,
  onBuka,
}: {
  url: string
  label: string
  buka: boolean
  onBuka: (v: boolean) => void
}) {
  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent
        showCloseButton={false}
        className="h-[90dvh] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <DialogDescription className="sr-only">
          Penampil foto dengan zoom, geser, dan putar. Tekan Esc untuk menutup.
        </DialogDescription>
        <PenampilFoto url={url} label={label} onTutup={() => onBuka(false)} className="h-full rounded-none border-0" />
      </DialogContent>
    </Dialog>
  )
}

/// Frame panel: SELALU potret 3:4, apa pun orientasi file aslinya.
export function BingkaiPotret({ url, alt }: { url: string; alt: string }) {
  const [buka, setBuka] = React.useState(false)
  const [gagal, setGagal] = React.useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        aria-label={`Perbesar ${alt}`}
        className="group relative block aspect-3/4 w-full overflow-hidden rounded-lg border border-border bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {gagal ? (
          <span className="flex size-full flex-col items-center justify-center gap-2">
            <HugeiconsIcon icon={ImageNotFound01Icon} strokeWidth={2} className="size-5 text-muted-foreground" aria-hidden />
            <span className="text-xs text-muted-foreground">Foto gagal dimuat.</span>
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={alt}
            loading="lazy"
            onError={() => setGagal(true)}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        )}
        <span className="absolute right-2 bottom-2 grid size-7 place-items-center rounded-md border border-border bg-background/90 text-foreground opacity-0 shadow-panel backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-3.5" aria-hidden />
        </span>
      </button>
      <FotoLightbox url={url} label={alt} buka={buka} onBuka={setBuka} />
    </>
  )
}