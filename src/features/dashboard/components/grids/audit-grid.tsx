"use client"

// Grid /dashboard/audit-log — endpoint GET /api/v1/audit-log (read-only,
// MANAGEMENT_UP). Baris ditulis internal lewat recordAudit(); tidak ada
// aksi tulis dari halaman ini.
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { fmtTanggal, KELAS_MONO } from "./sel"

const KOLOM: ColDef[] = [
  { field: "createdAt", headerName: "Waktu", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
  { headerName: "Pengguna", minWidth: 180, flex: 2, valueGetter: (p) => p.data?.user?.name ?? p.data?.user?.email ?? "sistem" },
  { field: "aksi", headerName: "Aksi", minWidth: 120, cellClass: KELAS_MONO, sortable: true },
  { field: "entitas", headerName: "Entitas", minWidth: 130, cellClass: KELAS_MONO, sortable: true },
  { field: "entitasId", headerName: "ID Entitas", minWidth: 200, cellClass: KELAS_MONO + " text-muted-foreground" },
  { field: "ipAddress", headerName: "IP", minWidth: 120, cellClass: KELAS_MONO },
]

export function AuditGrid() {
  return (
    <DataGrid
      judul="Jejak Audit"
      endpoint="/audit-log"
      columnDefs={KOLOM}
      // Param `entitas` di endpoint adalah pencocokan teks — dipakai sebagai
      // kotak filter di sini.
      searchParam="entitas"
      searchPlaceholder="Filter entitas… (mis. Pelanggan)"
    />
  )
}
