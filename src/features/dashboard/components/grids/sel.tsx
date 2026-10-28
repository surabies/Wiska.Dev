"use client";

// features/dashboard/components/grids/sel.tsx — renderer & formatter sel
// yang dipakai lintas grid. Grammar visual sama dengan halaman publik:
// titik status berwarna, angka mono tabular, label enum Indonesia.
import type {
  ICellRendererParams,
  ValueFormatterParams,
} from "ag-grid-community";
import {
  formatPeriode,
  formatRupiah,
  formatTanggal,
} from "@/features/public/lib/format";

export type Nada = "hijau" | "amber" | "merah" | "biru" | "netral";

const WARNA_DOT: Record<Nada, string> = {
  hijau: "bg-emerald-500",
  amber: "bg-amber-500",
  merah: "bg-red-500",
  biru: "bg-blue-500",
  netral: "bg-muted-foreground",
};

const WARNA_TEKS: Record<Nada, string> = {
  hijau: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-700 dark:text-amber-400",
  merah: "text-red-600 dark:text-red-400",
  biru: "text-blue-600 dark:text-blue-400",
  netral: "text-muted-foreground",
};

/** Pabrik cell renderer status: titik warna + label. */
export function selStatus(peta: Record<string, { label: string; nada: Nada }>) {
  return function StatusCell(p: ICellRendererParams) {
    const nilai = p.value as string | null | undefined;
    if (!nilai) return null;
    const cfg = peta[nilai] ?? { label: nilai, nada: "netral" as Nada };
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`inline-block size-1.5 shrink-0 ${WARNA_DOT[cfg.nada]}`}
        />
        <span className={`text-xs font-medium ${WARNA_TEKS[cfg.nada]}`}>
          {cfg.label}
        </span>
      </span>
    );
  };
}

/** Sel boolean ya/tidak dengan titik status. */
export function selBool(
  labelYa: string,
  labelTidak: string,
  nadaYa: Nada = "hijau",
  nadaTidak: Nada = "netral",
) {
  return function BoolCell(p: ICellRendererParams) {
    if (p.value === undefined || p.value === null) return null;
    const ya = Boolean(p.value);
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`inline-block size-1.5 shrink-0 ${WARNA_DOT[ya ? nadaYa : nadaTidak]}`}
        />
        <span
          className={`text-xs font-medium ${WARNA_TEKS[ya ? nadaYa : nadaTidak]}`}
        >
          {ya ? labelYa : labelTidak}
        </span>
      </span>
    );
  };
}

// ============ valueFormatter (murni string, tanpa React) ============

export function fmtRupiah(p: ValueFormatterParams): string {
  return typeof p.value === "number" ? formatRupiah(p.value) : "";
}

/** ISO date string / Date -> "1 Juni 2026". */
export function fmtTanggal(p: ValueFormatterParams): string {
  if (!p.value) return "—";
  const iso = p.value instanceof Date ? p.value.toISOString() : String(p.value);
  return formatTanggal(iso);
}

/** periode Int thbl (202605) -> "Mei 2026". */
export function fmtPeriodeInt(p: ValueFormatterParams): string {
  return typeof p.value === "number" ? formatPeriode(p.value) : "";
}

/** periode DateTime ISO ("2026-05-01T00:00:00Z") -> "Mei 2026". */
export function fmtPeriodeIso(p: ValueFormatterParams): string {
  if (!p.value) return "";
  const d = new Date(p.value as string);
  if (Number.isNaN(d.getTime())) return "";
  return formatPeriode(d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1));
}

export function fmtLabel(peta: Record<string, string>) {
  return (p: ValueFormatterParams): string => {
    const nilai = p.value as string | null | undefined;
    if (!nilai) return "—";
    return peta[nilai] ?? nilai;
  };
}

export function fmtAngka(p: ValueFormatterParams): string {
  return typeof p.value === "number" ? p.value.toLocaleString("id-ID") : "";
}

/** Boolean -> label teks (dipakai bersama cellRenderer selBool supaya nilai
 *  ekspor Excel-nya terbaca, bukan true/false). */
export function fmtBool(labelYa: string, labelTidak: string) {
  return (p: ValueFormatterParams): string => {
    if (p.value === null || p.value === undefined) return "";
    return p.value ? labelYa : labelTidak;
  };
}

/** Kelas sel angka: mono + rata kanan (dipakai di colDef.cellClass). */
export const KELAS_ANGKA = "font-mono tabular-nums tracking-tight text-right";
export const KELAS_MONO = "font-mono tabular-nums tracking-tight";
