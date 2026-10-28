// Satu definisi dipakai di seluruh CTA utama publik ("Kirim
// laporan", "Kirim pengaduan", "Cek tagihan", "Cek status laporan saya")
// supaya "senada di semua halaman" berarti benar-benar satu sumber, bukan
// classNames yang disalin manual ke tiap form dan lambat laun menyimpang —
// persis kenapa InputNomorLangganan diekstrak sebelumnya.
//
// Server component murni presentasional (tidak butuh "use client" — cuma
// Button + Slot di baliknya).
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

export function TombolUtama({
  className,
  children,
  nonaktif = false,
  ...props
}: ComponentProps<typeof Button> & {
  /** Terkunci oleh ATURAN BISNIS (mis. "sudah lapor bulan ini"), BUKAN
   *  sekadar form belum lengkap/sedang mengirim — kasus terakhir itu cukup
   *  `disabled`, cincinnya tetap tampil (dtombol memang akan bisa ditekan
   *  begitu formnya lengkap). `nonaktif` menghapus cincinnya SEPENUHNYA
   *  supaya kilau tidak menyiratkan tombol ini bisa ditekan padahal terkunci
   *  untuk alasan lain, bukan cuma menunggu input. */
  nonaktif?: boolean
}) {
  if (nonaktif) {
    return (
      <Button disabled className={className} {...props}>
        {children}
      </Button>
    )
  }

  return (
    <Button className={cn("font-medium shadow-panel", className)} {...props}>
      {children}
    </Button>
  )
}
