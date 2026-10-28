"use client"

// Tombol "Cetak / PDF". Menunggu foto di lembar cetak selesai dimuat (supaya
// tidak tercetak kosong), mengganti judul dokumen sementara (jadi nama file
// bawaan saat "Simpan sebagai PDF"), lalu memanggil dialog cetak browser.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const BATAS_TUNGGU_FOTO_MS = 4000

function tungguFotoSiap(): Promise<void> {
  const gambar = Array.from(
    document.querySelectorAll<HTMLImageElement>(".lembar-cetak img")
  )
  const semua = Promise.all(
    gambar.map((img) =>
      img.complete
        ? null
        : new Promise<void>((selesai) => {
            img.addEventListener("load", () => selesai(), { once: true })
            img.addEventListener("error", () => selesai(), { once: true })
          })
    )
  ).then(() => undefined)
  const batas = new Promise<void>((selesai) =>
    setTimeout(selesai, BATAS_TUNGGU_FOTO_MS)
  )
  return Promise.race([semua, batas])
}

export function TombolCetak({
  judulDokumen,
  className,
}: {
  judulDokumen: string
  className?: string
}) {
  const [menyiapkan, setMenyiapkan] = React.useState(false)

  async function cetak() {
    if (menyiapkan) return
    setMenyiapkan(true)
    await tungguFotoSiap()

    const judulLama = document.title
    const pulihkan = () => {
      document.title = judulLama
      window.removeEventListener("afterprint", pulihkan)
    }
    document.title = judulDokumen
    window.addEventListener("afterprint", pulihkan)

    setMenyiapkan(false)
    window.print()
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={cetak}
      disabled={menyiapkan}
      title="Cetak, atau pilih “Simpan sebagai PDF” di dialog cetak"
      className={cn("h-8 gap-2", className)}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden
      >
        <path d="M6 9V3h12v6" />
        <rect x="3" y="9" width="18" height="8" rx="1.5" />
        <path d="M6 14h12v7H6z" />
      </svg>
      {menyiapkan ? "Menyiapkan…" : "Cetak / PDF"}
    </Button>
  )
}
