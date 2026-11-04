"use client"

// Grid /dashboard/pengguna — endpoint GET /api/v1/users (MANAGEMENT_UP).
import type { ColDef, ICellRendererParams } from "ag-grid-community"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { ToggleGroupItem } from "@/components/ui/toggle-group"
import { DataGrid } from "@/features/dashboard/shared/data-grid"
import {
  selStatus,
  fmtLabel,
  fmtTanggal,
  KELAS_MONO,
} from "@/features/dashboard/shared/data-grid/components/Sel"
import { label } from "../../lib/Label"
import { LABEL_ROLE, LABEL_STATUS_USER } from "../../lib/LabelPengguna"

function SelRole(p: ICellRendererParams) {
  const nilai = p.value as string | null | undefined
  if (!nilai) return null
  return (
    <span className="border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-primary uppercase">
      {label(LABEL_ROLE, nilai)}
    </span>
  )
}

function SelJenisAkun(p: ICellRendererParams) {
  const nilai = p.value as string | null | undefined
  if (!nilai) return null
  const isPetugas = nilai === "PETUGAS"
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase ${
        isPetugas
          ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      }`}
    >
      {isPetugas ? "Petugas" : "Pelanggan"}
    </span>
  )
}

const KOLOM: ColDef[] = [
  { field: "name", headerName: "Nama Lengkap", minWidth: 170, flex: 2, sortable: true },
  {
    field: "username",
    headerName: "Username",
    minWidth: 120,
    cellClass: KELAS_MONO,
    sortable: true,
  },
  {
    field: "nip",
    headerName: "NIP",
    minWidth: 140,
    cellClass: KELAS_MONO,
    sortable: true,
  },
  {
    field: "nik",
    headerName: "NIK",
    minWidth: 140,
    cellClass: KELAS_MONO,
    sortable: true,
  },
  {
    field: "jenisAkun",
    headerName: "Jenis Akun",
    minWidth: 110,
    cellRenderer: SelJenisAkun,
    sortable: true,
  },
  {
    field: "jabatan",
    headerName: "Jabatan / Posisi",
    minWidth: 180,
    sortable: true,
  },
  {
    field: "nomorPelanggan",
    headerName: "No. Pelanggan",
    minWidth: 130,
    cellClass: KELAS_MONO,
    sortable: true,
  },
  {
    field: "email",
    headerName: "Email",
    minWidth: 180,
    flex: 1,
    sortable: true,
  },
  {
    field: "telepon",
    headerName: "Telepon / WA",
    minWidth: 130,
    cellClass: KELAS_MONO,
    sortable: true,
  },
  {
    field: "role",
    headerName: "Role",
    minWidth: 130,
    sortable: true,
    cellRenderer: SelRole,
    valueFormatter: fmtLabel(LABEL_ROLE),
  },
  {
    field: "status",
    headerName: "Status",
    minWidth: 120,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_STATUS_USER),
    cellRenderer: selStatus({
      ACTIVE: { label: "Aktif", nada: "hijau" },
      INACTIVE: { label: "Non-aktif", nada: "netral" },
      SUSPENDED: { label: "Ditangguhkan", nada: "merah" },
    }),
  },
  {
    field: "divisi.nama",
    headerName: "Divisi",
    minWidth: 140,
    sortable: true,
    valueGetter: (p) => p.data?.divisi?.nama ?? p.data?.divisiKode ?? "-",
  },
  {
    field: "bagian.nama",
    headerName: "Bagian",
    minWidth: 180,
    sortable: true,
    valueGetter: (p) => p.data?.bagian?.nama ?? p.data?.bagianKode ?? "-",
  },
  {
    field: "subBagian.nama",
    headerName: "Sub Bagian",
    minWidth: 180,
    sortable: true,
    valueGetter: (p) => p.data?.subBagian?.nama ?? p.data?.subBagianKode ?? "-",
  },
  {
    field: "lastLoginAt",
    headerName: "Login Terakhir",
    minWidth: 130,
    sortable: true,
    valueFormatter: fmtTanggal,
  },
  {
    field: "createdAt",
    headerName: "Terdaftar",
    minWidth: 120,
    sortable: true,
    valueFormatter: fmtTanggal,
  },
]

export function PenggunaGrid({
  onRowClicked,
  refreshKey,
  onTambahPengguna,
}: {
  onRowClicked?: (data: Record<string, unknown>) => void
  refreshKey?: number
  onTambahPengguna?: () => void
} = {}) {
  return (
    <DataGrid
      judul="Pengguna & Akses"
      endpoint="/users"
      columnDefs={KOLOM}
      onRowClicked={onRowClicked}
      refreshKey={refreshKey}
      toolbarActions={
        onTambahPengguna ? (
          <ToggleGroupItem
            value="add-user"
            onClick={onTambahPengguna}
            aria-label="Tambah pengguna"
            title="Tambah pengguna"
          >
            <HugeiconsIcon
              icon={Add01Icon}
              strokeWidth={2}
              className="size-4"
              aria-hidden
            />
          </ToggleGroupItem>
        ) : null
      }
      searchParam="q"
      searchPlaceholder="Cari nama / email…"
      filters={[
        {
          param: "role",
          label: "Role",
          opsi: Object.entries(LABEL_ROLE).map(([value, label]) => ({
            value,
            label,
          })),
        },
        {
          param: "status",
          label: "Status",
          opsi: Object.entries(LABEL_STATUS_USER).map(([value, label]) => ({
            value,
            label,
          })),
        },
      ]}
    />
  )
}
