import * as React from "react"
import type { BarisFilterLanjutan, FilterLanjutanField } from "./tipe"

/** State + aksi panel "Filters" (filter lanjutan berbaris: where/and). */
export function useFilterLanjutan(fields: FilterLanjutanField[]) {
  const [terbuka, setTerbuka] = React.useState(false)
  const [baris, setBaris] = React.useState<BarisFilterLanjutan[]>([])
  const nomor = React.useRef(0)

  /** Param query dari baris yang sudah berisi nilai. */
  const serialParams = JSON.stringify(
    baris.reduce<Record<string, string>>((hasil, row) => {
      const field = fields.find((item) => item.id === row.fieldId)
      const value = row.value.trim()
      if (!field || !value) return hasil
      hasil[field.param] = value
      if (field.operatorParam) hasil[field.operatorParam] = row.operator
      return hasil
    }, {})
  )
  // Identitas objek hanya berubah bila ISINYA berubah — `fields` yang dikirim
  // parent sebagai literal inline berganti identitas tiap render, dan params
  // ini dipakai sebagai dependency effect pemuat data.
  const params = React.useMemo(
    () => JSON.parse(serialParams) as Record<string, string>,
    [serialParams]
  )

  const jumlahAktif = baris.filter((row) => {
    const field = fields.find((item) => item.id === row.fieldId)
    return Boolean(field && row.value.trim())
  }).length
  const penuh = baris.length >= fields.length

  function tambah() {
    const dipakai = new Set(baris.map((row) => row.fieldId))
    const field = fields.find((item) => !dipakai.has(item.id))
    if (!field) return
    nomor.current += 1
    setBaris((lama) => [
      ...lama,
      { id: nomor.current, fieldId: field.id, operator: "equals", value: "" },
    ])
    setTerbuka(true)
  }

  function toggle() {
    if (terbuka) {
      setTerbuka(false)
      return
    }
    if (baris.length === 0) tambah()
    setTerbuka(true)
  }

  function ubah(
    id: number,
    perubahan: Partial<Omit<BarisFilterLanjutan, "id">>
  ) {
    setBaris((lama) =>
      lama.map((row) => (row.id === id ? { ...row, ...perubahan } : row))
    )
  }

  function hapus(id: number) {
    const tersisa = baris.filter((row) => row.id !== id)
    if (tersisa.length === baris.length) return
    setBaris(tersisa)
    if (tersisa.length === 0) setTerbuka(false)
  }

  function bersihkan() {
    setBaris([])
    setTerbuka(false)
  }

  return {
    terbuka,
    baris,
    params,
    jumlahAktif,
    penuh,
    tambah,
    toggle,
    ubah,
    hapus,
    bersihkan,
  }
}
