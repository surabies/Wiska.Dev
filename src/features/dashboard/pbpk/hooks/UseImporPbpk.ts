"use client"

import * as React from "react"
import { ApiError } from "@/features/dashboard/api/ApiDashboard"
import { usePeriodeKerja } from "@/features/dashboard/hooks/UsePeriodeKerja"
import { kirimImporPbpk } from "../api/ApiImporPbpk"
import type { Hasil } from "../types/TipePbpk"

/// Bulan kalender dipakai hanya sebagai nilai awal sebelum periode kerja diketahui.
function periodeSekarang(): number {
  const d = new Date()
  return d.getFullYear() * 100 + (d.getMonth() + 1)
}

export function useImporPbpk() {
  const [berkas, setBerkas] = React.useState<File | null>(null)
  const [periode, setPeriode] = React.useState(String(periodeSekarang()))
  const { periodeKerja, siap: periodeSiap } = usePeriodeKerja()
  const [periodeKerjaTerpakai, setPeriodeKerjaTerpakai] = React.useState<
    number | null
  >(null)

  if (periodeKerja !== null && periodeKerja !== periodeKerjaTerpakai) {
    setPeriodeKerjaTerpakai(periodeKerja)
    setPeriode(String(periodeKerja))
  }

  const [sibuk, setSibuk] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [hasil, setHasil] = React.useState<Hasil | null>(null)
  const periodeValid =
    /^\d{6}$/.test(periode) &&
    Number(periode) % 100 >= 1 &&
    Number(periode) % 100 <= 12

  async function jalankan(terapkan: boolean) {
    if (!berkas || !periodeValid) return
    setSibuk(true)
    setGalat(null)
    try {
      const form = new FormData()
      form.append("berkas", berkas)
      form.append("periode", periode)
      setHasil(await kirimImporPbpk(form, terapkan))
    } catch (error) {
      setGalat(
        error instanceof ApiError
          ? error.message
          : "Gagal memproses berkas PBPK."
      )
    } finally {
      setSibuk(false)
    }
  }

  return {
    berkas,
    setBerkas,
    periode,
    setPeriode,
    periodeValid,
    periodeSiap,
    sibuk,
    galat,
    hasil,
    setHasil,
    jalankan,
  }
}
