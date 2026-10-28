"use client"

// features/dashboard/components/pengguna/pengguna-dialog/pengguna-dialog.tsx
// — form tambah & ubah akun internal. File ini hanya cangkang dialog; isinya:
//
//   use-form-pengguna.ts   state form + logika Simpan (3 endpoint)
//   use-daftar-divisi.ts   data pilihan divisi
//   bagian-identitas.tsx   nama, email, username, sandi awal
//   bagian-akses.tsx       role, status, divisi
//   bagian-reset-sandi.tsx reset sandi (aksi terpisah, di luar <form>)
//   tata-letak-form.tsx    Bagian & Medan (jarak/label seragam)
import { Loader2 } from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { BagianAkses } from "./bagian-akses"
import { BagianIdentitas } from "./bagian-identitas"
import { BagianResetSandi } from "./bagian-reset-sandi"
import type { BarisPengguna } from "./tipe"
import { useDaftarDivisi } from "./use-daftar-divisi"
import { useFormPengguna } from "./use-form-pengguna"

const ID_FORM = "form-pengguna"

export function PenggunaDialog({
  pengguna,
  idSaya,
  roleSaya,
  onTutup,
  onTersimpan,
}: {
  /** null = mode TAMBAH; berisi baris = mode UBAH. */
  pengguna: BarisPengguna | null
  idSaya?: string | null
  roleSaya?: string | null
  onTutup: () => void
  onTersimpan: () => void
}) {
  const divisi = useDaftarDivisi()
  const form = useFormPengguna({ pengguna, idSaya, roleSaya, onTersimpan, onTutup })

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.ubah ? "Ubah pengguna" : "Tambah pengguna"}</DialogTitle>
          <DialogDescription>
            {form.ubah
              ? "Perubahan role dan status tercatat di log audit."
              : "Buat akun internal baru."}
          </DialogDescription>
        </DialogHeader>

        {/* -mx-1 px-1: ruang 4px di kiri-kanan supaya cincin fokus field (ring-3)
            tidak terpotong oleh overflow-y-auto. */}
        <div className="-mx-1 grid max-h-[60dvh] gap-5 overflow-y-auto px-1 py-1">
          <form id={ID_FORM} onSubmit={form.simpan} className="grid gap-5">
            <BagianIdentitas
              isi={form.isi}
              set={form.set}
              ubah={form.ubah}
              sandiTanpaUsername={form.sandiTanpaUsername}
            />
            <BagianAkses
              isi={form.isi}
              set={form.set}
              divisi={divisi}
              diriSendiri={form.diriSendiri}
            />
          </form>

          {form.bisaReset && pengguna && <BagianResetSandi penggunaId={pengguna.id} />}

          {form.galat && (
            <Alert variant="destructive">
              <AlertDescription>{form.galat}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={form.mengirim}>
            Batal
          </Button>
          <Button type="submit" form={ID_FORM} disabled={!form.bisaSimpan}>
            {form.mengirim && <Loader2 className="animate-spin" />}
            {form.ubah ? "Simpan perubahan" : "Buat akun"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
