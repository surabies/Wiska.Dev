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
import { simpanTarifBlok } from "../../api/ApiTarif"
import type { TarifGolonganItem } from "../../types/TipeTarif"

interface DialogTetapkanBlokProps {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  tarifGolongan: TarifGolonganItem | null
  onSukses: () => void
}

export function DialogTetapkanBlok({
  buka,
  onBukaChange,
  tarifGolongan,
  onSukses,
}: DialogTetapkanBlokProps) {
  const [blok, setBlok] = useState(1)
  const [batasAwalM3, setBatasAwalM3] = useState(0)
  const [batasAkhirM3, setBatasAkhirM3] = useState<number | "">("")
  const [hargaPerM3, setHargaPerM3] = useState(3000)
  const [berlakuMulai, setBerlakuMulai] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (tarifGolongan) {
      const existing = tarifGolongan.blokTarif ?? []
      const nextBlok = existing.length + 1
      setBlok(nextBlok)

      if (existing.length > 0) {
        const last = existing[existing.length - 1]
        const nextAwal = (last.batasAkhirM3 ?? last.batasAwalM3) + 1
        setBatasAwalM3(nextAwal)
        setBatasAkhirM3("")
        setHargaPerM3(last.hargaPerM3 + 1500)
      } else {
        setBatasAwalM3(0)
        setBatasAkhirM3(10)
        setHargaPerM3(3000)
      }
    }
    setGalat(null)
  }, [tarifGolongan, buka])

  async function handleSimpan(e: React.FormEvent) {
    e.preventDefault()
    if (!tarifGolongan) return

    if (batasAkhirM3 !== "" && Number(batasAkhirM3) < Number(batasAwalM3)) {
      setGalat("Batas akhir kubikasi (m³) harus lebih besar atau sama dengan batas awal.")
      return
    }

    setMemuat(true)
    setGalat(null)
    try {
      await simpanTarifBlok(tarifGolongan.id, {
        blok: Number(blok),
        batasAwalM3: Number(batasAwalM3),
        batasAkhirM3: batasAkhirM3 === "" ? null : Number(batasAkhirM3),
        hargaPerM3: Number(hargaPerM3),
        berlakuMulai: new Date(berlakuMulai).toISOString(),
      })
      onSukses()
      onBukaChange(false)
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menetapkan tarif blok"
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
            <DialogTitle>Tetapkan Harga Air (Blok Progresif)</DialogTitle>
            <DialogDescription>
              {tarifGolongan
                ? `Golongan: [${tarifGolongan.kodeAsli}] ${tarifGolongan.nama}`
                : "Tetapkan nominal tarif air per m³ sesuai SK Direksi."}
            </DialogDescription>
          </DialogHeader>

          {galat && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {galat}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="blok-ke">Urutan Blok</Label>
                <Input
                  id="blok-ke"
                  type="number"
                  min={1}
                  max={10}
                  value={blok}
                  onChange={(e) => setBlok(Number(e.target.value))}
                  required
                  disabled={memuat}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="harga-m3">Tarif (Rp / m³)</Label>
                <Input
                  id="harga-m3"
                  type="number"
                  min={0}
                  step={50}
                  value={hargaPerM3}
                  onChange={(e) => setHargaPerM3(Number(e.target.value))}
                  required
                  disabled={memuat}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="batas-awal">Batas Awal (m³)</Label>
                <Input
                  id="batas-awal"
                  type="number"
                  min={0}
                  value={batasAwalM3}
                  onChange={(e) => setBatasAwalM3(Number(e.target.value))}
                  required
                  disabled={memuat}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="batas-akhir">Batas Akhir (m³)</Label>
                <Input
                  id="batas-akhir"
                  type="number"
                  min={0}
                  placeholder="Kosongkan jika tak terhingga"
                  value={batasAkhirM3}
                  onChange={(e) =>
                    setBatasAkhirM3(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  disabled={memuat}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="berlaku-mulai">Tanggal Mulai Berlaku SK</Label>
              <Input
                id="berlaku-mulai"
                type="date"
                value={berlakuMulai}
                onChange={(e) => setBerlakuMulai(e.target.value)}
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
            <Button type="submit" disabled={memuat || !hargaPerM3}>
              {memuat ? "Menyimpan…" : "Simpan Harga Blok"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
