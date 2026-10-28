"use client"

// components/pwa/tombol-pasang.tsx — pintu masuk PERMANEN ke dialog pemasangan.
//
// Inilah yang membedakan fitur ini dari sekadar pop-up: dialog otomatis cuma
// muncul sekali lalu diam 14 hari, jadi tanpa tombol ini pengguna yang menekan
// "Nanti saja" kehilangan satu-satunya jalan memasang aplikasi. Ditaruh di
// header, menu mobile, dan footer supaya selalu ada dalam jangkauan.
//
// Menyembunyikan diri sepenuhnya kalau aplikasinya memang sudah terpasang —
// menawarkan "Pasang aplikasi" di dalam aplikasi yang sudah terpasang cuma
// membingungkan.
import { Download } from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePasang } from "./konteks-pasang"

const LABEL = "Pasang aplikasi"

type Bentuk = "ikon" | "menu" | "tautan"

export function TombolPasang({
  bentuk = "ikon",
  className,
  onSesudah,
}: {
  /**
   * "ikon"   — tombol ikon saja untuk bilah header yang sempit.
   * "menu"   — baris selebar penuh untuk di dalam sheet navigasi mobile.
   * "tautan" — tampak seperti tautan biasa, untuk footer.
   */
  bentuk?: Bentuk
  className?: string
  /** Dipanggil setelah dialog dibuka, mis. untuk menutup sheet navigasi. */
  onSesudah?: () => void
}) {
  const konteks = usePasang()

  // null = dirender di luar PenyediaPasang. Bukan kondisi galat: cukup tidak
  // menampilkan apa-apa.
  if (!konteks || konteks.terpasang) return null

  const klik = () => {
    konteks.bukaDialog()
    onSesudah?.()
  }

  if (bentuk === "menu") {
    return (
      <button
        type="button"
        onClick={klik}
        className={`group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent ${className ?? ""}`}
      >
        <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{LABEL}</span>
          <span className="text-xs text-muted-foreground">Buka dari layar utama, tanpa browser</span>
        </span>
      </button>
    )
  }

  if (bentuk === "tautan") {
    return (
      <button
        type="button"
        onClick={klik}
        className={`text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline ${className ?? ""}`}
      >
        {LABEL}
      </button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={LABEL} className={className} onClick={klik}>
          <Download className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{LABEL}</TooltipContent>
    </Tooltip>
  )
}
