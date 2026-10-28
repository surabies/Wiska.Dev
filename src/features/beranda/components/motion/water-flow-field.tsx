"use client"

// features/beranda/components/motion/water-flow-field.tsx — tirai hujan air
// yang turun perlahan di seluruh background hero.
//
// Canvas 2D biasa (bukan library partikel) — jumlah partikel sedikit
// (±50), murah untuk dijalankan terus-menerus. Dimatikan TOTAL kalau
// prefers-reduced-motion aktif (bukan cuma diperlambat) — latar ambient
// blur di hero.tsx sudah cukup memberi kedalaman tanpa ini.
import { useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"

interface Partikel {
  x: number
  y: number
  panjang: number
  kecepatan: number
  opasitas: number
}

const JUMLAH_PARTIKEL = 110

export function WaterFlowField() {
  const kanvasRef = useRef<HTMLCanvasElement>(null)
  const kurangiGerak = useReducedMotion()

  useEffect(() => {
    if (kurangiGerak) return
    const kanvas = kanvasRef.current
    const ctx = kanvas?.getContext("2d")
    if (!kanvas || !ctx) return

    let lebar = 0
    let tinggi = 0
    let partikel: Partikel[] = []
    let frameId: number

    function ukurUlang() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const kotak = kanvas!.getBoundingClientRect()
      lebar = kotak.width
      tinggi = kotak.height
      kanvas!.width = lebar * dpr
      kanvas!.height = tinggi * dpr
      ctx!.scale(dpr, dpr)

      partikel = Array.from({ length: JUMLAH_PARTIKEL }, () => ({
        x: Math.random() * lebar,
        y: Math.random() * tinggi,
        panjang: 12 + Math.random() * 28,
        kecepatan: 0.4 + Math.random() * 0.9,
        opasitas: 0.2 + Math.random() * 0.25,
      }))
    }

    function gambar() {
      ctx!.clearRect(0, 0, lebar, tinggi)

      for (const p of partikel) {
        p.y += p.kecepatan
        if (p.y > tinggi + p.panjang) p.y = -p.panjang

        const gradasi = ctx!.createLinearGradient(p.x, p.y, p.x, p.y + p.panjang)
        gradasi.addColorStop(0, `rgba(103, 232, 249, 0)`)
        gradasi.addColorStop(0.45, `rgba(103, 232, 249, ${p.opasitas})`)
        gradasi.addColorStop(1, `rgba(52, 211, 153, 0)`)
        ctx!.strokeStyle = gradasi
        ctx!.lineWidth = 1
        ctx!.beginPath()
        ctx!.moveTo(p.x, p.y)
        ctx!.lineTo(p.x, p.y + p.panjang)
        ctx!.stroke()
      }

      frameId = requestAnimationFrame(gambar)
    }

    ukurUlang()
    frameId = requestAnimationFrame(gambar)
    window.addEventListener("resize", ukurUlang)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener("resize", ukurUlang)
    }
  }, [kurangiGerak])

  if (kurangiGerak) return null

  return (
    <canvas
      ref={kanvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-90"
    />
  )
}
