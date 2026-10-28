"use client"

// Daftar dapat-diurutkan lewat seret (HTML5 drag native — tanpa pustaka dnd).
// Dipakai di halaman Pemetaan Rute untuk menata urutan rute per petugas dan
// urutan pelanggan dalam rute. Seret baris ke posisi baru → onUrut menerima
// daftar id dalam urutan baru (pemanggil yang menyimpan ke server).
import * as React from "react"
import { GripVerticalIcon } from "@/components/ui/hugeicons-compat"
import { cn } from "@/lib/utils"

export function DaftarSeret<T extends { id: string }>({
  items,
  onUrut,
  tampil,
  aksi,
  posisiAsal,
  nonaktif = false,
  label,
  className,
}: {
  items: T[]
  onUrut: (urutBaruIds: string[], idDipindah: string) => void
  tampil: (item: T, indeks: number) => React.ReactNode
  aksi?: (item: T, indeks: number) => React.ReactNode
  posisiAsal?: (item: T, indeks: number) => number | undefined
  /** true = tidak bisa diseret (sedang menyimpan, atau tanpa wewenang ubah). */
  nonaktif?: boolean
  /** Label aksesibilitas daftar. */
  label?: string
  className?: string
}) {
  const [asal, setAsal] = React.useState<number | null>(null)
  const [tujuan, setTujuan] = React.useState<number | null>(null)

  function reset() {
    setAsal(null)
    setTujuan(null)
  }

  // Pemindahan HANYA di onDrop. Dulu `selesai` dipanggil dari onDrop DAN
  // onDragEnd; keduanya membaca state dari render yang sama, jadi satu seretan
  // memanggil onUrut dua kali (dua PATCH ke server). onDragEnd kini cuma reset.
  function lepas(e: React.DragEvent) {
    e.preventDefault()
    if (asal !== null && tujuan !== null && asal !== tujuan) {
      const baru = [...items]
      const [dipindah] = baru.splice(asal, 1)
      if (dipindah !== undefined) {
        baru.splice(tujuan, 0, dipindah)
        onUrut(baru.map((i) => i.id), dipindah.id)
      }
    }
    reset()
  }

  return (
    <ul aria-label={label} className={cn("space-y-1.5", className)}>
      {items.map((item, i) => (
        <li
          key={item.id}
          draggable={!nonaktif}
          onDragStart={() => setAsal(i)}
          onDragOver={(e) => {
            if (nonaktif) return
            e.preventDefault()
            if (tujuan !== i) setTujuan(i)
          }}
          onDrop={lepas}
          onDragEnd={reset}
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-sm transition-colors",
            asal === i && "opacity-40",
            tujuan === i && asal !== null && asal !== i && "border-foreground",
            nonaktif && "opacity-70",
          )}
        >
          <GripVerticalIcon
            className={cn("size-4 shrink-0 text-muted-foreground", !nonaktif && "cursor-grab")}
            aria-hidden
          />
          <div className="min-w-0 flex-1">{tampil(item, i)}</div>
          {aksi?.(item, i)}
          <span className="flex shrink-0 items-center gap-1.5">
            {posisiAsal && posisiAsal(item, i) !== undefined && posisiAsal(item, i) !== i + 1 && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-primary">
                {posisiAsal(item, i)} → {i + 1}
              </span>
            )}
            <span className="num w-6 text-right text-xs text-muted-foreground">{i + 1}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
