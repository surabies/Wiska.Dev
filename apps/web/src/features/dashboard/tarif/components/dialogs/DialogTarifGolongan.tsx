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
import { Switch } from "@/components/ui/switch"
import { simpanTarifGolongan, perbaruiTarifGolongan } from "../../api/ApiTarif"
import type { TarifGolonganItem } from "../../types/TipeTarif"

interface DialogTarifGolonganProps {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  tarifEdit: TarifGolonganItem | null
  onSukses: () => void
}

export function DialogTarifGolongan({
  buka,
  onBukaChange,
  tarifEdit,
  onSukses,
}: DialogTarifGolonganProps) {
  const [kodeAsli, setKodeAsli] = useState("")
  const [nama, setNama] = useState("")
  const [kategori, setKategori] = useState("RUMAH_TANGGA")
  const [isActive, setIsActive] = useState(true)
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (tarifEdit) {
      setKodeAsli(tarifEdit.kodeAsli)
      setNama(tarifEdit.nama)
      setKategori(tarifEdit.kategori)
      setIsActive(tarifEdit.isActive)
    } else {
      setKodeAsli("")
      setNama("")
      setKategori("RUMAH_TANGGA")
      setIsActive(true)
    }
    setGalat(null)
  }, [tarifEdit, buka])

  async function handleSimpan(e: React.FormEvent) {
    e.preventDefault()
    setMemuat(true)
    setGalat(null)
    try {
      if (tarifEdit) {
        await perbaruiTarifGolongan(tarifEdit.id, {
          nama,
          kategori,
          isActive,
        })
      } else {
        // Otomatis generate kode sistem dari kodeAsli jika diperlukan
        const kodeClean = kodeAsli.toUpperCase().replace(/[^A-Z0-9_]/g, "_")
        const kodeSistem = `GOL_${kodeClean}`
        await simpanTarifGolongan({
          kode: kodeSistem as any,
          kodeAsli: kodeAsli.toUpperCase(),
          nama,
          kategori,
          isActive,
        })
      }
      onSukses()
      onBukaChange(false)
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyimpan golongan tarif"
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
            <DialogTitle>
              {tarifEdit ? "Ubah Golongan Pelanggan" : "Tambah Golongan Tarif Baru"}
            </DialogTitle>
            <DialogDescription>
              {tarifEdit
                ? "Perbarui nama klasifikasi dan kategori golongan pelanggan."
                : "Daftarkan golongan tarif pelanggan baru."}
            </DialogDescription>
          </DialogHeader>

          {galat && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {galat}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="kode-asli">Kode Golongan (Tarif)</Label>
              <Input
                id="kode-asli"
                placeholder="Contoh: 2A1, 3A, GOL_R1"
                value={kodeAsli}
                onChange={(e) => setKodeAsli(e.target.value.toUpperCase())}
                required
                disabled={memuat || !!tarifEdit}
              />
              {tarifEdit && (
                <span className="text-[10px] text-muted-foreground">
                  Kode golongan permanen dan tidak dapat diubah setelah terbit.
                </span>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nama-golongan">Nama Golongan</Label>
              <Input
                id="nama-golongan"
                placeholder="Contoh: Rumah Tangga Menengah (2A1)"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                required
                disabled={memuat}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kategori-tarif">Kategori Layanan</Label>
              <Input
                id="kategori-tarif"
                placeholder="Contoh: RUMAH_TANGGA, NIAGA, INDUSTRI, SOSIAL"
                value={kategori}
                onChange={(e) => setKategori(e.target.value.toUpperCase())}
                required
                disabled={memuat}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="is-active" className="text-sm font-medium">
                  Status Golongan
                </Label>
                <p className="text-xs text-muted-foreground">
                  Golongan aktif dapat digunakan untuk penagihan pelanggan baru.
                </p>
              </div>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
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
            <Button type="submit" disabled={memuat || !nama.trim() || !kodeAsli.trim()}>
              {memuat ? "Menyimpan…" : "Simpan Golongan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
