"use client"

// Latar hero.
// Tema terang: CanvasFractalGrid (haze + titik), parameter berbeda untuk desktop dan HP.
// Tema gelap: canvas transparan buatan sendiri (TitikGelombang) di atas latar --background,
// berisi titik putih pudar dengan gelombang ambient, sorotan kursor, dan riak.
import { useTheme } from "next-themes"
import { useEffect, useRef, useSyncExternalStore } from "react"

import { CanvasFractalGrid } from "@/components/ui/canvas-fractal-grid"

const QUERY_DESKTOP = "(min-width: 768px)"

function langgananLayar(onChange: () => void) {
  const mq = window.matchMedia(QUERY_DESKTOP)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}
const layarDesktop = () => window.matchMedia(QUERY_DESKTOP).matches
// Di server dianggap desktop, jadi tampilan desktop tidak berkedip saat hidrasi.
const layarDesktopServer = () => true

type Riak = { x: number; y: number; t: number }

// Pengaturan efek. Ubah angka di sini untuk menyetel tampilan.
const RADIUS_SOROT = 170 // jangkauan sorotan kursor (px)
const DURASI_RIAK = 1800 // umur satu riak (ms)
const JANGKAUAN_RIAK = 460 // seberapa jauh riak mengembang (px)
const LEBAR_RIAK = 44 // ketebalan cincin riak (px)
const MAKS_RIAK = 5

function TitikGelombang() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let w = 0
    let h = 0
    let dpr = 1
    let bingkai = 0
    let tampil = true
    const kursor = { x: -9999, y: -9999 }
    const jejak = { x: -9999, y: -9999, t: 0 }
    const riak: Riak[] = []

    const ukur = () => {
      const r = canvas.getBoundingClientRect()
      w = r.width
      h = r.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const gambar = (now: number) => {
      ctx.clearRect(0, 0, w, h)
      const spasi = w < 768 ? 24 : 20
      const kolom = Math.ceil(w / spasi)
      const baris = Math.ceil(h / spasi)

      // Buang riak yang sudah habis umurnya.
      for (let i = riak.length - 1; i >= 0; i--) {
        if (now - riak[i].t > DURASI_RIAK) riak.splice(i, 1)
      }

      const t = kurangiGerak ? 0 : now

      for (let j = 0; j < baris; j++) {
        for (let i = 0; i < kolom; i++) {
          const x0 = i * spasi + spasi / 2
          const y0 = j * spasi + spasi / 2

          // Gelombang ambient: pita cahaya lembut yang merambat diagonal.
          const a = 0.5 + 0.5 * Math.sin(x0 * 0.011 + y0 * 0.007 - t * 0.0007)
          let alpha = 0.08 + 0.14 * a
          let radius = 0.9 + 0.5 * a
          let dx = 0
          let dy = 0

          // Sorotan kursor: titik membesar, menyala, dan sedikit menjauh.
          const kx = x0 - kursor.x
          const ky = y0 - kursor.y
          const jarakKursor = Math.hypot(kx, ky)
          if (jarakKursor < RADIUS_SOROT) {
            const k = (1 - jarakKursor / RADIUS_SOROT) ** 2
            alpha += 0.65 * k
            radius += 1.3 * k
            if (jarakKursor > 0) {
              dx += (kx / jarakKursor) * 5 * k
              dy += (ky / jarakKursor) * 5 * k
            }
          }

          // Riak: cincin yang mengembang dari titik klik/tap atau jejak kursor.
          for (let r = 0; r < riak.length; r++) {
            const umur = (now - riak[r].t) / DURASI_RIAK
            const depan = umur * JANGKAUAN_RIAK
            const rx = x0 - riak[r].x
            const ry = y0 - riak[r].y
            const jarak = Math.hypot(rx, ry)
            const selisih = Math.abs(jarak - depan)
            if (selisih < LEBAR_RIAK) {
              const k = (1 - selisih / LEBAR_RIAK) * (1 - umur)
              alpha += 0.7 * k
              radius += 1.5 * k
              if (jarak > 0) {
                dx += (rx / jarak) * 4 * k
                dy += (ry / jarak) * 4 * k
              }
            }
          }

          ctx.fillStyle = `rgba(255,255,255,${Math.min(alpha, 0.9).toFixed(3)})`
          ctx.beginPath()
          ctx.arc(x0 + dx, y0 + dy, radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const putar = (now: number) => {
      bingkai = 0
      gambar(now)
      if (!kurangiGerak && tampil && !document.hidden) bingkai = requestAnimationFrame(putar)
    }

    const mulai = () => {
      if (!bingkai) bingkai = requestAnimationFrame(putar)
    }

    const tambahRiak = (x: number, y: number) => {
      riak.push({ x, y, t: performance.now() })
      if (riak.length > MAKS_RIAK) riak.shift()
      // Mode "reduce motion" tidak berputar, jadi gambar ulang sekali saja.
      if (kurangiGerak) gambar(performance.now())
    }

    const dalamKanvas = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      return x >= 0 && y >= 0 && x <= r.width && y <= r.height ? { x, y } : null
    }

    const onGerak = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || kurangiGerak) return
      const p = dalamKanvas(e)
      if (!p) {
        kursor.x = -9999
        kursor.y = -9999
        return
      }
      kursor.x = p.x
      kursor.y = p.y
      // Riak kecil di jejak kursor, tiap kali bergerak cukup jauh dan cukup lama.
      const now = performance.now()
      if (Math.hypot(p.x - jejak.x, p.y - jejak.y) > 130 && now - jejak.t > 380) {
        jejak.x = p.x
        jejak.y = p.y
        jejak.t = now
        tambahRiak(p.x, p.y)
      }
    }

    const onTekan = (e: PointerEvent) => {
      if (kurangiGerak) return
      const p = dalamKanvas(e)
      if (p) tambahRiak(p.x, p.y)
    }

    const pengamatUkuran = new ResizeObserver(() => {
      ukur()
      if (kurangiGerak) gambar(0)
    })
    pengamatUkuran.observe(canvas)

    // Berhenti saat hero di luar layar, lanjut saat terlihat lagi.
    const pengamatTampil = new IntersectionObserver(([entri]) => {
      tampil = entri.isIntersecting
      if (tampil) mulai()
    })
    pengamatTampil.observe(canvas)

    const onTerlihat = () => {
      if (!document.hidden) mulai()
    }

    ukur()
    gambar(0)
    mulai()

    window.addEventListener("pointermove", onGerak, { passive: true })
    window.addEventListener("pointerdown", onTekan, { passive: true })
    document.addEventListener("visibilitychange", onTerlihat)

    return () => {
      cancelAnimationFrame(bingkai)
      pengamatUkuran.disconnect()
      pengamatTampil.disconnect()
      window.removeEventListener("pointermove", onGerak)
      window.removeEventListener("pointerdown", onTekan)
      document.removeEventListener("visibilitychange", onTerlihat)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className="absolute inset-0 block h-full w-full" />
}

export function LatarHero() {
  const desktop = useSyncExternalStore(langgananLayar, layarDesktop, layarDesktopServer)
  const { resolvedTheme } = useTheme()

  return (
    <div className="relative h-full w-full">
      {/* Tema gelap: canvas transparan di atas latar --background. Hanya dimuat saat tema gelap. */}
      {resolvedTheme === "dark" && <TitikGelombang />}

      {/* Tema terang: canvas bawaan. Tidak dimuat saat tema gelap supaya tidak berjalan percuma. */}
      {resolvedTheme !== "dark" &&
        (desktop ? (
          <CanvasFractalGrid
            dotSize={3}
            dotSpacing={20}
            dotOpacity={0.4}
            gradientAnimationDuration={6}
            waveIntensity={60}
            waveRadius={250}
            enableGradient={true}
            enableMouseGlow={true}
            enableNoise={true}
          />
        ) : (
          <CanvasFractalGrid
            dotSize={2.5}
            dotSpacing={24}
            dotOpacity={0.35}
            gradientAnimationDuration={8}
            waveIntensity={35}
            waveRadius={140}
            enableGradient={true}
            enableMouseGlow={false}
            enableNoise={false}
          />
        ))}
    </div>
  )
}