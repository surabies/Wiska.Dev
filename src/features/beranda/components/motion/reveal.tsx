"use client"

// features/beranda/components/motion/reveal.tsx — primitif fade+slide-up
// saat elemen masuk viewport. Dipakai di seluruh showcase beranda untuk
// choreography scroll yang konsisten, satu sumber durasi/easing.
//
// `prefers-reduced-motion`: transform (translateY) dimatikan, cuma fade
// tipis yang tersisa — kontennya tetap langsung terbaca, bukan diam total
// menunggu animasi yang tidak akan terjadi.
import { motion, useReducedMotion, type Variants } from "motion/react"
import type { ReactNode } from "react"

const EASE_KELUAR = [0.16, 1, 0.3, 1] as const

export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode
  /** Detik — dipakai manual untuk stagger antar-item map (index * 0.06 dst). */
  delay?: number
  className?: string
  as?: "div" | "li"
}) {
  const kurangiGerak = useReducedMotion()
  const Komponen = as === "li" ? motion.li : motion.div

  const variants: Variants = {
    tersembunyi: { opacity: 0, y: kurangiGerak ? 0 : 18 },
    tampil: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay, ease: EASE_KELUAR },
    },
  }

  return (
    <Komponen
      initial="tersembunyi"
      whileInView="tampil"
      viewport={{ once: true, margin: "-64px" }}
      variants={variants}
      className={className}
    >
      {children}
    </Komponen>
  )
}
