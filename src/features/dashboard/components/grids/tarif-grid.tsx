"use client"

// Grid /dashboard/tarif — endpoint GET /api/v1/tarif (TarifGolongan; blok
// tarif progresif per golongan diakses lewat /tarif/:id/blok).
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { selBool, fmtBool, KELAS_MONO } from "./sel"

const KOLOM: ColDef[] = [
  { field: "kodeAsli", headerName: "Kode", minWidth: 90, maxWidth: 110, cellClass: KELAS_MONO, sortable: true },
  { field: "kode", headerName: "Kode Sistem", minWidth: 120, sortable: true, cellClass: KELAS_MONO, valueFormatter: (p) => (p.value ? String(p.value).replace("GOL_", "") : "") },
  { field: "nama", headerName: "Nama Golongan", minWidth: 200, flex: 2, sortable: true },
  { field: "kategori", headerName: "Kategori", minWidth: 150, sortable: true },
  { field: "isActive", headerName: "Status", minWidth: 110, maxWidth: 130, sortable: true, cellRenderer: selBool("Aktif", "Non-aktif"), valueFormatter: fmtBool("Aktif", "Non-aktif") },
]

export function TarifGrid() {
  return (
    <DataGrid
      judul="Golongan Tarif"
      endpoint="/tarif"
      columnDefs={KOLOM}
      searchParam="q"
      searchPlaceholder="Cari golongan…"
    />
  )
}
