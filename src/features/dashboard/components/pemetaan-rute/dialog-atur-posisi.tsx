"use client"

import * as React from "react"
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

export function DialogAturPosisi({
  jenis,
  namaItem,
  posisiSaatIni,
  jumlah,
  onTutup,
  onTerapkan,
}: {
  jenis: "rute" | "pelanggan"
  namaItem: string
  posisiSaatIni: number
  jumlah: number
  onTutup: () => void
  onTerapkan: (posisi: number) => void
}) {
  const [nilai, setNilai] = React.useState(String(posisiSaatIni))
  const [galat, setGalat] = React.useState<string | null>(null)
  const posisiBaru = Number(nilai)
  const valid = Number.isInteger(posisiBaru) && posisiBaru >= 1 && posisiBaru <= jumlah

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!valid) {
      setGalat(`Masukkan urutan antara 1 dan ${jumlah.toLocaleString("id-ID")}.`)
      return
    }
    onTerapkan(posisiBaru)
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Atur posisi {jenis}</DialogTitle>
            <DialogDescription>
              Tentukan urutan untuk <strong className="text-foreground">{namaItem}</strong>.
              Item lain akan bergeser otomatis.
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 grid gap-2">
            <label htmlFor="posisi-baru" className="text-sm font-medium">
              Pindahkan ke urutan
            </label>
            <Input
              id="posisi-baru"
              type="number"
              inputMode="numeric"
              min={1}
              max={jumlah}
              step={1}
              autoFocus
              value={nilai}
              onChange={(e) => {
                setNilai(e.target.value)
                setGalat(null)
              }}
              aria-invalid={Boolean(galat) || (nilai !== "" && !valid)}
              aria-describedby="posisi-pratinjau"
            />
            {galat && <p role="alert" className="text-sm text-destructive">{galat}</p>}
            {nilai !== "" && valid && (
              <p id="posisi-pratinjau" className="text-sm text-muted-foreground">
                Posisi {posisiSaatIni} <span aria-hidden>→</span> {posisiBaru}
                {posisiSaatIni === posisiBaru && " · tidak ada perubahan"}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Pilih angka 1–{jumlah.toLocaleString("id-ID")}.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onTutup}>
              Batal
            </Button>
            <Button type="submit" disabled={!valid || posisiBaru === posisiSaatIni}>
              Terapkan posisi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
