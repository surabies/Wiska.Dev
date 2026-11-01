// Tipe publik dan internal DataGrid.
import type { ReactNode } from "react"
import type { ColDef } from "ag-grid-community"

export type BarisData = Record<string, unknown>

export interface FilterSelect {
  /** Nama query param di endpoint, mis. "status". */
  param: string
  label: string
  opsi: { value: string; label: string }[]
}

/** Penyaring rentang tanggal (satu tombol + kalender + pintasan). Nilainya
 *  ikut `filterNilai` seperti dropdown biasa — tanggal kosong tidak terkirim
 *  karena api-client membuang param bernilai "". */
export interface FilterTanggal {
  /** Param batas bawah, mis. "tanggalDari". */
  paramDari: string
  /** Param batas atas, mis. "tanggalSampai". */
  paramSampai: string
  /** Tanggal apa yang disaring, mis. "Tanggal catat" / "Masuk". */
  label: string
}

export type OperatorFilterLanjutan = "equals" | "contains" | "startsWith"

export interface FilterLanjutanField {
  id: string
  label: string
  param: string
  operatorParam?: string
  type?: "text" | "select"
  opsi?: { value: string; label: string }[]
  operator?: { value: OperatorFilterLanjutan; label: string }[]
  placeholder?: string
}

export interface DataGridProps {
  /** Nama tabel: label aksesibilitas panel + dasar nama file ekspor. */
  judul: string
  /** Path list di bawah /api/v1, mis. "/pelanggan". */
  endpoint: string
  columnDefs: ColDef[]
  /** Nama param pencarian bila endpoint mendukung (biasanya "q"). Tanpa ini kotak cari disembunyikan. */
  searchParam?: string
  searchPlaceholder?: string
  initialSearch?: string
  filters?: FilterSelect[]
  advancedFilters?: FilterLanjutanField[]
  /** Penyaring rentang tanggal; endpoint harus menerima kedua paramnya. */
  filterTanggal?: FilterTanggal
  /** Param tetap yang selalu ikut terkirim. */
  extraParams?: Record<string, string>
  tinggiClassName?: string
  /** Klik baris (pola master-detail, mis. halaman verifikasi). */
  onRowClicked?: (data: BarisData) => void
  /** Klik kanan baris — pemicu menu aksi kontekstual (halaman verifikasi).
   *  Menyediakan koordinat viewport kursor; menu default browser ditekan. */
  onRowContextMenu?: (data: BarisData, posisi: { x: number; y: number }) => void
  /** id baris yang sedang dipilih — disorot sinkron dengan panel detail. */
  idTerpilih?: string | null
  /** Naikkan nilainya untuk memaksa muat ulang data (setelah aksi verifikasi). */
  refreshKey?: number
  /** Aksi tambahan yang diletakkan bersama kontrol toolbar grid. */
  toolbarActions?: ReactNode
}

export type BarisFilterLanjutan = {
  id: number
  fieldId: string
  operator: OperatorFilterLanjutan
  value: string
}

export type ParamUrut = { sortBy?: string; sortDir?: string }

export type KeadaanDaftar = {
  /** Sidik jari kueri yang menghasilkan keadaan ini — beda = basi. */
  kunci: string
  baris: BarisData[]
  halaman: number
  total: number | null
  adaLagi: boolean
  memuat: boolean
  galat: string | null
}
