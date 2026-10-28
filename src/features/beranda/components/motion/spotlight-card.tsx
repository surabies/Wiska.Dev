"use client"

// features/beranda/components/motion/spotlight-card.tsx — kartu glass
// dengan sorot cahaya yang mengikuti kursor (pola "Card Spotlight" ala
// Aceternity UI, diporting manual — bukan dependency npm).
//
// Posisi kursor ditulis ke custom property CSS lewat useMotionValue +
// useMotionTemplate, BUKAN React state — supaya gerakan mouse tidak memicu
// re-render komponen di setiap piksel (itulah kenapa Motion punya API ini).
import { motion, useMotionTemplate, useMotionValue } from "motion/react"
import type { MouseEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"

export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  function urusGerakMouse(e: MouseEvent<HTMLDivElement>) {
    const batas = e.currentTarget.getBoundingClientRect()
    x.set(e.clientX - batas.left)
    y.set(e.clientY - batas.top)
  }

  const background = useMotionTemplate`radial-gradient(240px circle at ${x}px ${y}px, color-mix(in srgb, var(--info) 12%, transparent), transparent 70%)`

  return (
    <div
      onMouseMove={urusGerakMouse}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-panel transition-colors hover:border-ring/40",
        className
      )}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
