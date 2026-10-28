"use client"

// features/beranda/components/motion/text-reveal.tsx — headline gradient
// (cyan → emerald) yang muncul kata per kata (pola "Text Generate
// Effect" ala Aceternity UI). Kalimatnya dipecah lewat `children: string`
// biasa, BUKAN dangerouslySetInnerHTML — supaya teks tetap teks asli untuk
// pembaca layar (satu <span aria-hidden> per kata untuk animasi, judul asli
// tetap ada utuh lewat sr-only).
//
// DUA JEBAKAN yang sudah ditemukan & dihindari di sini:
// 1. `className` (gradasi + bg-clip-text) WAJIB persis di elemen yang
//    membungkus glyph yang benar-benar tampak. Sempat dicoba di elemen
//    terluar bersama <span className="sr-only">, dan gradasinya tidak
//    pernah tampak sama sekali — background-clip:text ikut menghitung teks
//    sr-only yang tersembunyi, merusak area clip-nya.
// 2. `filter` (blur) TIDAK dipakai di sini walau lazim di efek "reveal"
//    serupa: men-transition `filter` pada elemen ANAK memaksa browser
//    membuat compositing layer terisolasi untuknya, dan pada baris yang
//    warnanya `text-transparent` + `bg-clip-text` (mengandalkan background
//    milik ORANG TUA untuk terlihat), layer terisolasi itu membuat teks
//    sama sekali tidak tampak — bukan cuma buram. Reveal-nya cukup
//    opacity+translateY, tanpa filter.
import { motion, useReducedMotion } from "motion/react"

export function TextReveal({ text, className }: { text: string; className?: string }) {
  const kurangiGerak = useReducedMotion()
  const kata = text.split(" ")

  return (
    <span className="inline">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className={className}>
        {kata.map((k, i) => (
          // Spasi antar-kata SENGAJA di luar <motion.span> (bukan di dalam
          // teks anak inline-block) — spasi trailing tepat di tepi elemen
          // inline-block cenderung diciutkan browser, dan dua kata jadi
          // menempel tanpa jarak ("selesaidari").
          <span key={i}>
            <motion.span
              initial={{ opacity: 0, y: kurangiGerak ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: kurangiGerak ? 0 : i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="inline-block"
            >
              {k}
            </motion.span>
            {i < kata.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </span>
  )
}
