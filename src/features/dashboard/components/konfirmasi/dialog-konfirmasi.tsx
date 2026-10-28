"use client"

// Dialog konfirmasi untuk aksi yang mengubah data (hapus, lepas, buang
// perubahan). Aksinya dijalankan DI DALAM dialog, bukan oleh pemanggil, supaya
// tiga hal ini selalu berlaku di semua halaman:
//   1. tombol terkunci selama permintaan berjalan (tidak bisa dobel-klik),
//   2. dialog tidak bisa ditutup (Esc / klik luar) selama permintaan berjalan,
//   3. bila server menolak, pesannya tampil di dialog dan dialog tetap terbuka.
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
import { ApiError } from "../../lib/api-client"

export interface OpsiKonfirmasi {
  judul: string
  deskripsi: React.ReactNode
  labelYa: string
  /** "bahaya" = tombol merah, untuk aksi yang tidak bisa dibatalkan. */
  nada?: "biasa" | "bahaya"
  /** Dijalankan saat tombol konfirmasi diklik. Melempar galat = dialog tetap
   *  terbuka dan menampilkan pesannya. */
  aksi: () => Promise<void>
}

export function DialogKonfirmasi({
  opsi,
  onTutup,
}: {
  opsi: OpsiKonfirmasi
  onTutup: () => void
}) {
  const [memproses, setMemproses] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)

  async function jalankan() {
    if (memproses) return
    setMemproses(true)
    setGalat(null)
    try {
      await opsi.aksi()
      onTutup()
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Aksi gagal. Coba lagi.")
      setMemproses(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(buka) => {
        if (!buka && !memproses) onTutup()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{opsi.judul}</DialogTitle>
          <DialogDescription>{opsi.deskripsi}</DialogDescription>
        </DialogHeader>

        {galat && (
          <Alert variant="destructive">
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {/* Batal lebih dulu di DOM → ia yang mendapat fokus awal, jadi Enter
              yang tidak sengaja tidak langsung menghapus. */}
          <Button variant="outline" onClick={onTutup} disabled={memproses}>
            Batal
          </Button>
          <Button
            variant={opsi.nada === "bahaya" ? "destructive" : "default"}
            onClick={() => void jalankan()}
            disabled={memproses}
          >
            {memproses && <Loader2 className="size-4 animate-spin" />}
            {opsi.labelYa}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
