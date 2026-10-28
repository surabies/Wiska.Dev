"use client"

// features/dashboard/components/petugas/use-daftar-petugas.ts — data di luar
// grid untuk halaman Petugas: jumlah per jenis (kartu ringkasan) dan aksi
// ubah jenis. Grid memuat barisnya sendiri; `versi` dipakai sebagai
// `refreshKey` grid supaya ia muat ulang setelah ada perubahan.
import * as React from "react"
import { ambilList, kirimJson, ApiError } from "../../lib/api-client"
import type { JenisTugas, JumlahPerJenis, Pencatat } from "./tipe"

export function useDaftarPetugas() {
  const [semua, setSemua] = React.useState<Pencatat[] | null>(null)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [versi, setVersi] = React.useState(0)

  // Setiap setState terjadi di callback asinkron, bukan di badan effect
  // (react-hooks/set-state-in-effect). `batal` mencegah setState setelah lepas.
  React.useEffect(() => {
    let batal = false
    ambilList<Pencatat>("/pencatat", { pageSize: 200 })
      .then(({ rows }) => {
        if (batal) return
        setSemua(rows)
        setGalat(null)
      })
      .catch((e) => {
        if (!batal) setGalat(e instanceof ApiError ? e.message : "Gagal memuat ringkasan petugas.")
      })
    return () => {
      batal = true
    }
  }, [versi])

  const jumlah = React.useMemo<JumlahPerJenis | null>(() => {
    if (semua === null) return null
    const hasil: JumlahPerJenis = { PENCATAT_METER: 0, PENYELIA_ANOMALI: 0 }
    for (const p of semua) hasil[p.jenisTugas]++
    return hasil
  }, [semua])

  /** Melempar galat bila server menolak — dialog pemanggil yang menampilkannya. */
  const ubahJenis = React.useCallback(async (id: string, jenis: JenisTugas) => {
    await kirimJson(`/pencatat/${id}`, "PATCH", { jenisTugas: jenis })
    setVersi((v) => v + 1)
  }, [])

  return { jumlah, galat, versi, ubahJenis }
}
