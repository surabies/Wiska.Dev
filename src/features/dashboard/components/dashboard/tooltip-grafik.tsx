"use client"

// features/dashboard/components/dashboard/tooltip-grafik.tsx — tooltip bersama
// untuk grafik Recharts di dashboard (TrenPenjualan, TrenAnomali).
//
// Dipasang lewat <ChartTooltip content={<TooltipGrafik seri={...} />} />.
// Recharts menyuntikkan `active`, `payload`, dan `label` sendiri; sisanya
// (seri, judul, format, ...) diisi pemanggil.
//
// Tampilan: memakai `.surface-floating` dari globals.css (kaca tembus pandang +
// blur tipis + highlight tepi atas), jadi serasi dengan dropdown dan popover.
// Setiap baris: penanda warna persegi kecil, nama seri, nilai tabular rata
// kanan. Untuk grafik tumpuk, `tampilkanTotal` menambah baris jumlah di dasar.
import { cn } from "@/lib/utils"

export interface SeriTooltip {
  label: string
  /** Warna penanda; boleh `var(--chart-1)` atau `var(--color-KUNCI)`. */
  warna: string
}

interface ItemTooltip {
  dataKey?: string | number
  value?: number | string | null
}

export function TooltipGrafik({
  active,
  payload,
  label,
  seri,
  judul,
  format,
  tampilkanTotal = false,
  sembunyikanNol = false,
  className,
}: {
  active?: boolean
  payload?: ItemTooltip[]
  label?: string | number
  /** Peta dataKey → label & warna. Kunci yang tidak ada di sini diabaikan. */
  seri: Record<string, SeriTooltip>
  /** Judul di atas daftar, mis. periode yang sudah diformat. */
  judul?: (label: string | number | undefined) => string
  /** Format nilai per baris. Bawaan: angka lokal Indonesia. */
  format?: (nilai: number, kunci: string) => string
  tampilkanTotal?: boolean
  /** Sembunyikan baris bernilai 0 (berguna untuk batang tumpuk). */
  sembunyikanNol?: boolean
  className?: string
}) {
  if (!active || !payload?.length) return null

  const baris = payload
    .flatMap((p) => {
      const kunci = String(p.dataKey ?? "")
      const s = seri[kunci]
      const nilai = Number(p.value)
      if (!s || !Number.isFinite(nilai) || (sembunyikanNol && nilai === 0)) return []
      return [{ kunci, s, nilai }]
    })
    .sort((a, b) => b.nilai - a.nilai)

  if (baris.length === 0) return null

  const fmt = format ?? ((n: number) => n.toLocaleString("id-ID"))
  const total = baris.reduce((a, b) => a + b.nilai, 0)

  return (
    <div className={cn("surface-floating min-w-44 rounded-lg px-3 py-2.5 text-xs", className)}>
      <p className="label-micro text-muted-foreground mb-2 text-[10px]">
        {judul ? judul(label) : String(label ?? "")}
      </p>

      <ul className="flex flex-col gap-1.5">
        {baris.map(({ kunci, s, nilai }) => (
          <li key={kunci} className="flex items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: s.warna }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="num text-foreground ml-auto pl-4 font-medium">{fmt(nilai, kunci)}</span>
          </li>
        ))}
      </ul>

      {tampilkanTotal && baris.length > 1 && (
        <div className="border-border-subtle mt-2 flex items-center justify-between border-t pt-2">
          <span className="text-muted-foreground">Total</span>
          <span className="num text-foreground font-semibold">{fmt(total, "total")}</span>
        </div>
      )}
    </div>
  )
}