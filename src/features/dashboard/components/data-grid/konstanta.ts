// Konstanta DataGrid: ukuran halaman, batas ekspor, nilai default stabil.
import type {
  FilterLanjutanField,
  FilterSelect,
  OperatorFilterLanjutan,
} from "./tipe"

export const PAGE_SIZE = 50

export const UKURAN_HALAMAN_MOBILE = 25

export const EKSPOR_BLOK = 1000

export const EKSPOR_MAKS_BLOK = 100

// pagar keselamatan: maks 100rb baris per file
export const NILAI_KOSONG = "__semua__"

/// Default prop berupa konstanta modul: `filters = []` di parameter fungsi
/// membuat array BARU tiap render, dan identitas yang berubah-ubah itu
/// merembet ke dependency effect (memicu purge/fetch berulang).
export const TANPA_FILTER: FilterSelect[] = []

export const TANPA_FILTER_LANJUTAN: FilterLanjutanField[] = []

export const OPERATOR_TEKS: { value: OperatorFilterLanjutan; label: string }[] =
  [
    { value: "equals", label: "sama dengan" },
    { value: "contains", label: "mengandung" },
    { value: "startsWith", label: "diawali" },
  ]
