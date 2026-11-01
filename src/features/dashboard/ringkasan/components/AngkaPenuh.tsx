"use client"

import { cn } from "@/lib/Utilitas"

export function formatAngkaPenuh(nilai: number): string {
  return nilai.toLocaleString("id-ID", { maximumFractionDigits: 2 })
}

export function AngkaPenuh({
  nilai,
  awalan,
  akhiran,
  kecil = false,
  className,
}: {
  nilai: number
  awalan?: string
  akhiran?: string
  kecil?: boolean
  className?: string
}) {
  const teks = formatAngkaPenuh(nilai)
  const [bilanganBulat, pecahan] = teks.split(",")
  const kelompok = bilanganBulat.split(".")
  const kelompokAkhir = kelompok.length > 1 ? kelompok.pop() : undefined
  const utama = kelompok.join(".") + (kelompokAkhir ? "." : "")
  const ukuran = kecil ? 1.125 : 1.5
  const fontSize = Math.max(
    kecil ? 0.875 : 1,
    ukuran - Math.max(0, teks.length - 8) * (kecil ? 0.035 : 0.065)
  )

  return (
    <span
      aria-label={`${awalan ? `${awalan} ` : ""}${teks}${akhiran ? ` ${akhiran}` : ""}`}
      className={cn(
        "inline-flex max-w-full min-w-0 items-baseline num-display whitespace-nowrap",
        className
      )}
      style={{ fontSize: `${fontSize}rem` }}
    >
      {awalan && (
        <span
          aria-hidden
          className="mr-[0.3em] shrink-0 text-[0.58em] font-semibold tracking-wide text-muted-foreground"
        >
          {awalan}
        </span>
      )}
      <span aria-hidden>{utama}</span>
      {kelompokAkhir && (
        <span aria-hidden className="text-[0.74em] text-foreground/80">
          {kelompokAkhir}
        </span>
      )}
      {pecahan && (
        <span aria-hidden className="text-[0.74em] text-foreground/80">
          ,{pecahan}
        </span>
      )}
      {akhiran && (
        <span aria-hidden className="ml-[0.3em] shrink-0 text-[0.62em]">
          {akhiran}
        </span>
      )}
    </span>
  )
}
