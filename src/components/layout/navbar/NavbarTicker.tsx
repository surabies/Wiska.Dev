"use client"

// components/layout/navbar/NavbarTicker.tsx
// Running text / Marquee Reminder yang tampil khusus di halaman verifikasi.
// Berbentuk kapsul pill modern dengan pause-on-hover dan seamless loop.

import * as React from "react"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"

const PESAN_REMINDER = [
  "Tetap semangat bekerja dan lakukan yang terbaik untuk perusahaan ✨",
  "Teliti dan cermat dalam memverifikasi data pembacaan meter demi akurasi tagihan pelanggan 💧",
  "Integritas dan dedikasi Anda adalah kunci pelayanan prima perusahaan 🤝",
]

export function NavbarTicker() {
  const pathname = usePathname()

  // Hanya tampil saat berada di rute verifikasi (/verifikasi/*)
  const diHalamanVerifikasi = pathname?.startsWith("/verifikasi")
  if (!diHalamanVerifikasi) return null

  const teksGabung = PESAN_REMINDER.join("  •  ") + "  •  "

  return (
    <div
      aria-label="Pengingat dan motivasi kerja"
      className="group relative hidden max-w-xs items-center gap-2 overflow-hidden rounded-full border border-white bg-card px-2.5 py-1 text-xs text-foreground shadow-xs transition-colors md:flex sm:max-w-sm lg:max-w-md xl:max-w-lg dark:border-border"
    >
      {/* Badge penanda statis di sisi kiri */}
      <div className="flex shrink-0 items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
        <HugeiconsIcon
          icon={SparklesIcon}
          strokeWidth={2}
          className="size-3 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <span>Motivasi</span>
      </div>

      {/* Area teks bergerak dengan efek vinyet halus di kedua tepi */}
      <div className="relative flex-1 overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-3 bg-linear-to-r from-card to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-3 bg-linear-to-l from-card to-transparent"
        />

        {/* Ticker marquee container: pause on hover */}
        <div className="flex w-max cursor-default overflow-hidden whitespace-nowrap group-hover:[animation-play-state:paused] motion-reduce:[animation:none]">
          <span className="navbar-ticker-track inline-block pr-6 font-normal text-muted-foreground">
            {teksGabung}
          </span>
          <span
            aria-hidden="true"
            className="navbar-ticker-track inline-block pr-6 font-normal text-muted-foreground"
          >
            {teksGabung}
          </span>
        </div>
      </div>

      <style jsx>{`
        .navbar-ticker-track {
          display: inline-block;
          animation: tickerScroll 24s linear infinite;
        }
        :global(.group:hover) .navbar-ticker-track {
          animation-play-state: paused;
        }
        @keyframes tickerScroll {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  )
}
