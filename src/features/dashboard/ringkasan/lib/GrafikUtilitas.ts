"use client"

// features/dashboard/ringkasan/lib/GrafikUtilitas.ts — alat kecil untuk
// grafik SVG ringan di dashboard (TrenPenjualan, TrenAnomali).

import { useEffect, useLayoutEffect, useState } from "react"

// useLayoutEffect memperingatkan di server pada React 18; tooltip hanya muncul
// di klien, jadi di server cukup useEffect.
const useLayoutAman =
  typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * Ukur elemen (lebar & tinggi, piksel) dan ikuti perubahannya. Pasang `pasang`
 * sebagai `ref` elemen yang diukur. Callback ref + state (bukan useRef) supaya
 * aturan react-hooks/refs tidak menandai w/h sebagai nilai ref.
 */
export function useUkuran<T extends HTMLElement>() {
  const [el, pasang] = useState<T | null>(null)
  const [ukuran, setUkuran] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width)
      const h = Math.round(e.contentRect.height)
      setUkuran((lama) => (lama.w === w && lama.h === h ? lama : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])

  return { pasang, w: ukuran.w, h: ukuran.h }
}

/**
 * Posisi tooltip di dekat ujung kursor: di kanan-bawah kursor, berbalik ke
 * kiri/atas bila tidak muat, lalu dijepit agar tidak keluar dari wadah.
 * Pasang `pasang` (callback ref) dan `style` pada elemen tooltip yang
 * `absolute w-max` (w-max penting: lebarnya harus alami agar pengukuran tidak
 * berubah-ubah). Callback ref + state dipakai, bukan useRef, karena posisi
 * dihitung saat render dan aturan react-hooks/refs melarang membaca ref di situ.
 */
export function useTooltipKursor<T extends HTMLElement>(
  wadah: { w: number; h: number },
  kursor: { x: number; y: number } | null
) {
  const [el, pasang] = useState<T | null>(null)
  const [dim, setDim] = useState({ w: 0, h: 0 })

  // Ukur setiap render (murah); state hanya berubah bila ukurannya berubah.
  useLayoutAman(() => {
    const w = el ? el.offsetWidth : 0
    const h = el ? el.offsetHeight : 0
    setDim((lama) => (lama.w === w && lama.h === h ? lama : { w, h }))
  })

  const JARAK = 14
  let left = 0
  let top = 0
  if (kursor) {
    left = kursor.x + JARAK
    if (left + dim.w > wadah.w) left = kursor.x - JARAK - dim.w
    top = kursor.y + JARAK
    if (top + dim.h > wadah.h) top = kursor.y - JARAK - dim.h
    left = Math.min(Math.max(left, 0), Math.max(wadah.w - dim.w, 0))
    top = Math.min(Math.max(top, 0), Math.max(wadah.h - dim.h, 0))
  }

  return {
    pasang,
    style: {
      left,
      top,
      visibility: dim.w === 0 ? ("hidden" as const) : ("visible" as const),
    },
  }
}

const LANGKAH = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

/**
 * Skala sumbu-Y yang rapi: 0, langkah, 2×langkah, … sampai `puncak` (≥ maks).
 * `bulat` = data cacah (anomali): langkah selalu bilangan bulat.
 */
export function skalaRapi(maks: number, bulat = false) {
  const bagi = bulat ? Math.min(3, Math.max(1, Math.ceil(maks))) : 3
  let langkah = 1
  if (maks > 0) {
    const mentah = maks / bagi
    const mag = 10 ** Math.floor(Math.log10(mentah))
    const k = LANGKAH.find((x) => x * mag >= mentah * 0.9999) ?? 10
    langkah = Math.round(k * mag * 1e6) / 1e6
    if (bulat) langkah = Math.max(1, Math.ceil(langkah))
  }
  return {
    puncak: langkah * bagi,
    ticks: Array.from({ length: bagi + 1 }, (_, i) => i * langkah),
  }
}

/** 1.234.567 → "1,2 jt"; 45.000 → "45 rb". */
export function ringkasAngka(n: number): string {
  const f = (x: number) =>
    x.toLocaleString("id-ID", { maximumFractionDigits: 1 })
  const a = Math.abs(n)
  if (a >= 1e9) return `${f(n / 1e9)} M`
  if (a >= 1e6) return `${f(n / 1e6)} jt`
  if (a >= 1e3) return `${f(n / 1e3)} rb`
  return f(n)
}

/** "Maret 2026" → "Mar 26". Bentuk lain dikembalikan apa adanya. */
export function singkatPeriode(teks: string): string {
  const [bulan, tahun] = teks.split(" ")
  return bulan && tahun && tahun.length >= 2
    ? `${bulan.slice(0, 3)} ${tahun.slice(-2)}`
    : teks
}

/** Kurva halus monoton (tidak melampaui nilai data), format atribut `d` SVG. */
export function jalurHalus(
  p: ReadonlyArray<readonly [number, number]>
): string {
  const n = p.length
  if (n === 0) return ""
  if (n === 1) return `M${p[0][0]},${p[0][1]}`

  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(p[i + 1][0] - p[i][0])
    m.push((p[i + 1][1] - p[i][1]) / dx[i])
  }

  const t: number[] = new Array(n)
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++)
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      t[i] = k * a * m[i]
      t[i + 1] = k * b * m[i]
    }
  }

  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${p[i][0] + h},${p[i][1] + t[i] * h} ${p[i + 1][0] - h},${p[i + 1][1] - t[i + 1] * h} ${p[i + 1][0]},${p[i + 1][1]}`
  }
  return d
}
