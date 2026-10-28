// features/dashboard/components/petugas/konstanta.tsx — keterangan tiap jenis
// tugas. Satu sumber untuk kartu ringkasan, dialog, kolom grid, dan penyaring.
import type * as React from "react"
import { BadgeCheck, Clock3 } from "@/components/ui/hugeicons-compat"
import type { JenisTugas } from "./tipe"

export interface InfoJenis {
  nilai: JenisTugas
  label: string
  ikon: React.ComponentType<{ className?: string }>
  jelas: string
}

export const JENIS: InfoJenis[] = [
  {
    nilai: "PENCATAT_METER",
    label: "Pencatat meter",
    ikon: BadgeCheck,
    jelas: "Membaca meter pada rute yang ditugaskan. Datanya dibatasi rutenya.",
  },
  {
    nilai: "PENYELIA_ANOMALI",
    label: "Penyelia anomali",
    ikon: Clock3,
    jelas:
      "Mendatangi sambungan yang meternya berbulan-bulan tidak terbaca. Menerima daftar SELURUH wilayah, bukan satu rute, dan memilih sendiri mana yang didatangi.",
  },
]

export const PETA_LABEL_JENIS: Record<string, string> = Object.fromEntries(
  JENIS.map((j) => [j.nilai, j.label]),
)

/** Akibat memilih jenis ini — ditampilkan di dialog sebelum disimpan. */
export const AKIBAT_JENIS: Record<JenisTugas, string> = {
  PENCATAT_METER:
    "Setelah disimpan, data yang diterima petugas ini dibatasi pada rute yang ditugaskan kepadanya.",
  PENYELIA_ANOMALI:
    "Setelah disimpan, petugas ini menerima daftar seluruh wilayah, bukan lagi hanya rutenya.",
}
