"use client"

// Grid /dashboard/pengguna — endpoint GET /api/v1/users (MANAGEMENT_UP).
import type { ColDef, ICellRendererParams } from "ag-grid-community"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { ToggleGroupItem } from "@/components/ui/toggle-group"
import { DataGrid } from "../data-grid"
import { selStatus, fmtLabel, fmtTanggal, KELAS_MONO } from "./sel"
import { LABEL_ROLE, LABEL_STATUS_USER, label } from "../../lib/label"

function SelRole(p: ICellRendererParams) {
  const nilai = p.value as string | null | undefined
  if (!nilai) return null
  return (
    <span className="border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-primary uppercase">
      {label(LABEL_ROLE, nilai)}
    </span>
  )
}

const KOLOM: ColDef[] = [
  { field: "name", headerName: "Nama", minWidth: 160, flex: 2, sortable: true },
  { field: "username", headerName: "Username", minWidth: 130, cellClass: KELAS_MONO, sortable: true },
  { field: "email", headerName: "Email", minWidth: 200, flex: 2, sortable: true },
  { field: "role", headerName: "Role", minWidth: 140, sortable: true, cellRenderer: SelRole, valueFormatter: fmtLabel(LABEL_ROLE) },
  {
    field: "status",
    headerName: "Status",
    minWidth: 130,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_STATUS_USER),
    cellRenderer: selStatus({
      ACTIVE: { label: "Aktif", nada: "hijau" },
      INACTIVE: { label: "Non-aktif", nada: "netral" },
      SUSPENDED: { label: "Ditangguhkan", nada: "merah" },
    }),
  },
  { field: "divisiKode", headerName: "Divisi", minWidth: 100, cellClass: KELAS_MONO, sortable: true },
  { field: "lastLoginAt", headerName: "Login Terakhir", minWidth: 130, sortable: true, valueFormatter: fmtTanggal },
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
        { param: "role", label: "Role", opsi: Object.entries(LABEL_ROLE).map(([value, label]) => ({ value, label })) },
        {
          param: "status",
          label: "Status",
          opsi: Object.entries(LABEL_STATUS_USER).map(([value, label]) => ({ value, label })),
        },
      ]}
    />
  )
}
