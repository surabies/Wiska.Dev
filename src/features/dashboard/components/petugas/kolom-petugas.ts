// features/dashboard/components/petugas/kolom-petugas.ts — kolom DataGrid
// halaman Petugas. Tidak ada kolom `sortable`: urutan di server belum
// di-whitelist untuk endpoint /pencatat (lihat catatan di data-grid.tsx).
import type { ColDef, ValueFormatterParams } from "ag-grid-community"
import {
  fmtBool,
  fmtLabel,
  selBool,
  selStatus,
  KELAS_ANGKA,
  KELAS_MONO,
} from "../grids/sel"
import { PETA_LABEL_JENIS } from "./konstanta"
import type { Pencatat } from "./tipe"

const fmtTeks = (p: ValueFormatterParams) => (p.value ? String(p.value) : "—")

export const KOLOM_PETUGAS: ColDef<Pencatat>[] = [
  { field: "namaLapangan", headerName: "Nama Lapangan", minWidth: 150, flex: 2 },
  { field: "namaLengkap", headerName: "Nama Lengkap", minWidth: 160, flex: 2, valueFormatter: fmtTeks },
  { field: "nip", headerName: "NIP", minWidth: 130, cellClass: KELAS_MONO, valueFormatter: fmtTeks },
  {
    headerName: "Akun",
    minWidth: 150,
    valueGetter: (p) => (p.data?.user ? (p.data.user.name ?? p.data.user.email ?? "—") : "Belum tertaut"),
  },
  {
    headerName: "Rute",
    minWidth: 80,
    maxWidth: 100,
    cellClass: KELAS_ANGKA,
    // Hanya pencatat meter yang memegang rute; penyelia anomali dibaca "—".
    valueGetter: (p) => (p.data?.jenisTugas === "PENCATAT_METER" ? (p.data._count?.penugasanRute ?? 0) : null),
    valueFormatter: (p) => (typeof p.value === "number" ? String(p.value) : "—"),
  },
  {
    field: "isAktif",
    headerName: "Status",
    minWidth: 110,
    cellRenderer: selBool("Aktif", "Non-aktif", "hijau", "netral"),
    valueFormatter: fmtBool("Aktif", "Non-aktif"),
  },
  {
    field: "jenisTugas",
    headerName: "Jenis Tugas",
    minWidth: 160,
    cellRenderer: selStatus({
      PENCATAT_METER: { label: PETA_LABEL_JENIS.PENCATAT_METER, nada: "biru" },
      PENYELIA_ANOMALI: { label: PETA_LABEL_JENIS.PENYELIA_ANOMALI, nada: "amber" },
    }),
    valueFormatter: fmtLabel(PETA_LABEL_JENIS),
  },
]
