"use client"

// features/dashboard/lib/periode-kerja.ts — SATU tempat yang menjawab
// "periode mana yang sedang dikerjakan".
//
// KENAPA TERPUSAT. Sebelum ini tiap layar menurunkannya sendiri: verifikasi
// memakai periode terbaru yang punya laporan, PBPK memakai bulan kalender,
// pemetaan memakai campuran keduanya. Akibatnya bukan teori — PBPK Januari
// pernah mendarat di periode 202607 karena layarnya memakai kalender,
// sementara seluruh layar lain menunjuk 202601. Sambungannya lahir, tidak
// muncul di mana pun, dan tidak ikut closing.
//
// Sekarang semuanya membaca GET /closing/periode-kerja, yang menurunkannya
// dari data yang memang sudah ada: periode terbaru yang punya daftar catat
// dan belum TERKUNCI.

import * as React from "react"
import { ambilSatu } from "./api-client"

export interface BarisPeriodeKerja {
  periode: number
  terkunci: boolean
}

export interface PeriodeKerja {
  /// null = tidak ada periode terbuka; siklus menunggu "buka bulan baru".
  periodeKerja: number | null
  periode: BarisPeriodeKerja[]
  saran: string | null
}

/// Memuat periode kerja sekali saat komponen dipasang.
///
/// `siap` sengaja dipisah dari `periodeKerja`: layar yang menulis data
/// (impor PBPK, pencatatan awal) TIDAK BOLEH bertindak sebelum periodenya
/// pasti — menebak dengan bulan kalender adalah persis kesalahan yang
/// membuat berkas mendarat di periode yang salah.
export function usePeriodeKerja(): {
  periodeKerja: number | null
  daftar: BarisPeriodeKerja[]
  saran: string | null
  siap: boolean
} {
  const [data, setData] = React.useState<PeriodeKerja | null>(null)

  React.useEffect(() => {
    let batal = false
    ambilSatu<PeriodeKerja>("/closing/periode-kerja", {})
      .then((d) => { if (!batal) setData(d) })
      .catch(() => {
        // Gagal memuat: `siap` tetap false, dan layar menahan aksi tulisnya
        // alih-alih menebak periode.
      })
    return () => { batal = true }
  }, [])

  return {
    periodeKerja: data?.periodeKerja ?? null,
    daftar: data?.periode ?? [],
    saran: data?.saran ?? null,
    siap: data !== null,
  }
}
