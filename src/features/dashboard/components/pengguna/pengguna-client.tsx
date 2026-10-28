"use client"

// features/dashboard/components/pengguna/pengguna-client.tsx — halaman
// Pengguna & akses: grid + dialog tambah/ubah.
//
// KLIK BARIS = UBAH. Tidak ada kolom tombol di ujung kanan: barisnya sendiri
// yang jadi sasaran, sehingga tidak perlu digulir mendatar dulu pada tabel
// selebar ini. Server menyediakan seluruh operasinya (POST /users,
// PATCH /users/:id, dan endpoint terpisah untuk role, status, serta
// password); logikanya ada di ./pengguna-dialog.
import * as React from "react"
import { PenggunaGrid } from "../grids/pengguna-grid"
import { PenggunaDialog, type BarisPengguna } from "./pengguna-dialog"

/// Keadaan dialog sebagai satu nilai, bukan tiga bentuk campuran.
type KeadaanDialog =
  | { mode: "tutup" }
  | { mode: "tambah" }
  | { mode: "ubah"; baris: BarisPengguna }

export function PenggunaClient({
  idSaya,
  roleSaya,
}: {
  idSaya?: string | null
  roleSaya?: string | null
}) {
  const [dialog, setDialog] = React.useState<KeadaanDialog>({ mode: "tutup" })
  /// Dinaikkan setelah simpan supaya grid menarik ulang datanya.
  const [refreshKey, setRefreshKey] = React.useState(0)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PenggunaGrid
        refreshKey={refreshKey}
        onRowClicked={(baris) => setDialog({ mode: "ubah", baris: baris as unknown as BarisPengguna })}
        onTambahPengguna={() => setDialog({ mode: "tambah" })}
      />

      {dialog.mode !== "tutup" && (
        <PenggunaDialog
          // key: baris lain / mode lain = form baru dengan state bersih.
          key={dialog.mode === "ubah" ? dialog.baris.id : "tambah"}
          pengguna={dialog.mode === "ubah" ? dialog.baris : null}
          idSaya={idSaya}
          roleSaya={roleSaya}
          onTutup={() => setDialog({ mode: "tutup" })}
          onTersimpan={() => setRefreshKey((n) => n + 1)}
        />
      )}
    </div>
  )
}
