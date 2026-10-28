"use client"

// features/beranda/components/motion/smooth-scroll-provider.tsx — Lenis
// smooth scroll, HANYA aktif selama komponen ini terpasang (dipanggil satu
// kali dari app/page.tsx, di dalam route beranda saja). instance di-destroy
// saat unmount supaya tidak bocor ke halaman publik lain yang tidak dipoles
// (mereka pakai scroll native seperti biasa) — lihat catatan cakupan di
// plan showcase beranda.
//
// `prefers-reduced-motion`: Lenis TIDAK diinisialisasi sama sekali (bukan
// cuma dipercepat) — orang yang minta gerak minimal seharusnya dapat scroll
// native biasa, bukan versi "smooth" yang tetap menimpa perilaku default.
import { useReducedMotion } from "motion/react"
import { useEffect } from "react"
import Lenis from "lenis"

export function SmoothScrollProvider() {
  const kurangiGerak = useReducedMotion()

  useEffect(() => {
    if (kurangiGerak) return

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    let frameId: number

    function raf(time: number) {
      lenis.raf(time)
      frameId = requestAnimationFrame(raf)
    }
    frameId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frameId)
      lenis.destroy()
    }
  }, [kurangiGerak])

  return null
}
