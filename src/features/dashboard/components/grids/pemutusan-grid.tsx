"use client"

// Grid /dashboard/pemutusan — endpoint GET /api/v1/pemutusan.
//
// nomorLangganan/namaPelanggan dibaca dari field SNAPSHOT (bukan relasi):
// data pemutusan bisa merujuk pelanggan di luar jendela impor CSV utama,
// jadi relasinya opsional — snapshot selalu terisi (lihat prisma/README.md).
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { fmtPeriodeInt, fmtLabel, fmtTanggal, KELAS_MONO } from "./sel"
import { LABEL_JENIS_PEMUTUSAN } from "../../lib/label"

const KOLOM: ColDef[] = [
  { field: "nomorLangganan", headerName: "No. Langganan", cellClass: KELAS_MONO, minWidth: 135, maxWidth: 150, sortable: true },
  { field: "namaPelanggan", headerName: "Nama", minWidth: 170, flex: 2, sortable: true },
  { field: "jenis", headerName: "Jenis", minWidth: 130, sortable: true, valueFormatter: fmtLabel(LABEL_JENIS_PEMUTUSAN) },
  { field: "periode", headerName: "Periode", minWidth: 110, sortable: true, valueFormatter: fmtPeriodeInt },
  { field: "nomorSPT", headerName: "No. SPT", minWidth: 120, cellClass: KELAS_MONO },
  { field: "tanggalSPT", headerName: "Tanggal SPT", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
  { headerName: "Kelurahan", minWidth: 130, valueGetter: (p) => p.data?.kelurahan?.nama },
]

export function PemutusanGrid() {
  return (
    <DataGrid
      judul="Pemutusan Sambungan"
      endpoint="/pemutusan"
      columnDefs={KOLOM}
      searchParam="q"
      searchPlaceholder="Cari nama / nomor…"
      filters={[
        {
          param: "jenis",
          label: "Jenis",
          opsi: Object.entries(LABEL_JENIS_PEMUTUSAN).map(([value, label]) => ({ value, label })),
        },
      ]}
    />
  )
}
