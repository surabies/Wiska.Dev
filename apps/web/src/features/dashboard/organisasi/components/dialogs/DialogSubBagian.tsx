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
import { simpanSubBagian, perbaruiSubBagian } from "../../api/ApiOrganisasi"
import type { BagianItem, SubBagianItem } from "../../types/TipeOrganisasi"

interface DialogSubBagianProps {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  subBagianEdit: SubBagianItem | null
  daftarBagian: BagianItem[]
  onSukses: () => void
}

export function DialogSubBagian({
  buka,
  onBukaChange,
  subBagianEdit,
  daftarBagian,
  onSukses,
}: DialogSubBagianProps) {
  const [kode, setKode] = useState("")
  const [nama, setNama] = useState("")
  const [bagianId, setBagianId] = useState("")
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (subBagianEdit) {
      setKode(subBagianEdit.kode)
      setNama(subBagianEdit.nama)
      setBagianId(subBagianEdit.bagianId)
    } else {
      setKode("")
      setNama("")
      setBagianId(daftarBagian[0]?.id ?? "")
    }
    setGalat(null)
  }, [subBagianEdit, daftarBagian, buka])

  async function handleSimpan(e: React.FormEvent) {
    e.preventDefault()
    if (!bagianId) {
      setGalat("Silakan pilih bagian induk")
      return
    }
    setMemuat(true)
    setGalat(null)
    try {
      if (subBagianEdit) {
        await perbaruiSubBagian(subBagianEdit.id, { kode, nama, bagianId })
      } else {
        await simpanSubBagian({ kode, nama, bagianId })
      }
      onSukses()
      onBukaChange(false)
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyimpan subbagian"
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
            <DialogTitle>{subBagianEdit ? "Ubah Subbagian" : "Tambah Subbagian Baru"}</DialogTitle>
            <DialogDescription>
              {subBagianEdit
                ? "Perbarui informasi subbagian pada unit kerja SOTK."
                : "Daftarkan subbagian baru dan tentukan bagian induknya."}
            </DialogDescription>
          </DialogHeader>

          {galat && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {galat}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="induk-bagian">Bagian Induk</Label>
              <Select value={bagianId} onValueChange={setBagianId} disabled={memuat}>
                <SelectTrigger id="induk-bagian">
                  <SelectValue placeholder="Pilih bagian" />
                </SelectTrigger>
                <SelectContent>
                  {daftarBagian.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      [{b.kode}] {b.nama} {b.divisi?.nama ? `(${b.divisi.nama})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kode-subbagian">Kode Subbagian</Label>
              <Input
                id="kode-subbagian"
                placeholder="Contoh: SUB-PW4-CATER"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                required
                disabled={memuat}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nama-subbagian">Nama Subbagian</Label>
              <Input
                id="nama-subbagian"
                placeholder="Contoh: PENCATATAN METER WILAYAH 4"
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
              {memuat ? "Menyimpan…" : "Simpan Subbagian"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
