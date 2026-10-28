"use client"

// Grid /dashboard/pembacaan — endpoint GET /api/v1/pembacaan (pencatatan
// meter resmi hasil closing/verifikasi).
// Kolom nomor langganan & nama pelanggan dipisah supaya ekspor Excel-nya
// langsung berbentuk kolom rekap.
import * as React from "react"
import type { ColDef } from "ag-grid-community"
import { DataGrid, type FilterSelect } from "../data-grid"
import { fmtPeriodeIso, fmtAngka, fmtLabel, KELAS_ANGKA, KELAS_MONO } from "./sel"
import { LABEL_KONDISI_CATAT } from "../../lib/label"
import { usePeriodeKerja } from "../../lib/periode-kerja"
import { ambilList } from "../../lib/api-client"
import { formatPeriode } from "@/features/public/lib/format"

const KOLOM: ColDef[] = [
  { headerName: "No. Langganan", minWidth: 135, maxWidth: 155, cellClass: KELAS_MONO, valueGetter: (p) => p.data?.meter?.pelanggan?.nomorLangganan },
  { headerName: "Nama Pelanggan", minWidth: 170, flex: 2, valueGetter: (p) => p.data?.meter?.pelanggan?.nama },
  { headerName: "No. Meter", minWidth: 115, cellClass: KELAS_MONO, valueGetter: (p) => p.data?.meter?.nomorMeter },
  { field: "periode", headerName: "Periode", minWidth: 110, sortable: true, valueFormatter: fmtPeriodeIso },
  { field: "standLalu", headerName: "Stand Lalu", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "standAkhir", headerName: "Stand Akhir", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "pemakaianM3", headerName: "Pakai (m³)", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "kondisi", headerName: "Kondisi", minWidth: 140, sortable: true, valueFormatter: fmtLabel(LABEL_KONDISI_CATAT) },
  { headerName: "Pencatat", minWidth: 120, valueGetter: (p) => p.data?.pencatat?.namaLapangan ?? "—" },
]

export function PembacaanGrid() {
  // Periode diambil dari sumber yang sama dengan seluruh layar lain
  // (GET /closing/periode-kerja), bukan dari daftar bulan yang dikarang di
  // sini — lihat alasannya di lib/periode-kerja.ts.
  const { daftar } = usePeriodeKerja()

  // Daftar pencatat dimuat sekali, pola yang sama dengan toolbar verifikasi
  // (verifikasi-lapangan.tsx). Gagal memuat TIDAK menjatuhkan tabel: filternya
  // sekadar tidak muncul, datanya tetap terbaca.
  const [pencatats, setPencatats] = React.useState<{ id: string; namaLapangan: string }[]>([])
  React.useEffect(() => {
    let batal = false
    ambilList<{ id: string; namaLapangan: string }>("/pencatat", { pageSize: 500 })
      .then(({ rows }) => { if (!batal) setPencatats(rows) })
      .catch(() => {})
    return () => { batal = true }
  }, [])

  // KENAPA PENYARINGNYA TIGA, DAN KENAPA HARUS BISA DIPADUKAN: tabel ini
  // menyimpan SELURUH riwayat pembacaan resmi (ratusan ribu baris, tujuh
  // periode dan terus bertambah). Sendiri-sendiri, tiap penyaring menjawab
  // pertanyaan yang terlalu kasar — "berapa stand tempel sepanjang sejarah"
  // tidak bisa ditindaklanjuti siapa pun. Bertiga, penghitung baris di kanan
  // atas menjawab pertanyaan pengawasan yang sebenarnya: "stand tempel milik
  // AGUS bulan Juli — berapa?"
  const filters: FilterSelect[] = [
    {
      param: "periode",
      label: "Periode",
      opsi: daftar.map((p) => ({ value: String(p.periode), label: formatPeriode(p.periode) })),
    },
    {
      // LENGKAP: seluruh 21 kondisi catat, bukan hanya yang "sering".
      param: "kondisi",
      label: "Kondisi",
      opsi: Object.entries(LABEL_KONDISI_CATAT).map(([value, label]) => ({ value, label })),
    },
    {
      param: "pencatatId",
      label: "Pencatat",
      opsi: pencatats.map((p) => ({ value: p.id, label: p.namaLapangan })),
    },
  ]

  return (
    <DataGrid
      judul="Pembacaan Meter Resmi"
      endpoint="/pembacaan"
      columnDefs={KOLOM}
      filters={filters}
      // Toolbar (filter, jumlah baris, ikon aksi) di luar tabel, tanpa
      // background/border; tabel menempel ke tepi card utama (gaya Neon).
      toolbarTerpisah
      tabelPenuh
    />
  )
}