// Tema AG Grid (token CSS proyek, gaya Geist).
import { themeQuartz } from "ag-grid-community"

// Kelas kontrol toolbar dipindah ke ./kelas-kontrol (tanpa impor AG Grid) dan
// diekspor ulang di sini supaya impor lama dari "../tema" tidak perlu diubah.
export {
  KELAS_DASAR_KONTROL,
  KELAS_KONTROL,
  KELAS_KONTROL_AKTIF,
  KELAS_KONTROL_PANEL,
  KELAS_INPUT_TOOLBAR,
} from "./kelas-kontrol"

/// Tema dipetakan ke token CSS proyek (bukan warna hardcode) — dark mode
/// ikut benar otomatis karena nilai var berubah saat class `dark` menempel.
///
/// Resep Geist: kepala kolom memakai kanvas (--background) sehingga sedikit
/// berbeda dari badan tabel (--card); garis antar baris memakai
/// --border-subtle (satu langkah lebih terang dari --border, khusus garis di
/// DALAM panel); hover dan baris terpilih memakai aksen tabel netral Geist.
/// Garis vertikal antar kolom dimatikan, tinggi baris 42px, dan bingkai luar
/// dilepas karena <section> pembungkus sudah punya bingkai sendiri.
export const temaGrid = themeQuartz.withParams({
  accentColor: "var(--ring)",
  backgroundColor: "var(--card)",
  foregroundColor: "var(--foreground)",
  borderColor: "var(--border-subtle)",
  headerBackgroundColor: "var(--background)",
  headerTextColor: "var(--muted-foreground)",
  headerFontWeight: 500,
  fontFamily: "var(--font-geist-sans)",
  fontSize: 13,
  headerFontSize: 12,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  wrapperBorder: false,
  columnBorder: false,
  rowHeight: 42,
  cellHorizontalPadding: 14,
  oddRowBackgroundColor: "transparent",
  rowHoverColor: "var(--table-accent)",
  selectedRowBackgroundColor: "var(--table-accent)",
  browserColorScheme: "inherit",
})

export const KELAS_AREA_GRID =
  // min-h-0: AG Grid perlu ruang terukur agar bisa menggulir di panel.
  "min-h-0 scrollbar-tipis " +
  "[&_.ag-header-cell-text]:text-xs [&_.ag-header-cell-text]:font-medium [&_.ag-header-cell-text]:tracking-normal [&_.ag-header-cell-text]:normal-case " +
  "[&_.ag-cell]:tabular-nums " +
  "[&_.baris-terpilih]:bg-table-accent "