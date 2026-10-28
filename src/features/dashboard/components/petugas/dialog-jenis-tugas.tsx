"use client"

// features/dashboard/components/petugas/dialog-jenis-tugas.tsx — ubah jenis
// tugas SATU petugas. Sekaligus menjadi konfirmasinya: jenis yang dipilih
// beserta akibatnya ditampilkan lebih dulu, dan baru tersimpan setelah
// tombol Simpan ditekan (tidak lagi tersimpan begitu tombol segmen diklik).
import * as React from "react"
import { Loader2 } from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ApiError } from "../../lib/api-client"
import { AKIBAT_JENIS, JENIS } from "./konstanta"
import type { JenisTugas, Pencatat } from "./tipe"

export function DialogJenisTugas({
  petugas,
  onSimpan,
  onTutup,
}: {
  petugas: Pencatat
  /** Melempar galat bila server menolak. */
  onSimpan: (jenis: JenisTugas) => Promise<void>
  onTutup: () => void
}) {
  const [pilihan, setPilihan] = React.useState<JenisTugas>(petugas.jenisTugas)
  const [menyimpan, setMenyimpan] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const berubah = pilihan !== petugas.jenisTugas

  async function simpan() {
    if (!berubah || menyimpan) return
    setMenyimpan(true)
    setGalat(null)
    try {
      await onSimpan(pilihan)
      onTutup()
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal menyimpan perubahan.")
      setMenyimpan(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(buka) => {
        if (!buka && !menyimpan) onTutup()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Jenis tugas · {petugas.namaLapangan}</DialogTitle>
          <DialogDescription>
            {petugas.namaLengkap ?? "—"}
            {petugas.nip ? ` · NIP ${petugas.nip}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Jenis tugas" className="space-y-2">
          {JENIS.map((j) => {
            const Ikon = j.ikon
            const aktif = pilihan === j.nilai
            return (
              <button
                key={j.nilai}
                type="button"
                role="radio"
                aria-checked={aktif}
                disabled={menyimpan}
                onClick={() => setPilihan(j.nilai)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                  aktif ? "border-foreground bg-muted" : "hover:bg-muted/50",
                )}
              >
                <Ikon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{j.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{j.jelas}</span>
                </span>
              </button>
            )
          })}
        </div>

        {berubah && (
          <Alert>
            <AlertDescription>{AKIBAT_JENIS[pilihan]}</AlertDescription>
          </Alert>
        )}
        {galat && (
          <Alert variant="destructive">
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={menyimpan}>
            Batal
          </Button>
          <Button onClick={() => void simpan()} disabled={!berubah || menyimpan}>
            {menyimpan && <Loader2 className="size-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
