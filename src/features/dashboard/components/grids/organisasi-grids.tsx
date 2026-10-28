"use client"

// Grid /dashboard/organisasi — TIGA entitas STRUKTUR organisasi dalam satu
// halaman ber-tab: Divisi → Bagian → Sub-bagian.
//
// PencatatGrid dihapus dari sini: petugas lapangan bukan struktur jabatan,
// dan kini punya halaman sendiri (/dashboard/petugas) dengan penyetelan
// jenis tugas yang tidak muat di grid baca-saja.
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { fmtLabel, KELAS_MONO } from "./sel"
import { LABEL_ROLE } from "../../lib/label"

// Tinggi tabel tidak lagi dipatok di sini — grid memakai default `flex-1`
// dan mengisi TabsContent (lihat organisasi/page.tsx yang sudah full-height),
// konsisten dengan halaman tabel lain.
export function DivisiGrid() {
  const kolom: ColDef[] = [{ field: "nama", headerName: "Nama Divisi", minWidth: 240, flex: 2 }]
  return <DataGrid judul="Divisi" endpoint="/divisi" columnDefs={kolom} searchParam="q" />
}

export function BagianGrid() {
  const kolom: ColDef[] = [
    { field: "kode", headerName: "Kode", minWidth: 100, maxWidth: 130, cellClass: KELAS_MONO },
    { field: "nama", headerName: "Nama Bagian", minWidth: 220, flex: 2 },
    { field: "levelKepala", headerName: "Level Kepala", minWidth: 150, valueFormatter: fmtLabel(LABEL_ROLE) },
    { headerName: "Divisi", minWidth: 150, valueGetter: (p) => p.data?.divisi?.nama ?? "—" },
  ]
  return <DataGrid judul="Bagian" endpoint="/bagian" columnDefs={kolom} searchParam="q" />
}

export function SubBagianGrid() {
  const kolom: ColDef[] = [
    { field: "kode", headerName: "Kode", minWidth: 100, maxWidth: 130, cellClass: KELAS_MONO },
    { field: "nama", headerName: "Nama Sub-bagian", minWidth: 220, flex: 2 },
    { headerName: "Bagian", minWidth: 150, valueGetter: (p) => p.data?.bagian?.nama ?? "—" },
  ]
  return <DataGrid judul="Sub-bagian" endpoint="/sub-bagian" columnDefs={kolom} searchParam="q" />
}

