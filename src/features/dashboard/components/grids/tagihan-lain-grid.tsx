"use client";

// Grid /dashboard/tagihan-lain — endpoint GET /api/v1/tagihan-lain
// (pungutan non-air insidental: pasang baru, balik nama, denda, dll).
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "../data-grid";
import {
  fmtRupiah,
  fmtTanggal,
  fmtLabel,
  KELAS_ANGKA,
  KELAS_MONO,
} from "./sel";
import { LABEL_STATUS_TAGIHAN } from "@/features/public/lib/format";
import { LABEL_JENIS_TAGIHAN_LAIN } from "../../lib/label";
import { SEL_STATUS_TAGIHAN, OPSI_STATUS_TAGIHAN } from "./tagihan-grid";

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
    field: "jenis",
    headerName: "Jenis",
    minWidth: 140,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_JENIS_TAGIHAN_LAIN),
  },
  { field: "deskripsi", headerName: "Deskripsi", minWidth: 200, flex: 2 },
  {
    field: "jumlah",
    headerName: "Jumlah",
    minWidth: 120,
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
];

export function TagihanLainGrid() {
  return (
    <DataGrid
      judul="Tagihan Non-Air"
      endpoint="/tagihan-lain"
      columnDefs={KOLOM}
      filters={[
        { param: "status", label: "Status", opsi: OPSI_STATUS_TAGIHAN },
        {
          param: "jenis",
          label: "Jenis",
          opsi: Object.entries(LABEL_JENIS_TAGIHAN_LAIN).map(
            ([value, label]) => ({ value, label }),
          ),
        },
      ]}
    />
  );
}
