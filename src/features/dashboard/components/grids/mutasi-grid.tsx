"use client"

// Grid /dashboard/mutasi — endpoint GET /api/v1/mutasi.
// Kolom nomor langganan & nama pelanggan SENGAJA dipisah (bukan satu sel
// dua baris) supaya hasil ekspor Excel-nya langsung berbentuk kolom rekap.
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { fmtPeriodeInt, fmtTanggal, fmtLabel, KELAS_MONO } from "./sel"
import { LABEL_JENIS_MUTASI } from "../../lib/label"

const KOLOM: ColDef[] = [
  { headerName: "No. Langganan", minWidth: 135, maxWidth: 155, cellClass: KELAS_MONO, valueGetter: (p) => p.data?.pelanggan?.nomorLangganan },
  { headerName: "Nama Pelanggan", minWidth: 170, flex: 2, valueGetter: (p) => p.data?.pelanggan?.nama },
  { field: "jenis", headerName: "Jenis", minWidth: 130, sortable: true, valueFormatter: fmtLabel(LABEL_JENIS_MUTASI) },
  { field: "periode", headerName: "Periode", minWidth: 110, sortable: true, valueFormatter: fmtPeriodeInt },
  { field: "nomorMeterBaru", headerName: "Meter Baru", minWidth: 120, sortable: true, cellClass: KELAS_MONO },
  { field: "tarifBaru", headerName: "Tarif Baru", minWidth: 100, valueFormatter: (p) => (p.value ? String(p.value).replace("GOL_", "") : "—") },
  { field: "tanggalAktif", headerName: "Tanggal Aktif", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
  { field: "catatan", headerName: "Catatan", minWidth: 150, flex: 2 },
]

export function MutasiGrid() {
  return (
    <DataGrid
      judul="Mutasi Pelanggan"
      endpoint="/mutasi"
      columnDefs={KOLOM}
      filters={[
        {
          param: "jenis",
          label: "Jenis",
          opsi: Object.entries(LABEL_JENIS_MUTASI).map(([value, label]) => ({ value, label })),
        },
      ]}
    />
  )
}
