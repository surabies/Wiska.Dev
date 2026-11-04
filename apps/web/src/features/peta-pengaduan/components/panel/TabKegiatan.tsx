"use client"

import { ArrowLeft, Wrench } from "@/components/ui/hugeicons-compat"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { STATUS_META } from "../../lib/KonstantaPengaduan"
import type { StatusPengaduan } from "../../types/TipePengaduan"

export interface ItemKegiatan {
  id: string
  tiketId: string
  nomorTiket: string
  kategori: string
  alamat: string
  aksi: string
  status: StatusPengaduan
  catatan?: string
  olehNama: string
  waktu: string
  lat: number
  lng: number
}

interface Props {
  kegiatan: ItemKegiatan[]
  onPilihTiket: (tiketId: string) => void
  formatWaktu: Intl.DateTimeFormat
}

export function TabKegiatan({ kegiatan, onPilihTiket, formatWaktu }: Props) {
  if (kegiatan.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        Belum ada riwayat aktivitas petugas yang tercatat.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="text-xs font-semibold text-foreground">
          Feed Aktivitas Tim Operasional Lapangan
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Pantau disposisi, verifikasi, dan tindakan petugas secara langsung.
        </p>
      </div>

      <ol className="relative flex flex-col gap-3 border-l-2 border-border/80 pl-4 ml-2 mt-1">
        {kegiatan.map((item) => {
          const meta = STATUS_META[item.status]
          return (
            <li key={item.id} className="group relative flex flex-col gap-1 min-w-0">
              {/* Bullet marker */}
              <span
                className="absolute -left-[23px] top-1.5 flex size-3.5 items-center justify-center rounded-full border-2 border-background"
                style={{ backgroundColor: meta?.warna || "#6366f1" }}
              />

              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1 truncate min-w-0">
                  <Wrench className="size-3 text-primary shrink-0" />
                  <span className="truncate">{item.olehNama}</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {formatWaktu.format(new Date(item.waktu))}
                </span>
              </div>

              <div className="rounded-lg border bg-card p-2.5 text-xs shadow-2xs group-hover:border-primary/40 transition-colors min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
                  <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 border-transparent bg-muted font-mono shrink-0">
                    {item.nomorTiket}
                  </Badge>
                  <span className="text-[11px] font-medium text-muted-foreground truncate text-right">
                    {item.kategori}
                  </span>
                </div>

                <p className="text-foreground leading-relaxed break-words text-xs">
                  {item.catatan || `Aksi ${item.aksi} dilakukan pada tiket ${item.nomorTiket}.`}
                </p>

                <div className="mt-2 flex items-center justify-between border-t pt-1.5 gap-2 min-w-0">
                  <span className="text-[10px] text-muted-foreground truncate min-w-0 flex-1">
                    {item.alamat}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-primary shrink-0"
                    onClick={() => onPilihTiket(item.tiketId)}
                  >
                    Fokus Tiket <ArrowLeft className="rotate-180 size-3 ml-0.5" />
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
