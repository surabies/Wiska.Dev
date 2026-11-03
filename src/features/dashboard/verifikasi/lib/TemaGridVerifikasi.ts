// features/dashboard/verifikasi/lib/TemaGridVerifikasi.ts
// Theming terpusat untuk grid/tabel verifikasi petugas & mandiri.
// Mengatur palet warna, kontras header, latar baris, sel beku, dan kontrol toolbar.

import type { Tahap } from "../types/WarnaTahap"

/** Kelas wadah utama grid tabel verifikasi */
export const TEMA_GRID_WADAH =
  "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-card shadow-xs"

/** Kelas elemen tabel HTML */
export const TEMA_GRID_TABEL =
  "tabel-verifikasi w-max min-w-full table-fixed border-separate border-spacing-0 text-sm bg-card"

/** Kelas baris header tabel (<thead> <tr>) */
export const TEMA_GRID_HEADER_ROW =
  "bg-slate-100 text-slate-900 dark:bg-muted/80 dark:text-foreground supports-backdrop-filter:bg-slate-100/90 dark:supports-backdrop-filter:bg-muted/90 backdrop-blur border-b border-border shadow-[0_1px_2px_rgba(0,0,0,0.03)]"

/** Kelas sel header biasa (<th>) */
export const TEMA_GRID_TH =
  "border-r border-b border-border/80 px-3 text-left text-xs font-semibold text-foreground tracking-wide select-none whitespace-nowrap bg-slate-100 dark:bg-muted/80"

/** Kelas sel header beku / sticky checkbox (<th>) */
export const TEMA_GRID_TH_BEKU =
  "sticky left-0 z-30 bg-slate-100 dark:bg-muted text-foreground border-r border-b border-border/80 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur"

/** Kelas sel data baris biasa (<td>) */
export const TEMA_GRID_TD =
  "border-r border-b border-border/60 px-3 text-xs md:text-sm tabular-nums text-foreground transition-colors"

/** Kelas sel data beku / sticky checkbox (<td>) */
export const TEMA_GRID_TD_BEKU =
  "sticky left-0 z-10 border-r border-b border-border/60 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.04)]"

/** Kelas item ToggleGroup toolbar (ikon padat, ringkasan, atur kolom, dll.) */
export const TEMA_TOGGLE_ITEM =
  "size-8 min-w-8 p-0 rounded-md bg-card border border-white dark:border-border text-foreground hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-foreground shadow-xs transition-colors"

/** Kelas tombol tab aktif (Laporan masuk / Belum dibaca) */
export const TEMA_TAB_AKTIF =
  "bg-card text-foreground font-medium border border-white dark:border-border shadow-xs hover:bg-card"

/** Kelas tombol tab tidak aktif */
export const TEMA_TAB_TIDAK_AKTIF =
  "text-muted-foreground hover:text-foreground hover:bg-card/60"

/** Latar baris per tahap verifikasi */
export const WARNA_BARIS_TAHAP: Record<Tahap, string> = {
  MENUNGGU: "bg-card hover:bg-slate-50 dark:hover:bg-muted/40",
  V1: "bg-amber-500/[0.06] hover:bg-amber-500/[0.12] dark:bg-amber-500/[0.10]",
  V2: "bg-blue-500/[0.06] hover:bg-blue-500/[0.12] dark:bg-blue-500/[0.10]",
  TERVERIFIKASI:
    "bg-blue-500/[0.06] hover:bg-blue-500/[0.12] dark:bg-blue-500/[0.10]",
  V3: "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12] dark:bg-emerald-500/[0.10]",
  DITOLAK:
    "bg-rose-500/[0.06] hover:bg-rose-500/[0.12] dark:bg-rose-500/[0.10]",
}

/** Menentukan kelas latar baris berdasarkan status terpilih dan tahap */
export function tentukanLatarBaris({
  aktif,
  dipilih,
  tahap,
  koreksi,
}: {
  aktif: boolean
  dipilih: boolean
  tahap: Tahap
  koreksi?: boolean
}): string {
  if (aktif || dipilih) {
    return "bg-table-accent text-foreground"
  }
  // Siklus tahap verifikasi (V1, V2, V3, DITOLAK) menjadi prioritas utama tampilan
  // agar progres verifikasi terbaca jelas dan konsisten dengan warna tema per ring.
  if (tahap !== "MENUNGGU") {
    return WARNA_BARIS_TAHAP[tahap] ?? WARNA_BARIS_TAHAP.MENUNGGU
  }
  // Jika masih tahap MENUNGGU dan terdapat riwayat koreksi/edit, beri warna ungu
  // untuk menandakan data hasil editan yang sedang menunggu verifikasi awal.
  if (koreksi) {
    return "bg-purple-500/[0.08] hover:bg-purple-500/[0.14] dark:bg-purple-500/[0.12]"
  }
  return WARNA_BARIS_TAHAP.MENUNGGU
}

/** Menentukan kelas latar sel beku (checkbox kiri) agar tidak tembus pandang */
export function tentukanLatarSelBeku({
  aktif,
  dipilih,
}: {
  aktif: boolean
  dipilih: boolean
}): string {
  if (aktif || dipilih) {
    return "bg-table-accent text-foreground"
  }
  return "bg-card hover:bg-slate-50 dark:hover:bg-muted/40"
}
