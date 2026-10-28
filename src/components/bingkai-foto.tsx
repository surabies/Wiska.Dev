"use client"

// components/bingkai-foto.tsx — bingkai foto BERUKURAN TETAP untuk seluruh
// web (dashboard + halaman publik).
//
// KEPUTUSAN DESAIN (2026-07-19): ukuran frame ditentukan FRONTEND lewat
// rasio aspek, BUKAN oleh dimensi file foto. Foto lapangan datang dari
// puluhan ponsel berbeda — potret/lanskap/persegi, 200px sampai 4000px —
// dan <img> telanjang membuat tinggi halaman berubah-ubah mengikuti file.
// Semua foto konten WAJIB lewat komponen ini; jangan menulis <img> telanjang
// di halaman.
//
// Dua mode isian:
//   - "isi"  (default): object-cover — frame penuh, tepi foto terpotong.
//     Untuk foto suasana/bukti umum.
//   - "utuh": object-contain di atas latar muted — foto tidak terpotong
//     (letterbox). Untuk foto yang angkanya harus terbaca (stand meter).
// Apa pun modenya, klik membuka dialog zoom (FotoZoom) — cover yang
// memotong tepi selalu punya jalan untuk dilihat utuh.
import * as React from "react"
import { ImageOff, ZoomIn } from "@/components/ui/hugeicons-compat"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const ZOOM_MIN = 1
const ZOOM_MAKS = 8
/// Per unit deltaY. ~0.002 terasa sat-set tapi masih bisa dihentikan tepat
/// di angka yang dituju pada trackpad maupun mouse wheel.
const ZOOM_LAJU = 0.002

function jepit(n: number) {
  return Math.min(ZOOM_MAKS, Math.max(ZOOM_MIN, n))
}

/// Foto yang bisa diperiksa: wheel = zoom (bukan scroll halaman), drag =
/// geser, klik ganda = reset. Zoom diikat ke posisi kursor supaya digit yang
/// sedang diperiksa tidak lari dari layar saat diperbesar. (Dipindah dari
/// features/dashboard/components/verifikasi/foto-bukti.tsx supaya bisa
/// dipakai bingkai foto di seluruh web, bukan cuma panel verifikasi.)
export function FotoZoom({ url, label }: { url: string; label: string }) {
  const wadahRef = React.useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = React.useState(1)
  // Titik jangkar (koordinat konten & kursor) dari wheel terakhir, dipakai
  // useLayoutEffect di bawah setelah ukuran gambar berubah.
  const jangkarRef = React.useRef<{ x: number; y: number; kx: number; ky: number } | null>(null)

  // Listener wheel dipasang manual: React memasang wheel-nya sendiri sebagai
  // passive, jadi preventDefault() dari prop onWheel diabaikan dan dialog
  // ikut ter-scroll setiap kali pengguna men-zoom.
  React.useEffect(() => {
    const el = wadahRef.current
    if (!el) return
    function saatWheel(e: WheelEvent) {
      const el = wadahRef.current
      if (!el) return
      e.preventDefault()
      setZoom((lama) => {
        const baru = jepit(lama - e.deltaY * ZOOM_LAJU * lama)
        if (baru === lama) return lama
        const kotak = el.getBoundingClientRect()
        const kx = e.clientX - kotak.left
        const ky = e.clientY - kotak.top
        jangkarRef.current = {
          x: ((el.scrollLeft + kx) / lama) * baru,
          y: ((el.scrollTop + ky) / lama) * baru,
          kx,
          ky,
        }
        return baru
      })
    }
    el.addEventListener("wheel", saatWheel, { passive: false })
    return () => el.removeEventListener("wheel", saatWheel)
  }, [])

  React.useLayoutEffect(() => {
    const el = wadahRef.current
    const jangkar = jangkarRef.current
    if (!el || !jangkar) return
    el.scrollLeft = jangkar.x - jangkar.kx
    el.scrollTop = jangkar.y - jangkar.ky
    jangkarRef.current = null
  }, [zoom])

  // Geser dengan drag. Pointer capture supaya kursor boleh keluar frame
  // tanpa memutus drag di tengah jalan.
  const geserRef = React.useRef<{ x: number; y: number; kiri: number; atas: number } | null>(null)

  function saatPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = wadahRef.current
    if (!el || zoom === 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    geserRef.current = { x: e.clientX, y: e.clientY, kiri: el.scrollLeft, atas: el.scrollTop }
  }

  function saatPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = wadahRef.current
    const awal = geserRef.current
    if (!el || !awal) return
    el.scrollLeft = awal.kiri - (e.clientX - awal.x)
    el.scrollTop = awal.atas - (e.clientY - awal.y)
  }

  function saatPointerUp() {
    geserRef.current = null
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wadahRef}
        onPointerDown={saatPointerDown}
        onPointerMove={saatPointerMove}
        onPointerUp={saatPointerUp}
        onPointerCancel={saatPointerUp}
        onDoubleClick={() => setZoom(1)}
        className={
          zoom === 1
            ? "max-h-[80dvh] cursor-zoom-in overflow-auto overscroll-contain bg-muted/30"
            : "max-h-[80dvh] cursor-grab overflow-auto overscroll-contain bg-muted/30 active:cursor-grabbing"
        }
      >
        {/* <img> biasa, bukan next/image — sumbernya Cloudinary/storage
            eksternal yang domainnya tidak terdaftar di next.config. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          draggable={false}
          className="max-h-none w-full max-w-none origin-top-left object-contain select-none"
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Scroll untuk zoom · seret untuk menggeser · klik ganda untuk reset
        {zoom > 1 ? ` · ${zoom.toFixed(1)}×` : ""}
      </p>
    </div>
  )
}

const KELAS_RASIO = {
  "4/3": "aspect-[4/3]",
  "16/9": "aspect-video",
  "1/1": "aspect-square",
  "3/4": "aspect-[3/4]",
} as const

export type RasioFoto = keyof typeof KELAS_RASIO

export function BingkaiFoto({
  src,
  alt,
  rasio = "4/3",
  mode = "isi",
  className,
  tanpaDialog = false,
}: {
  src: string
  alt: string
  /** Rasio frame — INI yang menentukan tinggi, bukan file fotonya. */
  rasio?: RasioFoto
  /** "isi" = object-cover (tepi terpotong); "utuh" = object-contain
   *  (letterbox) untuk foto yang angkanya harus terbaca. */
  mode?: "isi" | "utuh"
  /** Lebar diatur pemanggil dari sini (mis. `max-w-[200px]`). */
  className?: string
  /** Matikan dialog zoom — untuk pratinjau berkas lokal (blob:) di form. */
  tanpaDialog?: boolean
}) {
  const [gagal, setGagal] = React.useState(false)

  const bingkai = (
    <span
      className={cn(
        "relative block w-full overflow-hidden rounded-lg border border-border bg-muted/40",
        KELAS_RASIO[rasio],
        className
      )}
    >
      {gagal ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <ImageOff className="size-5" />
          <span className="text-[11px]">Foto tidak dapat dimuat</span>
        </span>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL eksternal/blob, bukan aset Next/Image */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setGagal(true)}
            className={cn(
              "absolute inset-0 size-full",
              mode === "isi" ? "object-cover" : "object-contain"
            )}
          />
          {!tanpaDialog && (
            <span className="absolute right-1.5 bottom-1.5 rounded-md bg-black/50 p-1 text-white">
              <ZoomIn className="size-3.5" />
            </span>
          )}
        </>
      )}
    </span>
  )

  if (tanpaDialog || gagal) return bingkai

  return (
    <Dialog>
      <DialogTrigger className="block w-full cursor-zoom-in text-left">{bingkai}</DialogTrigger>
      {/* sm:max-w-4xl (bukan max-w-4xl): kelas dasar DialogContent memuat
          sm:max-w-sm — override tanpa prefix sm: kalah spesifik di
          tailwind-merge dan dialog terkunci selebar 24rem di layar ≥640px. */}
      <DialogContent className="max-w-[calc(100vw-2rem)] p-2 sm:max-w-4xl">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <FotoZoom url={src} label={alt} />
      </DialogContent>
    </Dialog>
  )
}
