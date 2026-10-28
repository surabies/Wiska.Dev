"use client"

// Grid /dashboard/pembayaran — endpoint GET /api/v1/pembayaran (ledger
// percobaan pembayaran, termasuk transaksi PPOB pending/expired).
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { selStatus, fmtRupiah, fmtTanggal, fmtLabel, KELAS_ANGKA, KELAS_MONO } from "./sel"
import { LABEL_KANAL_PEMBAYARAN, LABEL_STATUS_PEMBAYARAN } from "../../lib/label"

const KOLOM: ColDef[] = [
  { field: "kodeReferensi", headerName: "Kode Referensi", minWidth: 160, cellClass: KELAS_MONO, sortable: true },
  { field: "jumlahBayar", headerName: "Jumlah", minWidth: 120, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtRupiah },
  { field: "kanal", headerName: "Kanal", minWidth: 140, sortable: true, valueFormatter: fmtLabel(LABEL_KANAL_PEMBAYARAN) },
  { field: "penyelenggara", headerName: "Penyelenggara", minWidth: 130 },
  {
    field: "status",
    headerName: "Status",
    minWidth: 130,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_STATUS_PEMBAYARAN),
    cellRenderer: selStatus({
      PENDING: { label: "Pending", nada: "amber" },
      BERHASIL: { label: "Berhasil", nada: "hijau" },
      GAGAL: { label: "Gagal", nada: "merah" },
      EXPIRED: { label: "Kedaluwarsa", nada: "netral" },
    }),
  },
  { field: "waktuBayar", headerName: "Waktu Bayar", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
  { field: "createdAt", headerName: "Dicatat", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
]

export function PembayaranGrid() {
  return (
    <DataGrid
      judul="Ledger Pembayaran"
      endpoint="/pembayaran"
      columnDefs={KOLOM}
      filters={[
        {
          param: "status",
          label: "Status",
          opsi: Object.entries(LABEL_STATUS_PEMBAYARAN).map(([value, label]) => ({ value, label })),
        },
        {
          param: "kanal",
          label: "Kanal",
          opsi: Object.entries(LABEL_KANAL_PEMBAYARAN).map(([value, label]) => ({ value, label })),
        },
      ]}
    />
  )
}
