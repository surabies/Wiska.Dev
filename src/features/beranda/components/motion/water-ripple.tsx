"use client"

import { useEffect, useRef, useState } from "react"

interface Riak {
  id: number
  x: number
  y: number
}

export function WaterRipple() {
  const areaRef = useRef<HTMLDivElement>(null)
  const [riak, setRiak] = useState<Riak[]>([])

  useEffect(() => {
    function buatRiak(event: MouseEvent) {
      const area = areaRef.current
      if (!area) return
      const batas = area.getBoundingClientRect()
      if (event.clientX < batas.left || event.clientX > batas.right || event.clientY < batas.top || event.clientY > batas.bottom) return

      const id = Date.now() + Math.random()
      setRiak((sebelumnya) => [...sebelumnya.slice(-3), { id, x: event.clientX - batas.left, y: event.clientY - batas.top }])
      window.setTimeout(() => setRiak((sebelumnya) => sebelumnya.filter((item) => item.id !== id)), 1200)
    }

    window.addEventListener("click", buatRiak, { passive: true })
    return () => window.removeEventListener("click", buatRiak)
  }, [])

  return (
    <div ref={areaRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {riak.map((item) => (
        <span
          key={item.id}
          className="absolute size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/35 animate-ping"
          style={{ left: item.x, top: item.y }}
        />
      ))}
    </div>
  )
}
