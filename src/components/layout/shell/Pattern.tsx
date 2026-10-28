// components/layout/shell/Pattern.tsx
// Pola garis miring halus. Warna dari token --pattern-fg (globals.css),
// jadi terang/gelap otomatis; tidak perlu patternVars lagi.
import { cn } from "@/lib/utils"

// Tahap 1: pita di sisi kiri/kanan konten. `fade` memudarkan ke bawah.
export function PatternStrip({
  className,
  fade = false,
}: {
  className?: string
  fade?: boolean
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "border-x border-x-(--pattern-fg) bg-[repeating-linear-gradient(315deg,var(--pattern-fg)_0,var(--pattern-fg)_1px,transparent_0,transparent_50%)] bg-size-[10px_10px] bg-fixed",
        fade && "[mask-image:linear-gradient(to_bottom,black_55%,transparent)]",
        className,
      )}
    />
  )
}

// Tahap 2: garis horizontal tipis seirama dengan pola.
export function PatternRule({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("h-px w-full bg-(--pattern-fg)", className)} />
  )
}