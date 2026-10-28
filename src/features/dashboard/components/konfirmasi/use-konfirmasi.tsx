"use client"

// Pemakaian:
//   const { minta, dialog } = useKonfirmasi()
//   minta({ judul, deskripsi, labelYa, nada: "bahaya", aksi: () => hapus(id) })
//   return (<>…{dialog}</>)   // pasang `dialog` sekali di komponen
import * as React from "react"
import { DialogKonfirmasi, type OpsiKonfirmasi } from "./dialog-konfirmasi"

export function useKonfirmasi() {
  const [opsi, setOpsi] = React.useState<OpsiKonfirmasi | null>(null)
  const minta = React.useCallback((o: OpsiKonfirmasi) => setOpsi(o), [])
  const tutup = React.useCallback(() => setOpsi(null), [])

  const dialog = opsi ? <DialogKonfirmasi opsi={opsi} onTutup={tutup} /> : null
  return { minta, dialog }
}
