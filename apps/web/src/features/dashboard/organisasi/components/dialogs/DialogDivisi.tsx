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
import { simpanDivisi, perbaruiDivisi } from "../../api/ApiOrganisasi"
import type { DivisiItem } from "../../types/TipeOrganisasi"

const PILIHAN_KODE_DIVISI = ["PELAYANAN", "TEHNIK", "UMUM", "UTAMA"] as const

interface DialogDivisiProps {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  divisiEdit: DivisiItem | null
  onSukses: () => void
}

export function DialogDivisi({
  buka,
  onBukaChange,
  divisiEdit,
  onSukses,
}: DialogDivisiProps) {
  const [kode, setKode] = useState("")
  const [nama, setNama] = useState("")
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (divisiEdit) {
      setKode(divisiEdit.kode)
      setNama(divisiEdit.nama)
    } else {
      setKode("PELAYANAN")
      setNama("")
    }
    setGalat(null)
  }, [divisiEdit, buka])

  async function handleSimpan(e: React.FormEvent) {
    e.preventDefault()
    setMemuat(true)
    setGalat(null)
    try {
      if (divisiEdit) {
        await perbaruiDivisi(divisiEdit.id, { kode, nama })
      } else {
        await simpanDivisi({ kode, nama })
      }
      onSukses()
      onBukaChange(false)
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyimpan divisi"
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
            <DialogTitle>{divisiEdit ? "Ubah Divisi" : "Tambah Divisi Baru"}</DialogTitle>
            <DialogDescription>
              {divisiEdit
                ? "Perbarui nama atau identitas divisi SOTK Perumda Tirtawening."
                : "Daftarkan divisi baru dalam struktur organisasi."}
            </DialogDescription>
          </DialogHeader>

          {galat && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {galat}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="kode-divisi">Kode Divisi</Label>
              <Select value={kode} onValueChange={setKode} disabled={memuat}>
                <SelectTrigger id="kode-divisi">
                  <SelectValue placeholder="Pilih kode divisi" />
                </SelectTrigger>
                <SelectContent>
                  {PILIHAN_KODE_DIVISI.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nama-divisi">Nama Divisi</Label>
              <Input
                id="nama-divisi"
                placeholder="Contoh: DIREKTORAT PELAYANAN"
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
            <Button type="submit" disabled={memuat || !nama.trim()}>
              {memuat ? "Menyimpan…" : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
