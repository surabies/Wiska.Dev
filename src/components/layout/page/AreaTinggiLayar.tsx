"use client"

// components/layout/page/AreaTinggiLayar.tsx — kotak yang tingginya pas
// sisa layar (di bawah navbar/breadcrumb, di atas footer) sehingga halaman
// tidak ikut menggulir; isi di dalamnya yang menggulir.
import * as React from "react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const TINGGI_MIN = 360

export function AreaTinggiLayar({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    function hitung() {
      if (!el) return
      const atas = el.getBoundingClientRect().top + window.scrollY
      const paddingBawah = parseFloat(getComputedStyle(el.parentElement ?? el).paddingBottom) || 0
      const tinggi = Math.max(TINGGI_MIN, window.innerHeight - atas - paddingBawah)
      el.style.height = `${tinggi}px`

      // Sisa ruang di bawah (footer, padding shell) diukur lalu dikurangkan.
      const lebih = document.documentElement.scrollHeight - window.innerHeight
      if (lebih > 0) el.style.height = `${Math.max(TINGGI_MIN, tinggi - lebih)}px`
    }

    hitung()
    const rAF = requestAnimationFrame(hitung)
    window.addEventListener("resize", hitung)
    return () => {
      cancelAnimationFrame(rAF)
      window.removeEventListener("resize", hitung)
    }
  }, [])

  return (
    <div ref={ref} className={cn("min-h-90", className)}>
      {children}
    </div>
  )
}