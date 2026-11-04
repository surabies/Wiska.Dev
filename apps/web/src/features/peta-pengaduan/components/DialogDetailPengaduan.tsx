"use client"

import { Globe, MapPin, Printer, Share2, Star } from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { STATUS_META, labelKategori } from "../lib/KonstantaPengaduan"
import type { Pengaduan } from "../types/TipePengaduan"
import { IKON_STATUS, StatusBadge } from "./StatusBadgePengaduan"

interface Props {
  pengaduan: Pengaduan | null
  buka: boolean
  onBukaChange: (buka: boolean) => void
  onIkuti: (id: string, ikuti: boolean) => void
}

const formatWaktu = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" })

export function DialogDetailPengaduan({ pengaduan: p, buka, onBukaChange, onIkuti }: Props) {
  if (!p) return null

  // Riwayat terbaru di atas
  const riwayat = [...p.riwayat].sort((a, b) => b.waktu.localeCompare(a.waktu))

  async function bagikan() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: `Pengaduan Air ${p!.nomor}`, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  return (
    <Dialog open={buka} onOpenChange={onBukaChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle>
            {p.nomor} - {labelKategori(p.kategori)}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="pt-1">
              <StatusBadge status={p.status} />
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 min-h-0">
          {/* Foto dokumentasi */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Foto Lapangan</h3>
            {p.foto.length ? (
              <div className="grid gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.foto[0]}
                  alt={`Foto pengaduan ${p.nomor}`}
                  className="aspect-video w-full rounded-lg object-cover"
                />
                {p.foto.length > 1 && (
                  <ul className="grid grid-cols-3 gap-2">
                    {p.foto.slice(1).map((url, idx) => (
                      <li key={`${url}-${idx}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          className="aspect-square w-full rounded-md object-cover"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Tidak ada lampiran foto dari pelapor.
              </p>
            )}
          </section>

          {/* Lokasi */}
          <section className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-medium">{p.alamat}</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Globe className="size-3" aria-hidden />
                {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
              </p>
            </div>
          </section>

          {/* Deskripsi */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Deskripsi Gangguan</h3>
            <p className="text-sm leading-relaxed">{p.deskripsi}</p>
          </section>

          {/* Riwayat status */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">Riwayat Penanganan</h3>
            <ol className="flex flex-col">
              {riwayat.map((r, i) => {
                const meta = STATUS_META[r.status]
                const Ikon = IKON_STATUS[r.status]
                return (
                  <li key={r.id ? `${r.id}-${i}` : `${r.waktu}-${r.status}-${i}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: meta.warna }}
                      >
                        <Ikon className="size-4" aria-hidden />
                      </span>
                      {i < riwayat.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-4 text-sm">
                      <p className="font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatWaktu.format(new Date(r.waktu))}
                      </p>
                      {r.catatan && <p className="mt-1 text-xs text-muted-foreground">{r.catatan}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>

        {/* Footer dialog diperbaiki murni m-0 dan shrink-0 tanpa overflow */}
        <DialogFooter className="m-0 shrink-0 border-t bg-background px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={bagikan}
              aria-label="Bagikan"
              title="Bagikan Tautan Laporan"
            >
              <Share2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.print()}
              aria-label="Cetak"
              title="Cetak Laporan"
            >
              <Printer className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onBukaChange(false)}>
              Tutup
            </Button>
            <Button onClick={() => onIkuti(p.id, !p.diikuti)} aria-pressed={p.diikuti}>
              <Star className={p.diikuti ? "fill-current size-4 mr-1.5" : "size-4 mr-1.5"} />
              {p.diikuti ? "Diikuti" : "Ikuti"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
