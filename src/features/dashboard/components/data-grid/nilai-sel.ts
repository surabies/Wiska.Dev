// Membaca nilai satu sel dari colDef (dipakai ekspor Excel dan kartu ponsel).
import type {
  ColDef,
  ValueFormatterParams,
  ValueGetterParams,
} from "ag-grid-community"
import type { BarisData } from "./tipe"

export const kunciKolom = (c: ColDef) =>
  c.colId ?? c.field ?? c.headerName ?? ""

/** Nilai mentah satu sel: valueGetter dulu, lalu `field`. */
function bacaNilai(c: ColDef, row: BarisData): unknown {
  if (typeof c.valueGetter === "function")
    return c.valueGetter({ data: row } as ValueGetterParams)
  if (c.field) return row[c.field]
  return undefined
}

/** Nilai satu sel untuk ekspor: valueGetter/field, lalu valueFormatter —
 *  KECUALI kolom angka (cellClass tabular-nums): diekspor sebagai angka
 *  mentah supaya bisa di-SUM di Excel, bukan teks "Rp 173.540". */
export function nilaiEkspor(c: ColDef, row: BarisData): unknown {
  const v = bacaNilai(c, row)

  const kolomAngka =
    typeof c.cellClass === "string" && c.cellClass.includes("tabular-nums")
  if (typeof v === "number" && kolomAngka) return v
  if (typeof c.valueFormatter === "function") {
    return c.valueFormatter({ value: v, data: row } as ValueFormatterParams)
  }
  if (v === null || v === undefined) return ""
  if (typeof v === "object") return ""
  return v
}

/** Nilai satu sel sebagai TEKS siap tampil (mode kartu di ponsel). Sengaja
 *  lewat valueGetter/valueFormatter yang sudah ada di tiap colDef, bukan lewat
 *  cellRenderer-nya: renderer ditulis untuk sel setinggi 42px (titik status,
 *  lencana) dan hasilnya tidak selalu waras ditumpuk di dalam kartu. */
export function teksSel(c: ColDef, row: BarisData): string {
  const v = bacaNilai(c, row)

  if (typeof c.valueFormatter === "function") {
    const hasil = c.valueFormatter({
      value: v,
      data: row,
    } as ValueFormatterParams)
    return typeof hasil === "string" ? hasil : ""
  }
  if (v === null || v === undefined) return "—"
  if (typeof v === "number") return v.toLocaleString("id-ID")
  if (typeof v === "object") return "—"
  return String(v)
}
