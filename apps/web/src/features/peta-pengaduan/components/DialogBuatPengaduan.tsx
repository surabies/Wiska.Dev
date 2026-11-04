"use client"

import { useRef } from "react"
import { Camera, MapPin, MousePointerClick, TriangleAlert, X } from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { KATEGORI, MAKS_FOTO, dalamWilayah } from "../lib/KonstantaPengaduan"
import type { TitikDraft } from "../types/TipePengaduan"
import type { NilaiFormulir, useFormulirPengaduan } from "../hooks/UseFormulirPengaduan"

interface Props {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  draft: TitikDraft | null
  nilai: NilaiFormulir
  ubah: ReturnType<typeof useFormulirPengaduan>["ubah"]
  mengirim: boolean
  onPilihDiPeta: () => void
  onKirim: () => void
}

export function DialogBuatPengaduan({
  buka,
  onBukaChange,
  draft,
  nilai,
  ubah,
  mengirim,
  onPilihDiPeta,
  onKirim,
}: Props) {
  const inputFotoRef = useRef<HTMLInputElement>(null)

  const diWilayah = draft ? dalamWilayah(draft.lng, draft.lat) : true
  const valid =
    Boolean(nilai.kategori) &&
    nilai.deskripsi.trim().length >= 10 &&
    nilai.pelapor.trim().length >= 2 &&
    nilai.kontak.trim().length >= 5 &&
    Boolean(draft) &&
    diWilayah

  function tambahFoto(files: FileList | null) {
    if (!files) return
    const baru = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }))
    ubah("foto", [...nilai.foto, ...baru].slice(0, MAKS_FOTO))
  }

  function hapusFoto(url: string) {
    URL.revokeObjectURL(url)
    ubah(
      "foto",
      nilai.foto.filter((f) => f.url !== url),
    )
  }

  return (
    <Dialog open={buka} onOpenChange={onBukaChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle>Buat Pengaduan Gangguan Air</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Laporan Anda akan tercatat di sistem tiket PERUMDA Tirtawening.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 min-h-0">
          {/* Foto */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label>Foto Kondisi Lapangan</Label>
              <span className="text-xs text-muted-foreground">Opsional</span>
            </div>
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                tambahFoto(e.target.files)
                e.target.value = ""
              }}
            />
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <Button
                type="button"
                variant="secondary"
                disabled={nilai.foto.length >= MAKS_FOTO}
                onClick={() => inputFotoRef.current?.click()}
              >
                <Camera className="mr-1.5 size-4" /> Unggah Foto
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {nilai.foto.length}/{MAKS_FOTO}. Hindari foto wajah orang dan plat nomor kendaraan.
              </p>
              {nilai.foto.length > 0 && (
                <ul className="grid grid-cols-3 gap-2">
                  {nilai.foto.map((f) => (
                    <li key={f.url} className="relative aspect-square overflow-hidden rounded-md border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.url}
                        alt="Pratinjau foto pengaduan"
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => hapusFoto(f.url)}
                        aria-label="Hapus foto"
                        className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow hover:bg-background"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Nama Pelapor */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="pelapor">
              Nama Pelapor <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pelapor"
              value={nilai.pelapor}
              onChange={(e) => ubah("pelapor", e.target.value)}
              placeholder="Nama lengkap Anda..."
            />
          </div>

          {/* Nomor HP / Kontak */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="kontak">
              Nomor HP / WhatsApp <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kontak"
              value={nilai.kontak}
              onChange={(e) => ubah("kontak", e.target.value)}
              placeholder="Contoh: 081234567890 (untuk kabar tindak lanjut)"
            />
          </div>

          {/* Kategori */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="kategori">
              Kategori Gangguan <span className="text-destructive">*</span>
            </Label>
            <Select value={nilai.kategori} onValueChange={(v) => ubah("kategori", v)}>
              <SelectTrigger id="kategori" className="w-full">
                <SelectValue placeholder="Pilih kategori gangguan" />
              </SelectTrigger>
              <SelectContent>
                {KATEGORI.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Deskripsi */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="deskripsi">
              Deskripsi Masalah <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="deskripsi"
              rows={4}
              value={nilai.deskripsi}
              onChange={(e) => ubah("deskripsi", e.target.value)}
              placeholder="Ceritakan apa yang terjadi, sejak kapan, dan seberapa parah kondisinya (minimal 10 karakter)..."
            />
          </div>

          {/* Lokasi */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="lokasi">
              Titik Lokasi <span className="text-destructive">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Pilih titik di peta atau klik area peta lalu tekan Buat Pengaduan.
            </p>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="lokasi"
                readOnly
                className="pl-9"
                value={draft ? (draft.memuat ? "Mencari alamat…" : (draft.alamat ?? "")) : ""}
                placeholder="Belum ada lokasi dipilih dari peta"
              />
            </div>
            {draft && (
              <p className="font-mono text-xs text-muted-foreground">
                {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
              </p>
            )}
            {!diWilayah && (
              <p role="alert" className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Lokasi ini berada di luar batas wilayah layanan Kota Bandung.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={onPilihDiPeta}
            >
              <MousePointerClick className="mr-1.5 size-4" /> Pilih di peta
            </Button>
          </div>
        </div>

        {/* Footer dialog diperbaiki murni m-0 dan shrink-0 tanpa overflow */}
        <DialogFooter className="m-0 shrink-0 border-t bg-background px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 rounded-b-xl">
          <Button type="button" variant="outline" onClick={() => onBukaChange(false)}>
            Batal
          </Button>
          <Button type="button" disabled={!valid || mengirim} onClick={onKirim}>
            {mengirim ? "Mengirim Laporan…" : "Kirim Pengaduan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
