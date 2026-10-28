"use client"

// Grid /dashboard/potensi — endpoint GET /api/v1/potensi (prospek pelanggan
// baru hasil survei lapangan).
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { selStatus, fmtLabel, fmtTanggal } from "./sel"
import { LABEL_STATUS_POTENSI } from "../../lib/label"

const KOLOM: ColDef[] = [
  { field: "alamat", headerName: "Alamat", minWidth: 240, flex: 2, sortable: true },
  {
    field: "status",
    headerName: "Status",
    minWidth: 150,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_STATUS_POTENSI),
    cellRenderer: selStatus({
      PROSPEK: { label: "Prospek", nada: "biru" },
      MENUNGGU_SURVEI: { label: "Menunggu survei", nada: "amber" },
      VALIDASI: { label: "Validasi", nada: "hijau" },
      DITOLAK: { label: "Ditolak", nada: "merah" },
    }),
  },
  { field: "catatan", headerName: "Catatan", minWidth: 180, flex: 2 },
  { field: "createdAt", headerName: "Dicatat", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
]

export function PotensiGrid() {
  return (
    <DataGrid
      judul="Potensi Pelanggan Baru"
      endpoint="/potensi"
      columnDefs={KOLOM}
      searchParam="q"
      searchPlaceholder="Cari alamat…"
      filters={[
        {
          param: "status",
          label: "Status",
          opsi: Object.entries(LABEL_STATUS_POTENSI).map(([value, label]) => ({ value, label })),
        },
      ]}
    />
  )
}
