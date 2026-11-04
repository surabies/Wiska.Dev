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
import { simpanBagian, perbaruiBagian } from "../../api/ApiOrganisasi"
import type { BagianItem, DivisiItem } from "../../types/TipeOrganisasi"

interface DialogBagianProps {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  bagianEdit: BagianItem | null
  daftarDivisi: DivisiItem[]
  onSukses: () => void
}

export function DialogBagian({
  buka,
  onBukaChange,
  bagianEdit,
  daftarDivisi,
  onSukses,
}: DialogBagianProps) {
  const [kode, setKode] = useState("")
  const [nama, setNama] = useState("")
  const [divisiId, setDivisiId] = useState("")
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (bagianEdit) {
      setKode(bagianEdit.kode)
      setNama(bagianEdit.nama)
      setDivisiId(bagianEdit.divisiId)
    } else {
      setKode("")
      setNama("")
      setDivisiId(daftarDivisi[0]?.id ?? "")
    }
    setGalat(null)
  }, [bagianEdit, daftarDivisi, buka])

  async function handleSimpan(e: React.FormEvent) {
    e.preventDefault()
    if (!divisiId) {
      setGalat("Silakan pilih divisi induk")
      return
    }
    setMemuat(true)
    setGalat(null)
    try {
      if (bagianEdit) {
        await perbaruiBagian(bagianEdit.id, { kode, nama, divisiId })
      } else {
        await simpanBagian({ kode, nama, divisiId })
      }
      onSukses()
      onBukaChange(false)
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyimpan bagian"
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
            <DialogTitle>{bagianEdit ? "Ubah Bagian / Unit" : "Tambah Bagian Baru"}</DialogTitle>
            <DialogDescription>
              {bagianEdit
                ? "Perbarui informasi bagian / unit kerja pada struktur organisasi."
                : "Daftarkan bagian baru dan tentukan divisi induknya."}
            </DialogDescription>
          </DialogHeader>

          {galat && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {galat}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="induk-divisi">Divisi Induk</Label>
              <Select value={divisiId} onValueChange={setDivisiId} disabled={memuat}>
                <SelectTrigger id="induk-divisi">
                  <SelectValue placeholder="Pilih divisi" />
                </SelectTrigger>
                <SelectContent>
                  {daftarDivisi.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      [{d.kode}] {d.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kode-bagian">Kode Bagian</Label>
              <Input
                id="kode-bagian"
                placeholder="Contoh: BAGIAN-PW4"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                required
                disabled={memuat}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nama-bagian">Nama Bagian</Label>
              <Input
                id="nama-bagian"
                placeholder="Contoh: PELAYANAN WILAYAH 4"
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
              {memuat ? "Menyimpan…" : "Simpan Bagian"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
