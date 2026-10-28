"use client"

// Grid /dashboard/pelanggan — endpoint GET /api/v1/pelanggan.
import type { ColDef } from "ag-grid-community"
import { DataGrid, type FilterLanjutanField } from "../data-grid"
import { selStatus, fmtLabel, KELAS_MONO } from "./sel"
import { LABEL_STATUS_PELANGGAN } from "../../lib/label"

const KOLOM: ColDef[] = [
  {
    field: "nomorLangganan",
    headerName: "No Langganan",
    cellClass: KELAS_MONO,
    minWidth: 135,
    maxWidth: 150,
    sortable: true,
  },
  { field: "nama", headerName: "Nama", minWidth: 170, sortable: true },
  {
    field: "alamat",
    headerName: "Alamat",
    minWidth: 220,
    flex: 2,
    sortable: true,
  },
  {
    headerName: "Kecamatan",
    minWidth: 140,
    valueGetter: (p) => p.data?.kecamatan?.nama,
  },
  {
    headerName: "Kelurahan",
    minWidth: 140,
    valueGetter: (p) => p.data?.kelurahan?.nama,
  },
  { field: "rt", headerName: "RT", minWidth: 80, maxWidth: 90 },
  { field: "rw", headerName: "RW", minWidth: 80, maxWidth: 90 },
  {
    headerName: "Gol Tarif",
    minWidth: 100,
    maxWidth: 120,
    cellClass: KELAS_MONO,
    valueGetter: (p) =>
      p.data?.tarifGolongan?.kode?.replace("GOL_", "") ??
      p.data?.tarifGolongan?.nama,
  },
  {
    field: "status",
    headerName: "Status",
    minWidth: 140,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_STATUS_PELANGGAN),
    cellRenderer: selStatus({
      AKTIF: { label: "Aktif", nada: "hijau" },
      TUTUP_SEMENTARA: { label: "Tutup sementara", nada: "amber" },
      DISEGEL: { label: "Disegel", nada: "merah" },
      TUTUP_SPT: { label: "Tutup SPT", nada: "merah" },
    }),
  },
]

const FILTER_PELANGGAN: FilterLanjutanField[] = [
  {
    id: "nomorLangganan",
    label: "No Langganan",
    param: "nomorLangganan",
    operatorParam: "nomorLanggananOperator",
    placeholder: "11 digit nomor langganan",
  },
  {
    id: "nama",
    label: "Nama",
    param: "nama",
    operatorParam: "namaOperator",
    placeholder: "Nama pelanggan",
  },
  {
    id: "alamat",
    label: "Alamat",
    param: "alamat",
    operatorParam: "alamatOperator",
    placeholder: "Alamat pelanggan",
  },
  {
    id: "kecamatan",
    label: "Kecamatan",
    param: "kecamatan",
    operatorParam: "kecamatanOperator",
    placeholder: "Nama kecamatan",
  },
  {
    id: "kelurahan",
    label: "Kelurahan",
    param: "kelurahan",
    operatorParam: "kelurahanOperator",
    placeholder: "Nama kelurahan",
  },
  {
    id: "rt",
    label: "RT",
    param: "rt",
    operatorParam: "rtOperator",
    placeholder: "Nomor RT",
  },
  {
    id: "rw",
    label: "RW",
    param: "rw",
    operatorParam: "rwOperator",
    placeholder: "Nomor RW",
  },
  {
    id: "golTarif",
    label: "Gol Tarif",
    param: "golTarif",
    type: "select",
    opsi: [
      "GOL_1A",
      "GOL_1B",
      "GOL_2A1",
      "GOL_2A2",
      "GOL_2A3",
      "GOL_2A4",
      "GOL_2A5",
      "GOL_2B",
      "GOL_3A",
      "GOL_3B",
      "GOL_3C",
      "GOL_4A",
      "GOL_4B",
    ].map((value) => ({
      value,
      label: value.replace("GOL_", ""),
    })),
  },
  {
    id: "status",
    label: "Status",
    param: "status",
    type: "select",
    opsi: Object.entries(LABEL_STATUS_PELANGGAN).map(([value, label]) => ({
      value,
      label,
    })),
  },
]

export function PelangganGrid() {
  return (
    <DataGrid
      judul="Daftar Pelanggan"
      endpoint="/pelanggan"
      columnDefs={KOLOM}
      searchParam="q"
      searchPlaceholder="Cari nama / nomor / alamat…"
      advancedFilters={FILTER_PELANGGAN}
      // Toolbar (cari, filter, jumlah baris, ikon aksi) di luar tabel, tanpa
      // background/border; tabel menempel ke tepi card utama (gaya Neon).
      toolbarTerpisah
      tabelPenuh
    />
  )
}