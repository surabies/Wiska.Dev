"use client"

// features/beranda/components/motion/animated-number.tsx — angka yang
// menghitung naik dari 0 begitu masuk viewport. Server component pemanggil
// (stats-strip.tsx) tetap yang fetch data nyata & format lokal (id-ID) —
// komponen ini cuma menerima angka mentah dan menganimasikan tampilannya.
//
// Pakai `animate()` imperatif + ref (bukan useState per-frame) supaya tidak
// re-render React di setiap tick — angka berubah lewat textContent langsung,
// sama seperti pola resmi Motion untuk counter.
import { animate, useInView, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"

export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const sudahTerlihat = useInView(ref, { once: true, margin: "-40px" })
  const kurangiGerak = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || !sudahTerlihat) return

    if (kurangiGerak) {
      el.textContent = value.toLocaleString("id-ID")
      return
    }

    const kontrol = animate(0, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        el.textContent = Math.round(v).toLocaleString("id-ID")
      },
    })
    return () => kontrol.stop()
  }, [sudahTerlihat, value, kurangiGerak])

  return <span ref={ref}>0</span>
}
