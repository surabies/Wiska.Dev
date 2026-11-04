"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { simpanKelurahan, perbaruiKelurahan } from "../../api/ApiWilayah"
import type { KecamatanItem, KelurahanItem } from "../../types/TipeWilayah"

interface DialogKelurahanProps {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  kelurahanEdit: KelurahanItem | null
  daftarKecamatan: KecamatanItem[]
  onSukses: () => void
}

export function DialogKelurahan({
  buka,
  onBukaChange,
  kelurahanEdit,
  daftarKecamatan,
  onSukses,
}: DialogKelurahanProps) {
  const [kode, setKode] = useState("")
  const [nama, setNama] = useState("")
  const [kecamatanId, setKecamatanId] = useState("")
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (kelurahanEdit) {
      setKode(kelurahanEdit.kode)
      setNama(kelurahanEdit.nama)
      setKecamatanId(kelurahanEdit.kecamatanId)
    } else {
      setKode("")
      setNama("")
      setKecamatanId(daftarKecamatan[0]?.id ?? "")
    }
    setGalat(null)
  }, [kelurahanEdit, daftarKecamatan, buka])

  async function handleSimpan(e: React.FormEvent) {
    e.preventDefault()
    if (!kecamatanId) {
      setGalat("Silakan pilih kecamatan induk")
      return
    }
    setMemuat(true)
    setGalat(null)
    try {
      if (kelurahanEdit) {
        await perbaruiKelurahan(kelurahanEdit.id, { kode, nama, kecamatanId })
      } else {
        await simpanKelurahan({ kode, nama, kecamatanId })
      }
      onSukses()
      onBukaChange(false)
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyimpan kelurahan"
      setGalat(pesan)
    } finally {
      setMemuat(false)
    }
  }

  return (
    <Dialog open={buka} onOpenChange={onBukaChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSimpan}>
          <DialogHeader>
            <DialogTitle>{kelurahanEdit ? "Ubah Kelurahan" : "Tambah Kelurahan Baru"}</DialogTitle>
            <DialogDescription>
              {kelurahanEdit
                ? "Perbarui kode, nama, atau kecamatan induk kelurahan."
                : "Daftarkan kelurahan baru ke dalam basis data wilayah."}
            </DialogDescription>
          </DialogHeader>

          {galat && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {galat}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="induk-kecamatan">Kecamatan Induk</Label>
              <Select value={kecamatanId} onValueChange={setKecamatanId} disabled={memuat}>
                <SelectTrigger id="induk-kecamatan">
                  <SelectValue placeholder="Pilih kecamatan" />
                </SelectTrigger>
                <SelectContent>
                  {daftarKecamatan.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      [{k.kode}] {k.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kode-kelurahan">Kode Kelurahan</Label>
              <Input
                id="kode-kelurahan"
                placeholder="Contoh: KEL-0101"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                required
                disabled={memuat}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nama-kelurahan">Nama Kelurahan</Label>
              <Input
                id="nama-kelurahan"
                placeholder="Contoh: DAGO"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                required
                disabled={memuat}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onBukaChange(false)}
              disabled={memuat}
            >
              Batal
            </Button>
            <Button type="submit" disabled={memuat || !kode.trim() || !nama.trim()}>
              {memuat ? "Menyimpan…" : "Simpan Kelurahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
