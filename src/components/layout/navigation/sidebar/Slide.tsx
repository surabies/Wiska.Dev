// components/layout/navigation/sidebar/Slide.tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { Direction } from "./types/types"

/** Animasi geser tipis saat berganti tampilan (root <-> detail). */
export function Slide({
  direction,
  children,
}: {
  direction: Direction
  children: React.ReactNode
}) {
  const [entered, setEntered] = React.useState(false)

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      className={cn(
        "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
        entered
          ? "translate-x-0 opacity-100"
          : direction === "forward"
            ? "translate-x-4 opacity-0"
            : "-translate-x-4 opacity-0",
      )}
    >
      {children}
    </div>
  )
}
