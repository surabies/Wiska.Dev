"use client"

// features/beranda/components/sparkbars.tsx — batang sparkline di vinyet
// hero, tumbuh masuk sekali saat termuat (bukan data pemakaian pelanggan
// mana pun — murni bentuknya yang penting, sama seperti versi lama).
import { motion, useReducedMotion } from "motion/react"

const BATANG = [42, 55, 38, 60, 48, 72]

export function SparkBars() {
  const kurangiGerak = useReducedMotion()

  return (
    <div className="flex h-12 items-end gap-1.5">
      {BATANG.map((t, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: kurangiGerak ? 1 : 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.5, delay: kurangiGerak ? 0 : 0.5 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: `${t}%`, transformOrigin: "bottom" }}
          className={i === BATANG.length - 1 ? "w-3 bg-info" : "w-3 bg-muted-foreground/20"}
        />
      ))}
    </div>
  )
}
