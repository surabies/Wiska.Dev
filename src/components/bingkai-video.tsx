"use client"

// components/bingkai-video.tsx — bingkai video BERUKURAN TETAP, pasangan dari
// bingkai-foto.tsx. Dipakai untuk klip bukti pengaduan di web (halaman
// pelacakan warga + detail tiket dashboard). Sama seperti foto: tinggi frame
// ditentukan RASIO (default 16/9), BUKAN dimensi file — klip potret/lanskap
// dari berbagai HP tidak boleh membuat tinggi halaman melonjak.
//
// URL sebaiknya sudah dioptimasi pemanggil lewat urlVideoTeroptimasi()
// (Cloudinary q_auto,f_auto) — komponen ini sengaja "bodoh" soal sumber.
import * as React from "react"
import { cn } from "@/lib/utils"
import type { RasioFoto } from "@/components/bingkai-foto"

const KELAS_RASIO: Record<RasioFoto, string> = {
  "4/3": "aspect-[4/3]",
  "16/9": "aspect-video",
  "1/1": "aspect-square",
  "3/4": "aspect-[3/4]",
}

export function BingkaiVideo({
  src,
  rasio = "16/9",
  className,
}: {
  src: string
  rasio?: RasioFoto
  className?: string
}) {
  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg border border-border bg-black", KELAS_RASIO[rasio], className)}>
      {/* object-contain: klip potret tidak terpotong; latar hitam netral.
          Tanpa <track> teks: ini klip bukti warga, bukan konten bermedia. */}
      <video src={src} controls playsInline preload="metadata" className="absolute inset-0 size-full object-contain" />
    </div>
  )
}
