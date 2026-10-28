// features/dashboard/components/pengaduan/papan-pengaduan/kolom.tsx —
// definisi kolom AG Grid daftar pengaduan.
import type { ColDef } from "ag-grid-community";
import { LABEL_JENIS_PENGADUAN } from "@/features/public/lib/format";
import {
  LABEL_PRIORITAS_PENGADUAN,
  LABEL_STATUS_PENGADUAN_STAF_RINGKAS,
} from "@/features/dashboard/lib/label";
import {
  selStatus,
  fmtTanggal,
  fmtLabel,
  KELAS_MONO,
  type Nada,
} from "@/features/dashboard/components/grids/sel";
import type { StatusPengaduan } from "@/features/dashboard/components/pengaduan/tipe";
import { SelSla } from "./sel-sla";

/// Nada warna sel status di grid. Sengaja dipisah dari labelnya: labelnya
/// datang dari LABEL_STATUS_PENGADUAN_STAF_RINGKAS supaya teks yang dirender
/// sel, teks yang diekspor ke Excel, dan teks yang dicari kotak pencarian
/// adalah string yang SAMA — dulu peta inline di sini punya label sendiri
/// yang menyimpang dari valueFormatter-nya, dan bolong di dua status
/// (TERVERIFIKASI & MENUJU_LOKASI) sehingga keduanya tampil sebagai enum
/// mentah.
const NADA_SEL_STATUS: Record<StatusPengaduan, Nada> = {
  BARU: "biru",
  TERVERIFIKASI: "biru",
  DITUGASKAN: "amber",
  MENUJU_LOKASI: "biru",
  DIPROSES: "amber",
  MENUNGGU_PELANGGAN: "netral",
  SELESAI: "hijau",
  DITUTUP: "netral",
  DIBUKA_KEMBALI: "merah",
  DITOLAK: "merah",
};

const SEL_STATUS = Object.fromEntries(
  Object.entries(NADA_SEL_STATUS).map(([kode, nada]) => [
    kode,
    { label: LABEL_STATUS_PENGADUAN_STAF_RINGKAS[kode as StatusPengaduan], nada },
  ]),
) as Record<StatusPengaduan, { label: string; nada: Nada }>;

const SEL_PRIORITAS = {
  DARURAT: { label: "Darurat", nada: "merah" },
  TINGGI: { label: "Tinggi", nada: "amber" },
  NORMAL: { label: "Normal", nada: "netral" },
  RENDAH: { label: "Rendah", nada: "netral" },
} satisfies Record<string, { label: string; nada: Nada }>;

export const KOLOM_PENGADUAN: ColDef[] = [
  { field: "nomorTiket", headerName: "No. Tiket", minWidth: 150, cellClass: KELAS_MONO, sortable: true },
  { field: "judul", headerName: "Judul", minWidth: 200, flex: 2, sortable: true },
  {
    field: "jenis",
    headerName: "Jenis",
    minWidth: 140,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_JENIS_PENGADUAN),
  },
  {
    field: "prioritas",
    headerName: "Prioritas",
    minWidth: 110,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_PRIORITAS_PENGADUAN),
    cellRenderer: selStatus(SEL_PRIORITAS),
  },
  {
    field: "status",
    headerName: "Status",
    minWidth: 160,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_STATUS_PENGADUAN_STAF_RINGKAS),
    cellRenderer: selStatus(SEL_STATUS),
  },
  { headerName: "Tenggat", minWidth: 130, cellRenderer: SelSla, sortable: false },
  {
    headerName: "Petugas",
    minWidth: 140,
    valueGetter: (p) => p.data?.ditugaskanKe?.name ?? "—",
  },
  { field: "pelapor", headerName: "Pelapor", minWidth: 130, sortable: true },
  { field: "createdAt", headerName: "Masuk", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
];
