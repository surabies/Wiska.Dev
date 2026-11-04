"use client"

import { useEffect, useRef, type TouchEvent, type ReactNode } from "react"
import { cn } from "@/lib/Utilitas"
import type { Pengaduan } from "../types/TipePengaduan"

export type PosisiDrawer = "sembunyi" | "separuh" | "penuh"

interface Props {
  data: Pengaduan[]
  terpilihId: string | null
  posisi: PosisiDrawer
  onUbahPosisi: (pos: PosisiDrawer) => void
  onBuat?: () => void
  children: ReactNode
}

export function DrawerBawahMobile({
  terpilihId,
  posisi,
  onUbahPosisi,
  children,
}: Props) {
  const startY = useRef<number | null>(null)
  const currentY = useRef<number | null>(null)

  // Otomatis buka separuh saat ada pin tiket di peta yang diklik
  useEffect(() => {
    if (terpilihId && posisi === "sembunyi") {
      onUbahPosisi("separuh")
    }
  }, [terpilihId, posisi, onUbahPosisi])

  // Touch gesture listener untuk area handle bar
  const handleTouchStart = (e: TouchEvent) => {
    startY.current = e.touches[0].clientY
    currentY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: TouchEvent) => {
    currentY.current = e.touches[0].clientY
  }

  const handleTouchEnd = () => {
    if (startY.current === null || currentY.current === null) {
      startY.current = null
      currentY.current = null
      return
    }

    const deltaY = currentY.current - startY.current
    const threshold = 35 // threshold geser dalam piksel

    if (deltaY > threshold) {
      // Ditarik ke bawah
      if (posisi === "penuh") {
        onUbahPosisi("separuh")
      } else if (posisi === "separuh") {
        onUbahPosisi("sembunyi")
      }
    } else if (deltaY < -threshold) {
      // Ditarik ke atas
      if (posisi === "sembunyi") {
        onUbahPosisi("separuh")
      } else if (posisi === "separuh") {
        onUbahPosisi("penuh")
      }
    }

    startY.current = null
    currentY.current = null
  }

  const handleTouchCancel = () => {
    startY.current = null
    currentY.current = null
  }

  return (
    <>
      {/* Backdrop semi transparan saat drawer dibuka penuh */}
      {posisi === "penuh" && (
        <div
          role="presentation"
          onClick={() => onUbahPosisi("separuh")}
          className="fixed inset-0 z-25 bg-black/40 backdrop-blur-xs transition-opacity duration-300 md:hidden"
        />
      )}

      {/* Kontainer Drawer Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-t bg-background shadow-2xl transition-all duration-300 ease-in-out md:hidden",
          posisi === "sembunyi" && "h-8 max-h-8 overflow-hidden pb-[env(safe-area-inset-bottom)]",
          posisi === "separuh" && "h-[50dvh] max-h-[50dvh] pb-[env(safe-area-inset-bottom)]",
          posisi === "penuh" && "h-[92dvh] max-h-[92dvh] pb-[env(safe-area-inset-bottom)]",
        )}
      >
        {/* Handle Bar Drag & Tap Murni Tanpa Polusi Teks */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onClick={() => {
            // Jika sedang sembunyi, ketukan membuka ke separuh
            if (posisi === "sembunyi") {
              onUbahPosisi("separuh")
            }
          }}
          className={cn(
            "touch-none select-none flex shrink-0 items-center justify-center py-2.5 px-4 cursor-grab active:cursor-grabbing bg-transparent transition-colors",
            posisi === "sembunyi" && "cursor-pointer hover:bg-muted/30",
          )}
          aria-label="Tarik atau geser untuk membuka panel"
        >
          {/* Garis Pill Handle Minimalis di Tengah */}
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/35 transition-colors hover:bg-muted-foreground/60 active:bg-primary" />
        </div>

        {/* Konten Isi Panel Pengaduan (Hanya dirender saat terbuka) */}
        {posisi !== "sembunyi" && (
          <div className="min-h-0 flex-1 overflow-hidden">
            {children}
          </div>
        )}
      </div>
    </>
  )
}
