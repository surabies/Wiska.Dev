"use client"

// features/dashboard/components/verifikasi/dialog-verifikasi.tsx — kerangka
// modal aksi verifikasi, dipakai modal lapangan & mandiri.
//
// STRUKTUR: header TETAP, foto di kiri, dan di kanan area isian yang BISA
// DISCROLL (ScrollArea shadcn) dengan footer aksi yang juga tetap. Kotak isian
// boleh bertambah sebanyak apa pun (modul verifikasi bervariasi) tanpa
// mendorong header atau tombol aksi keluar layar. Tinggi modal dikunci
// `h-[min(92dvh,46rem)]` — ScrollArea butuh tinggi pasti supaya benar-benar
// menggulir, dan bentuk modal jadi sama untuk setiap laporan.
import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FotoKosong, FotoZoom } from "./foto/foto-bukti"
import { TabFoto, type ItemTabFoto } from "./foto/tab-foto"

/// Satu kelas untuk SEMUA kontrol isian modal (Input, Select, Textarea-nya
/// punya tinggi sendiri) — lebar penuh, tinggi sama, tidak ada yang panjang-pendek.
export const KELAS_KONTROL_MODAL = "h-9 w-full text-sm"

export interface OpsiPilihan {
  value: string
  label: string
  disabled?: boolean
}

/// Select shadcn seragam untuk modal.
export function PilihSatu({
  value,
  onChange,
  opsi,
  placeholder,
  disabled,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  opsi: OpsiPilihan[]
  placeholder?: string
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={KELAS_KONTROL_MODAL} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {opsi.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function DialogVerifikasi({
  buka,
  onBuka,
  judul,
  subjudul,
  fotoUrl,
  fotoLabel,
  keteranganFoto,
  fotos,
  children,
  footer,
}: {
  buka: boolean
  onBuka: (v: boolean) => void
  judul: string
  subjudul?: string
  fotoUrl?: string | null
  fotoLabel: string
  /** Teks empty state bila laporan memang tidak berfoto. */
  keteranganFoto?: string
  /** Bila diisi, kolom foto berupa TAB beberapa foto menggantikan `fotoUrl`. */
  fotos?: ItemTabFoto[]
  /** Kotak isian — kolom kanan, DAPAT DISCROLL. */
  children: React.ReactNode
  /** Tombol aksi + pesan galat — menempel di bawah kolom kanan, tidak ikut scroll. */
  footer?: React.ReactNode
}) {
  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      {/* sm:max-w-5xl (bukan max-w-5xl): kelas dasar DialogContent memuat
          sm:max-w-sm — override tanpa prefix sm: kalah spesifik. */}
      <DialogContent className="flex h-[min(92dvh,46rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-3 text-left">
          <DialogTitle className="text-sm">{judul}</DialogTitle>
          {subjudul && <DialogDescription className="text-xs">{subjudul}</DialogDescription>}
        </DialogHeader>

        {/* Layar sempit: seluruh badan menggulir. Layar lebar: dua kolom,
            masing-masing mengatur scroll-nya sendiri. */}
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
          <div className="h-80 min-w-0 p-4 md:h-auto md:min-h-0">
            {fotos ? (
              <TabFoto varian="zoom" item={fotos} />
            ) : fotoUrl ? (
              <FotoZoom url={fotoUrl} label={fotoLabel} />
            ) : (
              <FotoKosong label={fotoLabel} keterangan={keteranganFoto} penuh />
            )}
          </div>

          <div className="flex min-h-0 min-w-0 flex-col border-t border-border/70 md:border-t-0 md:border-l">
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-3 p-4">{children}</div>
            </ScrollArea>
            {footer && <div className="shrink-0 border-t border-border/70 bg-card p-4">{footer}</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}