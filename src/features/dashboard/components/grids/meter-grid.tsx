"use client"

// Grid /dashboard/meter — endpoint GET /api/v1/meter.
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { selBool, fmtBool, fmtTanggal, KELAS_MONO } from "./sel"

const LABEL_UKURAN: Record<string, string> = {
  INCH_HALF: "½ inci",
  INCH_1: "1 inci",
  INCH_1_HALF: "1½ inci",
  INCH_2: "2 inci",
  INCH_3: "3 inci",
  INCH_4: "4 inci",
}

const KOLOM: ColDef[] = [
  { field: "nomorMeter", headerName: "No. Meter", cellClass: KELAS_MONO, minWidth: 130, sortable: true },
  { headerName: "No. Langganan", minWidth: 135, maxWidth: 155, cellClass: KELAS_MONO, valueGetter: (p) => p.data?.pelanggan?.nomorLangganan },
  { headerName: "Nama Pelanggan", minWidth: 170, flex: 2, valueGetter: (p) => p.data?.pelanggan?.nama },
  { field: "merkKode", headerName: "Merk", minWidth: 90, maxWidth: 120, sortable: true },
  { field: "ukuran", headerName: "Ukuran", minWidth: 90, maxWidth: 110, sortable: true, valueFormatter: (p) => LABEL_UKURAN[p.value as string] ?? (p.value as string) ?? "" },
  { field: "tanggalPasang", headerName: "Dipasang", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
  { field: "isAktif", headerName: "Status", minWidth: 110, maxWidth: 130, sortable: true, cellRenderer: selBool("Aktif", "Histori"), valueFormatter: fmtBool("Aktif", "Histori") },
]

export function MeterGrid() {
  return (
    <DataGrid
      judul="Aset Meter"
      endpoint="/meter"
      columnDefs={KOLOM}
      searchParam="q"
      searchPlaceholder="Cari nomor meter…"
      filters={[
        {
          param: "isAktif",
          label: "Status",
          opsi: [
            { value: "true", label: "Aktif" },
            { value: "false", label: "Histori" },
          ],
        },
      ]}
    />
  )
}
