// components/layout/navigation/sidebar/icons.ts
// Satu-satunya tempat pemetaan ikon sidebar. Menambah menu baru = tambah satu
// baris di ITEM_ICONS (atau biarkan: otomatis memakai ikon grupnya).

import type { IconSvgElement } from "@hugeicons/react"
import {
  Activity01Icon,
  Analytics01Icon,
  DashboardSquare01Icon,
  File01Icon,
  AddSquareIcon,
  Alert01Icon,
  Alert02Icon,
  AlertDiamondIcon,
  ArrowDataTransferHorizontalIcon,
  ArrowDataTransferVerticalIcon,
  ArrowUpDownIcon,
  Calendar03Icon,
  CalendarAdd01Icon,
  CalendarLock01Icon,
  CalendarRemove01Icon,
  CalculatorIcon,
  Camera01Icon,
  ChartBarLineIcon,
  ChartLineData01Icon,
  CheckmarkBadge01Icon,
  CloudUploadIcon,
  ContactBookIcon,
  DashboardSpeed01Icon,
  DatabaseIcon,
  DatabaseImportIcon,
  DatabaseSync01Icon,
  Download01Icon,
  Edit02Icon,
  File02Icon,
  FileAttachmentIcon,
  FileExportIcon,
  FileImportIcon,
  FileSearchIcon,
  FileSyncIcon,
  GitCompareIcon,
  GitMergeIcon,
  HistoryIcon,
  Image01Icon,
  ImageDone01Icon,
  ImageUpload01Icon,
  Invoice01Icon,
  Layers01Icon,
  Location01Icon,
  MapsIcon,
  MapsLocation01Icon,
  NewsIcon,
  PencilEdit01Icon,
  PercentCircleIcon,
  RefreshIcon,
  Route01Icon,
  Sent02Icon,
  SentIcon,
  SmartPhone01Icon,
  Sorting05Icon,
  Task01Icon,
  Task02Icon,
  TrendingDownIcon,
  TrendingUpIcon,
  Upload04Icon,
  UserAccountIcon,
  UserGroupIcon,
  UserListIcon,
  UserShield01Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons"

// ----------------------------------------------------------------------------
// IKON GRUP — key HARUS sama dengan `id` di navigation.ts
// ----------------------------------------------------------------------------
export const GROUP_ICONS: Record<string, IconSvgElement> = {
  master: DatabaseIcon,
  "pengolahan-data": DashboardSpeed01Icon,
  peta: MapsIcon,
  progress: ChartLineData01Icon,
  laporan: File02Icon,
  "tool-tutup-bulan": CalendarLock01Icon,
  tools: Wrench01Icon,
  "sync-tutup-bulan": RefreshIcon,
}

export const FALLBACK_GROUP_ICON: IconSvgElement = Layers01Icon

// ----------------------------------------------------------------------------
// IKON MENU — key = judul menu (huruf besar/kecil tidak berpengaruh).
// Menu yang tidak ada di sini memakai ikon grupnya.
// ----------------------------------------------------------------------------
const ITEM_ICONS: Record<string, IconSvgElement> = {
  // Master
  "kelainan": Alert02Icon,
  "otorisasi menu": UserShield01Icon,
  "user": UserAccountIcon,
  "petugas": UserGroupIcon,
  "pemetaan petugas": MapsLocation01Icon,
  "pengurutan rute petugas": Sorting05Icon,
  "penggabungan rute": GitMergeIcon,
  "pindah rute": Route01Icon,
  "pindah rute monitoring": Activity01Icon,

  // Pengolahan Data
  "baca meter wilayah (chn)": DashboardSpeed01Icon,
  "info pelanggan": ContactBookIcon,
  "mutasi pb-pk": ArrowDataTransferHorizontalIcon,
  "no hp pelanggan": SmartPhone01Icon,
  "pindah jenis pelanggan": ArrowDataTransferVerticalIcon,
  "manual add": AddSquareIcon,
  "manual add all": Layers01Icon,
  "hitung rata-rata": CalculatorIcon,
  "cek foto petugas": Camera01Icon,
  "verifikasi catat mandiri": CheckmarkBadge01Icon,

  // Peta
  "pemetaan pelanggan": Location01Icon,
  "peta wilayah": MapsIcon,

  // Progress
  "grafik pelanggan": ChartLineData01Icon,
  "progress per wilayah": ChartBarLineIcon,
  "progress per cater": UserListIcon,
  "presentase koreksi": PercentCircleIcon,
  "ikhtisar pemakaian ekstrim": TrendingUpIcon,
  "ikhtisar pemakaian turun": TrendingDownIcon,
  "ikhtisar pemakaian 0": Alert01Icon,
  "hasil foto petugas": ImageDone01Icon,

  // Laporan
  "laporan drd": Invoice01Icon,
  "lap. mutasi pel": FileSyncIcon,
  "lap. mutasi pb-pk": FileExportIcon,
  "lap. periode cater": Calendar03Icon,
  "lap data meter": FileSearchIcon,
  "lap kelainan meter": AlertDiamondIcon,
  "lap evaluasi": Task01Icon,
  "lap pelanggan": UserListIcon,
  "lap. selisih hari": CalendarRemove01Icon,
  "lap data st. awal & akhir": ArrowUpDownIcon,
  "lap data st. 0 (nol)": Alert01Icon,
  "lap history": HistoryIcon,
  "lap perubahan pel": Edit02Icon,
  "lap. data dan foto": Image01Icon,
  "lap. monitoring kubikasi koreksi": Activity01Icon,

  // Tool Tutup Bulan
  "pbpk": FileAttachmentIcon,
  "stand angkat": Upload04Icon,
  "update zonasi": Layers01Icon,
  "posting datameter": SentIcon,
  "create closed drd": CalendarLock01Icon,
  "create perbandingan": GitCompareIcon,
  "create bulan baru": CalendarAdd01Icon,
  "upload master pelanggan": CloudUploadIcon,
  "sync pelanggan baru": RefreshIcon,
  "update data pelanggan": PencilEdit01Icon,
  "cek selisih pelanggan": FileSearchIcon,
  "monitoring tutup bulan": Activity01Icon,

  // Tools
  "running text": NewsIcon,
  "import stand angkat": DatabaseImportIcon,
  "import pb pk": FileImportIcon,
  "proses pbpk": Task02Icon,
  "import backup photo": ImageUpload01Icon,
  "import backup photo gwm": ImageUpload01Icon,
  "import backup data": DatabaseImportIcon,
  "import data spt": FileImportIcon,
  "import data anomali": Alert02Icon,
  "import data gwm": DatabaseImportIcon,
  "import tutup": CalendarLock01Icon,

  // Sync Tutup Bulan
  "sync (1) kirim mutasi": Sent02Icon,
  "sync (2) kirim datameter": DatabaseSync01Icon,
  "sync (3) import sti": Download01Icon,
  "sync (4) bulan baru": CalendarAdd01Icon,
}

export function getItemIcon(title: string, fallback: IconSvgElement): IconSvgElement {
  return ITEM_ICONS[title.trim().toLowerCase()] ?? fallback
}

export function getGroupIcon(groupId: string): IconSvgElement {
  return GROUP_ICONS[groupId] ?? FALLBACK_GROUP_ICON
}

// ----------------------------------------------------------------------------
// IKON MENU UTAMA (Dashboard / Analytics / Report) — key = href di primaryNav
// ----------------------------------------------------------------------------
const PRIMARY_ICONS: Record<string, IconSvgElement> = {
  "/dashboard": DashboardSquare01Icon,
  "/analytics": Analytics01Icon,
  "/report": File01Icon,
}

export function getPrimaryIcon(href: string): IconSvgElement {
  return PRIMARY_ICONS[href] ?? FALLBACK_GROUP_ICON
}
