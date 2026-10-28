// features/dashboard/components/pengguna/pengguna-dialog/tata-letak-form.tsx —
// dua pembungkus kecil supaya jarak, label, dan teks bantu di seluruh dialog
// seragam dan diubah di satu tempat.
import type * as React from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/// Ruang di dalam field (teks tidak menempel ke garis). Bawaan komponen UI
/// px-2.5 (10px) terasa mepet di dialog; 12px di sini. Tinggi (h-8) tidak
/// berubah. Dipakai di SEMUA Input & SelectTrigger dialog ini.
export const KELAS_INPUT = "px-3"
export const KELAS_SELECT = "pl-3 pr-2.5"

/// Kelompok field dengan judul kecil (Identitas, Akses, ...).
export function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <h3 className="text-xs font-medium text-muted-foreground">{judul}</h3>
      {children}
    </section>
  )
}

/// Satu field: label + kontrol + teks bantu opsional. `id` harus sama dengan
/// id kontrolnya (Input atau SelectTrigger) supaya label bisa diklik.
export function Medan({
  id,
  label,
  petunjuk,
  galat,
  children,
}: {
  id: string
  label: string
  petunjuk?: string
  /** true = teks bantu tampil sebagai peringatan (warna --destructive). */
  galat?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {petunjuk && (
        <p className={cn("text-xs", galat ? "text-destructive" : "text-muted-foreground")}>{petunjuk}</p>
      )}
    </div>
  )
}
