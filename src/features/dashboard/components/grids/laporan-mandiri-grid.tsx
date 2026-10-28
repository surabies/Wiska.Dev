"use client"

// Grid /dashboard/laporan-mandiri — endpoint GET /api/v1/laporan-mandiri
// (laporan meter yang dikirim pelanggan dari halaman publik /lapor-meter).
//
// BILAH PENYARINGNYA LENGKAP, DAN ITU DISENGAJA. Halaman ini adalah daftar
// SELURUH kiriman warga lintas bulan, bukan antrean kerja: yang sudah
// diverifikasi tetap tinggal di sini dengan status "Jadi pembacaan resmi".
// Tanpa pencarian dan penyaring periode, satu-satunya cara menemukan kiriman
// tertentu adalah menggulir — dan begitu antrean bulan berjalan menumpuk,
// kiriman yang sudah diproses terlihat seperti lenyap padahal cuma terdorong
// ke bawah.
import type { ColDef, ICellRendererParams } from "ag-grid-community"
import { DataGrid, type FilterSelect } from "../data-grid"
import { selStatus, fmtLabel, fmtPeriodeInt, fmtAngka, fmtTanggal, KELAS_ANGKA, KELAS_MONO } from "./sel"
import { LABEL_STATUS_LAPORAN_MANDIRI, OPSI_STATUS_LAPORAN_MANDIRI } from "../../lib/label"
import { usePeriodeBerdata } from "../../lib/opsi-penyaring"
import { formatPeriode } from "@/features/public/lib/format"

function SelFoto(p: ICellRendererParams) {
  const url = p.value as string | null | undefined
  if (!url) return <span className="text-muted-foreground">—</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
      Lihat foto ↗
    </a>
  )
}

const KOLOM: ColDef[] = [
  { field: "nomorLangganan", headerName: "No. Langganan", minWidth: 135, maxWidth: 150, cellClass: KELAS_MONO, sortable: true },
  { headerName: "Pelanggan", minWidth: 160, flex: 2, valueGetter: (p) => p.data?.pelanggan?.nama ?? "—" },
  { field: "periode", headerName: "Periode", minWidth: 105, sortable: true, valueFormatter: fmtPeriodeInt },
  { field: "standDilaporkan", headerName: "Stand (m³)", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "namaPelapor", headerName: "Pelapor", minWidth: 130, sortable: true },
  { field: "fotoUrl", headerName: "Bukti", minWidth: 100, cellRenderer: SelFoto },
  {
    field: "status",
    headerName: "Status",
    minWidth: 150,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_STATUS_LAPORAN_MANDIRI),
    cellRenderer: selStatus({
      MENUNGGU: { label: "Menunggu", nada: "amber" },
      DIVERIFIKASI: { label: "Diverifikasi", nada: "hijau" },
      DIGUNAKAN: { label: "Jadi pembacaan resmi", nada: "hijau" },
      DITOLAK: { label: "Ditolak", nada: "merah" },
    }),
  },
  { field: "createdAt", headerName: "Masuk", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
]

export function LaporanMandiriGrid() {
  const periodes = usePeriodeBerdata("/laporan-mandiri/stats")

  const filters: FilterSelect[] = [
    {
      param: "periode",
      label: "Periode",
      opsi: periodes.map((p) => ({ value: String(p), label: formatPeriode(p) })),
    },
    {
      param: "status",
      label: "Status",
      opsi: OPSI_STATUS_LAPORAN_MANDIRI,
    },
  ]

  return (
    <DataGrid
      judul="Laporan Meter Mandiri"
      endpoint="/laporan-mandiri"
      columnDefs={KOLOM}
      searchParam="q"
      searchPlaceholder="Cari no. langganan / pelanggan / pelapor…"
      filters={filters}
      // Rentangnya TANGGAL MASUK, bukan periode: kiriman untuk periode Juli
      // bisa saja tiba di awal Agustus, dan pertanyaan hariannya memang
      // "apa yang masuk hari ini".
      filterTanggal={{ paramDari: "tanggalDari", paramSampai: "tanggalSampai", label: "Masuk" }}
    />
  )
}
