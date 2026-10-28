// features/dashboard/components/pemetaan-rute/kolom-petugas-rute.ts — kolom
// DataGrid daftar petugas (panel kiri) di halaman Pemetaan Rute. Sengaja
// ringkas: panelnya sempit dan fungsinya hanya memilih petugas.
import type { ColDef } from "ag-grid-community"
import { fmtLabel, selStatus, KELAS_ANGKA, type Nada } from "../grids/sel"
import { namaTampil, type PencatatBaris } from "./model"

const STATUS_AKUN: Record<string, { label: string; nada: Nada }> = {
  AKTIF: { label: "Akun aktif", nada: "hijau" },
  TANPA_AKUN: { label: "Belum ada akun", nada: "netral" },
  NONAKTIF: { label: "Non-aktif", nada: "merah" },
}

const LABEL_STATUS_AKUN = Object.fromEntries(Object.entries(STATUS_AKUN).map(([k, v]) => [k, v.label]))

export const KOLOM_PETUGAS_RUTE: ColDef<PencatatBaris>[] = [
  {
    headerName: "Petugas",
    minWidth: 150,
    flex: 2,
    valueGetter: (p) => (p.data ? namaTampil(p.data) : ""),
  },
  {
    headerName: "Akun",
    minWidth: 120,
    valueGetter: (p) => (!p.data ? null : !p.data.isAktif ? "NONAKTIF" : p.data.user ? "AKTIF" : "TANPA_AKUN"),
    cellRenderer: selStatus(STATUS_AKUN),
    valueFormatter: fmtLabel(LABEL_STATUS_AKUN),
  },
  {
    headerName: "Rute",
    minWidth: 70,
    maxWidth: 90,
    cellClass: KELAS_ANGKA,
    valueGetter: (p) => p.data?._count?.penugasanRute ?? 0,
    valueFormatter: (p) => (typeof p.value === "number" ? String(p.value) : ""),
  },
]
