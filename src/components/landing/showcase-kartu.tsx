"use client"

// Kartu angka untuk Showcase. Fungsi:
//  - menandai kartu "terlihat" (data-terlihat) saat masuk layar, dipakai anak-anaknya
//    lewat group-data-terlihat: untuk memulai animasi
//  - menghitung angka naik dari 0 (berhenti di nilai akhir)
//  - spotlight + garis tepi tipis yang mengikuti kursor mouse
// Warna aksen diatur lewat variabel CSS --aksen (mis. "var(--info)"). Latar kartu tetap netral;
// aksen hanya dipakai untuk elemen kecil supaya tampilan tetap sederhana dan elegan.
import { useEffect, useRef, useState } from "react"
import type { CSSProperties, PointerEvent, ReactNode } from "react"

import { cn } from "@/lib/utils"

const GAYA = `
.sc-tepi{
  padding:1px;
  background:radial-gradient(240px circle at var(--mx,50%) var(--my,50%),color-mix(in oklab,var(--aksen) 55%,transparent),transparent 70%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  mask-composite:exclude;
}
`

const format = new Intl.NumberFormat("id-ID")

type Props = {
  nilai: number
  label: string
  /** Kartu utama: angka lebih besar dan ruang lebih lega. */
  besar?: boolean
  /** Warna aksen kartu, mis. "var(--info)". Bawaan: warna teks tema. */
  aksen?: string
  /** Urutan kartu: mengatur jeda mulai hitung naik (urutan x 120 ms). */
  urutan?: number
  /** Isi bagian atas kartu (ikon, ilustrasi). */
  atas?: ReactNode
  /** Dekorasi latar yang mengisi seluruh kartu (tidak menerima klik). */
  latar?: ReactNode
  className?: string
}

export function KartuStat({
  nilai,
  label,
  besar,
  aksen = "var(--foreground)",
  urutan = 0,
  atas,
  latar,
  className,
}: Props) {
  const akar = useRef<HTMLDivElement>(null)
  const angka = useRef<HTMLSpanElement>(null)
  const [terlihat, setTerlihat] = useState(false)

  useEffect(() => {
    const el = akar.current
    if (!el) return

    const kurangi = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let bingkai = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    // Hitung naik dari 0 ke nilai akhir dengan easing melambat di ujung.
    const jalankan = () => {
      const teks = angka.current
      if (!teks) return
      const mulai = performance.now()
      const durasi = 1600
      const langkah = (sekarang: number) => {
        const t = Math.min((sekarang - mulai) / durasi, 1)
        const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
        teks.textContent = format.format(Math.round(nilai * e))
        if (t < 1) bingkai = requestAnimationFrame(langkah)
      }
      bingkai = requestAnimationFrame(langkah)
    }

    const pengamat = new IntersectionObserver(
      ([entri]) => {
        if (!entri.isIntersecting) return
        pengamat.disconnect()
        setTerlihat(true)
        if (kurangi) return
        if (angka.current) angka.current.textContent = format.format(0)
        timer = setTimeout(jalankan, urutan * 120)
      },
      { threshold: 0.25 },
    )
    pengamat.observe(el)

    return () => {
      pengamat.disconnect()
      clearTimeout(timer)
      cancelAnimationFrame(bingkai)
    }
  }, [nilai, urutan])

  // Spotlight hanya untuk mouse; layar sentuh tidak punya hover.
  const gerak = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`)
  }

  return (
    <div
      ref={akar}
      data-terlihat={terlihat ? "" : undefined}
      onPointerMove={gerak}
      style={{ "--aksen": aksen } as CSSProperties}
      className={cn(
        "group relative isolate flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-6 shadow-panel transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-overlay motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        besar && "p-8",
        className,
      )}
    >
      <style>{GAYA}</style>

      {/* Dekorasi latar dari pemanggil (gelombang, grafik, dll.) */}
      {latar ? <div className="pointer-events-none absolute inset-0 -z-10">{latar}</div> : null}

      {/* Garis highlight tipis di tepi atas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-(--aksen) to-transparent opacity-30 transition-opacity duration-300 group-hover:opacity-70"
      />

      {/* Spotlight halus yang mengikuti kursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--mx,50%) var(--my,50%), color-mix(in oklab, var(--aksen) 9%, transparent), transparent 70%)",
        }}
      />

      {/* Garis tepi yang menyala tipis di dekat kursor */}
      <div
        aria-hidden
        className="sc-tepi pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative flex flex-col gap-6">{atas}</div>

      <div className="relative mt-10">
        <p className={cn("font-semibold tracking-tight tabular-nums", besar ? "text-6xl sm:text-7xl" : "text-4xl")}>
          {/* Teks animasi disembunyikan dari pembaca layar; nilai akhir dibacakan lewat sr-only. */}
          <span
            ref={angka}
            aria-hidden
            className={besar ? "bg-linear-to-b from-foreground to-foreground/65 bg-clip-text text-transparent" : undefined}
          >
            {format.format(nilai)}
          </span>
          <span className="sr-only">{format.format(nilai)}</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}