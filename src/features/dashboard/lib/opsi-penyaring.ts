"use client"

// features/dashboard/lib/opsi-penyaring.ts — isi dropdown penyaring yang
// harus DIAMBIL dari data, bukan dikarang di komponen.
//
// KENAPA TERPUSAT. Dua layar (laporan harian & laporan mandiri) butuh daftar
// periode yang benar-benar punya baris, dan tiga layar butuh daftar pencatat.
// Sebelum ini tiap komponen menyalin effect yang sama, dan salinan berarti
// suatu saat salah satunya memakai pageSize berbeda atau lupa menangani
// gagal-muat.
//
// SIKAP SAAT GAGAL: dropdown-nya kosong, tabelnya tetap jalan. Daftar opsi
// adalah kenyamanan; kehilangan koneksi ke /pencatat tidak boleh membuat
// halaman laporan ikut mati.

import * as React from "react"
import { ambilList, ambilSatu } from "./api-client"

/// Periode yang PUNYA DATA di tabel bersangkutan, dari endpoint /stats-nya
/// (mis. "/laporan-harian/stats"). Sengaja bukan usePeriodeKerja(): yang
/// ditanyakan di penyaring bukan "bulan mana yang sedang dikerjakan" tapi
/// "bulan mana yang ada isinya" — menawarkan bulan kosong hanya menghasilkan
/// tabel kosong yang terlihat seperti kerusakan.
export function usePeriodeBerdata(endpointStats: string): number[] {
  const [periodes, setPeriodes] = React.useState<number[]>([])

  React.useEffect(() => {
    let batal = false
    ambilSatu<{ periodes?: number[] }>(endpointStats)
      .then((s) => {
        if (!batal) setPeriodes(s.periodes ?? [])
      })
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [endpointStats])

  return periodes
}

/// Daftar petugas pencatat untuk penyaring "Petugas". pageSize 500 = seluruh
/// petugas dalam sekali ambil; jumlahnya puluhan, bukan ribuan.
export function usePencatats(): { id: string; namaLapangan: string }[] {
  const [pencatats, setPencatats] = React.useState<{ id: string; namaLapangan: string }[]>([])

  React.useEffect(() => {
    let batal = false
    ambilList<{ id: string; namaLapangan: string }>("/pencatat", { pageSize: 500 })
      .then(({ rows }) => {
        if (!batal) setPencatats(rows)
      })
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [])

  return pencatats
}
