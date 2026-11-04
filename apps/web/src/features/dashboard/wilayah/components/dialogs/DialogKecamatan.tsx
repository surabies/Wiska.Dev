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
import { simpanKecamatan, perbaruiKecamatan } from "../../api/ApiWilayah"
import type { KecamatanItem } from "../../types/TipeWilayah"

interface DialogKecamatanProps {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  kecamatanEdit: KecamatanItem | null
  onSukses: () => void
}

export function DialogKecamatan({
  buka,
  onBukaChange,
  kecamatanEdit,
  onSukses,
}: DialogKecamatanProps) {
  const [kode, setKode] = useState("")
  const [nama, setNama] = useState("")
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (kecamatanEdit) {
      setKode(kecamatanEdit.kode)
      setNama(kecamatanEdit.nama)
    } else {
      setKode("")
      setNama("")
    }
    setGalat(null)
  }, [kecamatanEdit, buka])

  async function handleSimpan(e: React.FormEvent) {
    e.preventDefault()
    setMemuat(true)
    setGalat(null)
    try {
      if (kecamatanEdit) {
        await perbaruiKecamatan(kecamatanEdit.id, { kode, nama })
      } else {
        await simpanKecamatan({ kode, nama })
      }
      onSukses()
      onBukaChange(false)
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyimpan kecamatan"
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
            <DialogTitle>{kecamatanEdit ? "Ubah Kecamatan" : "Tambah Kecamatan Baru"}</DialogTitle>
            <DialogDescription>
              {kecamatanEdit
                ? "Perbarui kode atau nama kecamatan administratif."
                : "Daftarkan kecamatan baru ke dalam basis data wilayah."}
            </DialogDescription>
          </DialogHeader>

          {galat && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {galat}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="kode-kecamatan">Kode Kecamatan</Label>
              <Input
                id="kode-kecamatan"
                placeholder="Contoh: KEC-01 atau 32.73.01"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                required
                disabled={memuat}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nama-kecamatan">Nama Kecamatan</Label>
              <Input
                id="nama-kecamatan"
                placeholder="Contoh: COBLONG"
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
              {memuat ? "Menyimpan…" : "Simpan Kecamatan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
