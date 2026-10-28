"use client";

// Grid /dashboard/tagihan — endpoint GET /api/v1/tagihan.
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "../data-grid";
import {
  selStatus,
  fmtPeriodeIso,
  fmtRupiah,
  fmtAngka,
  fmtTanggal,
  fmtLabel,
  KELAS_ANGKA,
  KELAS_MONO,
} from "./sel";
import { LABEL_STATUS_TAGIHAN } from "@/features/public/lib/format";

export const SEL_STATUS_TAGIHAN = selStatus({
  BELUM_BAYAR: { label: "Belum dibayar", nada: "amber" },
  SUDAH_BAYAR: { label: "Lunas", nada: "hijau" },
  JATUH_TEMPO: { label: "Jatuh tempo", nada: "merah" },
  DIHAPUSKAN: { label: "Dihapuskan", nada: "netral" },
});

export const OPSI_STATUS_TAGIHAN = Object.entries(LABEL_STATUS_TAGIHAN).map(
  ([value, label]) => ({ value, label }),
);

const KOLOM: ColDef[] = [
  {
    headerName: "No. Langganan",
    minWidth: 135,
    maxWidth: 155,
    cellClass: KELAS_MONO,
    valueGetter: (p) => p.data?.pelanggan?.nomorLangganan,
  },
  {
    headerName: "Nama Pelanggan",
    minWidth: 170,
    flex: 2,
    valueGetter: (p) => p.data?.pelanggan?.nama,
  },
  {
    field: "periode",
    headerName: "Periode",
    minWidth: 105,
    sortable: true,
    valueFormatter: fmtPeriodeIso,
  },
  {
    field: "pemakaianM3",
    headerName: "Pakai (m³)",
    minWidth: 95,
    sortable: true,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtAngka,
  },
  {
    field: "totalTagihan",
    headerName: "Total",
    minWidth: 120,
    sortable: true,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
  {
    field: "denda",
    headerName: "Denda",
    minWidth: 100,
    sortable: true,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
  {
    field: "status",
    headerName: "Status",
    minWidth: 130,
    sortable: true,
    cellRenderer: SEL_STATUS_TAGIHAN,
    valueFormatter: fmtLabel(LABEL_STATUS_TAGIHAN),
  },
  {
    field: "tanggalJatuhTempo",
    headerName: "Jatuh Tempo",
    minWidth: 120,
    sortable: true,
    valueFormatter: fmtTanggal,
  },
  {
    field: "tanggalBayar",
    headerName: "Dibayar",
    minWidth: 120,
    sortable: true,
    valueFormatter: fmtTanggal,
  },
];

export function TagihanGrid() {
  return (
    <DataGrid
      judul="Tagihan Air Periodik"
      endpoint="/tagihan"
      columnDefs={KOLOM}
      filters={[
        { param: "status", label: "Status", opsi: OPSI_STATUS_TAGIHAN },
      ]}
    />
  );
}
