"use client"

// features/beranda/components/motion/tilt-card.tsx — tilt 3D ringan yang
// mengikuti posisi kursor relatif terhadap kartu (pola "3D Card Effect" ala
// Aceternity UI). useSpring melembutkan gerakannya supaya tidak terasa
// "kaku" mengikuti mouse mentah-mentah.
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"
import type { MouseEvent, ReactNode } from "react"

export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const kurangiGerak = useReducedMotion()
  const x = useMotionValue(0.5)
  const y = useMotionValue(0.5)

  const rotateX = useSpring(useTransform(y, [0, 1], [8, -8]), { stiffness: 200, damping: 20 })
  const rotateY = useSpring(useTransform(x, [0, 1], [-8, 8]), { stiffness: 200, damping: 20 })

  function urusGerakMouse(e: MouseEvent<HTMLDivElement>) {
    if (kurangiGerak) return
    const batas = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - batas.left) / batas.width)
    y.set((e.clientY - batas.top) / batas.height)
  }

  function keluarMouse() {
    x.set(0.5)
    y.set(0.5)
  }

  return (
    <motion.div
      onMouseMove={urusGerakMouse}
      onMouseLeave={keluarMouse}
      style={{
        rotateX: kurangiGerak ? 0 : rotateX,
        rotateY: kurangiGerak ? 0 : rotateY,
        transformPerspective: 1000,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
