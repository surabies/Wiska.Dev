"use client"

import { useState } from "react"

export interface FotoDraft {
  file: File
  url: string // object URL untuk pratinjau
}

export interface NilaiFormulir {
  pelapor: string
  kategori: string
  deskripsi: string
  kontak: string
  foto: FotoDraft[]
}

const AWAL: NilaiFormulir = {
  pelapor: "",
  kategori: "",
  deskripsi: "",
  kontak: "",
  foto: [],
}

export function useFormulirPengaduan() {
  const [nilai, setNilai] = useState<NilaiFormulir>(AWAL)

  const ubah = <K extends keyof NilaiFormulir>(kunci: K, v: NilaiFormulir[K]) =>
    setNilai((s) => ({ ...s, [kunci]: v }))

  const reset = () => {
    nilai.foto.forEach((f) => URL.revokeObjectURL(f.url))
    setNilai(AWAL)
  }

  return { nilai, ubah, reset }
}
