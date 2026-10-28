"use client"

// Grid /dashboard/laporan-harian — endpoint GET /api/v1/laporan-harian
// (setoran baca meter harian petugas lapangan, sebelum verifikasi).
//
// namaPelanggan dari field snapshot (bukan relasi) — lihat catatan pola
// snapshot di prisma/README.md.
//
// KENAPA PENYARINGNYA SEBANYAK INI. Tabel ini berisi 22 ribu baris per bulan
// dan terus bertambah; halaman ini dipakai untuk MEMANTAU setoran, bukan
// memverifikasinya (verifikasi berjenjang V1–V3 ada di /verifikasi-lapangan).
// Pertanyaan pemantauan selalu berbentuk irisan — "setoran AGUS hari ini",
// "meter rusak bulan Juli", "yang masih menunggu verifikasi" — dan dengan
// kotak cari saja, tidak satu pun dari ketiganya bisa dijawab. Penghitung
// baris di kanan atas toolbar-lah jawabannya begitu penyaringnya dipadukan.
import type { ColDef } from "ag-grid-community"
import { DataGrid, type FilterSelect } from "../data-grid"
import { selBool, fmtBool, fmtPeriodeInt, fmtAngka, fmtLabel, fmtTanggal, KELAS_ANGKA, KELAS_MONO } from "./sel"
import { LABEL_KONDISI_CATAT } from "../../lib/label"
import { usePencatats, usePeriodeBerdata } from "../../lib/opsi-penyaring"
import { formatPeriode } from "@/features/public/lib/format"

const KOLOM: ColDef[] = [
  { field: "nomorLangganan", headerName: "No. Langganan", minWidth: 135, maxWidth: 150, cellClass: KELAS_MONO, sortable: true },
  { field: "namaPelanggan", headerName: "Pelanggan", minWidth: 160, flex: 2, sortable: true },
  { field: "periode", headerName: "Periode", minWidth: 105, sortable: true, valueFormatter: fmtPeriodeInt },
  { field: "standAwal", headerName: "Stand Awal", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "standAkhir", headerName: "Stand Akhir", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "pemakaian", headerName: "Pakai (m³)", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "kondisi", headerName: "Kondisi", minWidth: 130, sortable: true, valueFormatter: fmtLabel(LABEL_KONDISI_CATAT) },
  // Dua kolom di bawah ini menemani penyaringnya: menyaring per petugas atau
  // per tanggal tanpa bisa melihat kolomnya membuat hasilnya tidak bisa
  // diperiksa ulang oleh mata.
  { headerName: "Petugas", minWidth: 130, valueGetter: (p) => p.data?.pencatat?.namaLapangan ?? "—" },
  { field: "tanggalCatat", headerName: "Tgl. Catat", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
  { field: "isVerified", headerName: "Verifikasi", minWidth: 120, sortable: true, cellRenderer: selBool("Terverifikasi", "Belum", "hijau", "amber"), valueFormatter: fmtBool("Terverifikasi", "Belum") },
]

export function LaporanHarianGrid() {
  const periodes = usePeriodeBerdata("/laporan-harian/stats")
  const pencatats = usePencatats()

  const filters: FilterSelect[] = [
    {
      param: "periode",
      label: "Periode",
      opsi: periodes.map((p) => ({ value: String(p), label: formatPeriode(p) })),
    },
    {
      // statusVerif, BUKAN isVerified: "belum diverifikasi" dan "ditolak"
      // sama-sama berisVerified false, dan menggabungkan keduanya menyembunyikan
      // baris yang justru paling perlu ditindaklanjuti.
      param: "statusVerif",
      label: "Status",
      opsi: [
        { value: "MENUNGGU", label: "Menunggu verifikasi" },
        { value: "DIVERIFIKASI", label: "Sudah diverifikasi" },
        { value: "DITOLAK", label: "Ditolak / cek ulang" },
      ],
    },
    {
      param: "pencatatId",
      label: "Petugas",
      opsi: pencatats.map((p) => ({ value: p.id, label: p.namaLapangan })),
    },
    {
      // LENGKAP: seluruh kondisi catat, bukan hanya yang "sering" — sama
      // dengan penyaring kondisi di /dashboard/pembacaan.
      param: "kondisi",
      label: "Kondisi",
      opsi: Object.entries(LABEL_KONDISI_CATAT).map(([value, label]) => ({ value, label })),
    },
    {
      // Dua penyaring boolean berbentuk dropdown satu pilihan supaya sebaris
      // dengan yang lain; "semua" adalah opsi kosongnya.
      param: "hanyaAnomali",
      label: "Anomali",
      opsi: [{ value: "true", label: "Hanya anomali" }],
    },
    {
      param: "adaUsulan",
      label: "Usulan",
      opsi: [{ value: "true", label: "Ada usulan lapangan" }],
    },
  ]

  return (
    <DataGrid
      judul="Laporan Harian Petugas"
      endpoint="/laporan-harian"
      columnDefs={KOLOM}
      searchParam="q"
      searchPlaceholder="Cari no. langganan / nama…"
      filters={filters}
      filterTanggal={{ paramDari: "tanggalDari", paramSampai: "tanggalSampai", label: "Tanggal catat" }}
      toolbarModal
    />
  )
}