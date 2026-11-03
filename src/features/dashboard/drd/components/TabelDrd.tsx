"use client"

import * as React from "react"
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  Download01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/Utilitas"
import { formatRupiah } from "@/features/public/lib/Format"
import { ambilList, ApiError } from "@/features/dashboard/api/ApiDashboard"
import { LABEL_KONDISI_CATAT } from "@/features/dashboard/lib/LabelPencatatan"
import { KELAS_KONTROL } from "@/features/dashboard/shared/data-grid/KelasKontrol"
import { KotakCari } from "@/features/dashboard/shared/data-grid/toolbar/KotakCari"
import { BilahDrd } from "./BilahDrd"
import {
  DAFTAR_TARIF_DRD,
  type RingkasanDrd,
  type TabDataDrd,
} from "../types/TipeDrd"

export interface DefinisiKolomDrd {
  id: string
  label: string
  minWidth: number
  align?: "left" | "right"
  mono?: boolean
  pinned?: boolean
  sortable?: boolean
  format?: (nilai: unknown, baris: Record<string, unknown>) => React.ReactNode
  formatCsv?: (
    nilai: unknown,
    baris: Record<string, unknown>
  ) => string | number
}

const fmtAngka = (v: unknown) =>
  typeof v === "number"
    ? v.toLocaleString("id-ID")
    : v != null && v !== ""
      ? Number(v).toLocaleString("id-ID")
      : "0"

const fmtRp = (v: unknown) =>
  typeof v === "number"
    ? formatRupiah(v)
    : v != null && v !== ""
      ? formatRupiah(Number(v))
      : "Rp 0"

const KOLOM_KELURAHAN: DefinisiKolomDrd[] = [
  { id: "kelurahan", label: "Kelurahan", minWidth: 240, sortable: true },
  {
    id: "jumlahPelanggan",
    label: "Pelanggan",
    minWidth: 140,
    align: "right",
    sortable: true,
    format: fmtAngka,
  },
  {
    id: "pemakaianM3",
    label: "Pemakaian (m³)",
    minWidth: 160,
    align: "right",
    sortable: true,
    format: fmtAngka,
  },
  {
    id: "totalTagihan",
    label: "Total tagihan",
    minWidth: 180,
    align: "right",
    sortable: true,
    format: fmtRp,
  },
]

const KOLOM_DOMESTIK: DefinisiKolomDrd[] = [
  { id: "tarif", label: "Tarif", minWidth: 100, mono: true, sortable: true },
  { id: "namaTarif", label: "Nama tarif", minWidth: 260, sortable: true },
  {
    id: "jumlahPelanggan",
    label: "Pelanggan",
    minWidth: 140,
    align: "right",
    sortable: true,
    format: fmtAngka,
  },
  {
    id: "pemakaianM3",
    label: "Pemakaian (m³)",
    minWidth: 160,
    align: "right",
    sortable: true,
    format: fmtAngka,
  },
  {
    id: "totalTagihan",
    label: "Total tagihan",
    minWidth: 180,
    align: "right",
    sortable: true,
    format: fmtRp,
  },
]

const KOLOM_TARIF = KOLOM_DOMESTIK

const KOLOM_TAA_KELURAHAN: DefinisiKolomDrd[] = [
  { id: "kelurahan", label: "Kelurahan", minWidth: 240, sortable: true },
  {
    id: "jumlahPelanggan",
    label: "Pelanggan TAA",
    minWidth: 160,
    align: "right",
    sortable: true,
    format: fmtAngka,
  },
  {
    id: "pemakaianM3",
    label: "Pemakaian (m³)",
    minWidth: 160,
    align: "right",
    sortable: true,
    format: fmtAngka,
  },
  {
    id: "totalTagihan",
    label: "Total tagihan",
    minWidth: 180,
    align: "right",
    sortable: true,
    format: fmtRp,
  },
]

const KOLOM_CAKUPAN: DefinisiKolomDrd[] = [
  {
    id: "kelurahan",
    label: "Kelurahan",
    minWidth: 200,
    pinned: true,
    sortable: true,
  },
  ...DAFTAR_TARIF_DRD.flatMap(({ kode, label }) => [
    {
      id: `sl_${kode}`,
      label: `${label} · SL`,
      minWidth: 110,
      align: "right" as const,
      sortable: true,
      format: fmtAngka,
    },
    {
      id: `pemakaianM3_${kode}`,
      label: `${label} · m³`,
      minWidth: 115,
      align: "right" as const,
      sortable: true,
      format: fmtAngka,
    },
    {
      id: `totalTagihan_${kode}`,
      label: `${label} · DRD`,
      minWidth: 135,
      align: "right" as const,
      sortable: true,
      format: fmtRp,
    },
  ]),
  {
    id: "sl_TANPA_TARIF",
    label: "Tanpa tarif · SL",
    minWidth: 130,
    align: "right" as const,
    sortable: true,
    format: fmtAngka,
  },
  {
    id: "pemakaianM3_TANPA_TARIF",
    label: "Tanpa tarif · m³",
    minWidth: 130,
    align: "right" as const,
    sortable: true,
    format: fmtAngka,
  },
  {
    id: "totalTagihan_TANPA_TARIF",
    label: "Tanpa tarif · DRD",
    minWidth: 140,
    align: "right" as const,
    sortable: true,
    format: fmtRp,
  },
]

const KOLOM_PELANGGAN: DefinisiKolomDrd[] = [
  {
    id: "nomorLangganan",
    label: "No. langganan",
    minWidth: 140,
    mono: true,
    sortable: true,
  },
  { id: "nama", label: "Nama", minWidth: 200, sortable: true },
  { id: "alamat", label: "Alamat", minWidth: 260, sortable: true },
  { id: "tarif", label: "Tarif", minWidth: 90, mono: true, sortable: true },
  { id: "kelurahan", label: "Kelurahan", minWidth: 160, sortable: true },
  {
    id: "pemakaianM3",
    label: "Pemakaian (m³)",
    minWidth: 150,
    align: "right",
    sortable: true,
    format: fmtAngka,
  },
  {
    id: "totalTagihan",
    label: "Total tagihan",
    minWidth: 180,
    align: "right",
    sortable: true,
    format: fmtRp,
  },
]

const KOLOM_TAA: DefinisiKolomDrd[] = [
  ...KOLOM_PELANGGAN.slice(0, 5),
  {
    id: "kondisi",
    label: "Keterangan",
    minWidth: 170,
    sortable: true,
    format: (v) => (v ? (LABEL_KONDISI_CATAT[String(v)] ?? String(v)) : "—"),
  },
  KOLOM_PELANGGAN[5]!,
  KOLOM_PELANGGAN[6]!,
]

const KOLOM_TAGIHAN: DefinisiKolomDrd[] = [
  ...KOLOM_PELANGGAN.slice(0, 5),
  {
    id: "hargaAir",
    label: "Harga air",
    minWidth: 140,
    align: "right",
    sortable: true,
    format: fmtRp,
  },
  {
    id: "beaBeban",
    label: "Bea beban",
    minWidth: 130,
    align: "right",
    sortable: true,
    format: fmtRp,
  },
  {
    id: "beaAdmin",
    label: "Bea admin",
    minWidth: 130,
    align: "right",
    sortable: true,
    format: fmtRp,
  },
  {
    id: "airKotor",
    label: "Air kotor",
    minWidth: 130,
    align: "right",
    sortable: true,
    format: fmtRp,
  },
  {
    id: "lainLain",
    label: "Lain-lain",
    minWidth: 130,
    align: "right",
    sortable: true,
    format: fmtRp,
  },
  {
    id: "totalTagihan",
    label: "Total tagihan",
    minWidth: 180,
    align: "right",
    sortable: true,
    format: fmtRp,
  },
]

const KOLOM_TAB: Record<TabDataDrd, DefinisiKolomDrd[]> = {
  kelurahan: KOLOM_KELURAHAN,
  domestik: KOLOM_DOMESTIK,
  tarif: KOLOM_TARIF,
  "taa-kelurahan": KOLOM_TAA_KELURAHAN,
  cakupan: KOLOM_CAKUPAN,
  taa: KOLOM_TAA,
  tagihan: KOLOM_TAGIHAN,
  pelanggan: KOLOM_PELANGGAN,
}

const PILIHAN_UKURAN = [50, 100, 200, 500, 1000] as const

export interface TabelDrdProps {
  tab: TabDataDrd
  periode: number
  periodes: number[]
  ringkasan: RingkasanDrd | null
  memuatPeriode: boolean
  onGantiPeriode: (periode: number) => void
}

export function TabelDrd({
  tab,
  periode,
  periodes,
  ringkasan,
  memuatPeriode,
  onGantiPeriode,
}: TabelDrdProps) {
  const wadahRef = React.useRef<HTMLDivElement>(null)
  const [cari, setCari] = React.useState("")
  const [cariDebounced, setCariDebounced] = React.useState("")
  const [pageSize, setPageSize] = React.useState<number>(100)
  const [page, setPage] = React.useState<number>(1)
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([])
  const [total, setTotal] = React.useState<number>(0)
  const [memuat, setMemuat] = React.useState<boolean>(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [sortir, setSortir] = React.useState<{
    kolom: string
    arah: "asc" | "desc"
  } | null>(null)

  // Debounce input pencarian
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCariDebounced(cari)
    }, 350)
    return () => clearTimeout(timer)
  }, [cari])

  // Reset page dan sortir saat tab, periode, atau pencarian berubah
  React.useEffect(() => {
    setPage(1)
    setSortir(null)
  }, [tab, periode, cariDebounced])

  // Ambil data dari server
  React.useEffect(() => {
    let batal = false
    setMemuat(true)
    setGalat(null)

    ambilList<Record<string, unknown>>("/drd/data", {
      periode,
      tab,
      page,
      pageSize,
      q: cariDebounced.trim() || undefined,
    })
      .then(({ rows: dataRows, total: dataTotal }) => {
        if (batal) return
        setRows(dataRows)
        setTotal(dataTotal)
      })
      .catch((err) => {
        if (batal) return
        setGalat(
          err instanceof ApiError ? err.message : "Gagal memuat data DRD."
        )
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })

    return () => {
      batal = true
    }
  }, [periode, tab, page, pageSize, cariDebounced])

  const kolomTampil = KOLOM_TAB[tab] ?? KOLOM_PELANGGAN

  const rowsTerurut = React.useMemo(() => {
    if (!sortir) return rows
    return [...rows].sort((a, b) => {
      const left = a[sortir.kolom]
      const right = b[sortir.kolom]
      if (left == null && right == null) return 0
      if (left == null) return 1
      if (right == null) return -1
      const compare =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "id", {
              numeric: true,
              sensitivity: "base",
            })
      return sortir.arah === "asc" ? compare : -compare
    })
  }, [rows, sortir])

  function ubahSort(kolom: string) {
    setSortir((sekarang) => {
      if (sekarang?.kolom === kolom) {
        if (sekarang.arah === "asc") return { kolom, arah: "desc" }
        return null
      }
      return { kolom, arah: "asc" }
    })
  }

  function eksporCsv() {
    if (rowsTerurut.length === 0) return
    const header = kolomTampil
      .map((k) => `"${k.label.replace(/"/g, '""')}"`)
      .join(";")
    const data = rowsTerurut.map((row) =>
      kolomTampil
        .map((k) => {
          const raw = row[k.id]
          const val = k.formatCsv
            ? k.formatCsv(raw, row)
            : raw !== null && raw !== undefined
              ? raw
              : ""
          return `"${String(val).replace(/"/g, '""')}"`
        })
        .join(";")
    )
    const csv = [header, ...data].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `drd-${tab}-${periode}-${rowsTerurut.length}baris.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const totalHalaman = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
      {/* Toolbar mengikuti pola halaman verifikasi */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <KotakCari
            nilai={cari}
            onUbah={setCari}
            placeholder="Cari data DRD…"
          />
          <BilahDrd
            periodes={periodes}
            periode={periode}
            ringkasan={ringkasan}
            memuat={memuatPeriode}
            onGanti={onGantiPeriode}
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {memuat
              ? "Memuat…"
              : total === 0
                ? "0 baris"
                : `${rows.length.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")} baris`}
          </span>

          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v))
              setPage(1)
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label="Baris per halaman"
              className={KELAS_KONTROL}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {PILIHAN_UKURAN.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n.toLocaleString("id-ID")} baris
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {totalHalaman > 1 && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || memuat}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="size-8 p-0"
                aria-label="Halaman sebelumnya"
              >
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  strokeWidth={2}
                  className="size-3.5"
                />
              </Button>
              <span className="px-1 text-xs text-muted-foreground tabular-nums">
                {page} / {totalHalaman}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalHalaman || memuat}
                onClick={() => setPage((p) => Math.min(totalHalaman, p + 1))}
                className="size-8 p-0"
                aria-label="Halaman berikutnya"
              >
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  className="size-3.5"
                />
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={eksporCsv}
            disabled={memuat || rows.length === 0}
            className="h-8 gap-1.5 px-2.5 text-xs font-normal"
          >
            <HugeiconsIcon
              icon={Download01Icon}
              strokeWidth={2}
              className="size-3.5"
              aria-hidden
            />
            Ekspor CSV
          </Button>
        </div>
      </div>

      {galat && (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription className="text-xs">{galat}</AlertDescription>
        </Alert>
      )}

      {/* Kontainer tabel dengan gaya dan struktur persis TabelVerifikasi */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-card">
        <div
          ref={wadahRef}
          className="scrollbar-tipis relative min-h-0 min-w-0 flex-1 overflow-auto"
        >
          <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-sm [&_td]:py-2.5">
            <colgroup>
              {kolomTampil.map((kol) => (
                <col
                  key={kol.id}
                  style={{ width: kol.minWidth, minWidth: kol.minWidth }}
                />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted/95 text-muted-foreground supports-backdrop-filter:bg-muted/85 [&>th]:border-r [&>th]:border-b [&>th]:border-border [&>th]:px-3 [&>th]:py-3 [&>th]:text-left [&>th]:text-xs [&>th]:leading-4 [&>th]:font-medium [&>th]:tracking-wide [&>th]:whitespace-nowrap [&>th]:backdrop-blur [&>th:last-child]:border-r-0">
                {kolomTampil.map((kol) => {
                  const aktifSort = sortir?.kolom === kol.id
                  return (
                    <th
                      key={kol.id}
                      className={cn(
                        kol.pinned &&
                          "sticky left-0 z-30 bg-muted/95 backdrop-blur supports-backdrop-filter:bg-muted/85",
                        "relative select-none"
                      )}
                      style={{ width: kol.minWidth, minWidth: kol.minWidth }}
                    >
                      {kol.sortable ? (
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-1",
                            kol.align === "right"
                              ? "justify-end"
                              : "justify-start"
                          )}
                          onClick={() => ubahSort(kol.id)}
                          title={`Urutkan ${kol.label}`}
                        >
                          <span>{kol.label}</span>
                          <HugeiconsIcon
                            icon={
                              aktifSort
                                ? sortir.arah === "asc"
                                  ? ArrowUp01Icon
                                  : ArrowDown01Icon
                                : ArrowUpDownIcon
                            }
                            strokeWidth={2}
                            className="size-3 shrink-0 opacity-60"
                            aria-hidden
                          />
                        </button>
                      ) : (
                        <div
                          className={cn(
                            "flex w-full items-center",
                            kol.align === "right"
                              ? "justify-end"
                              : "justify-start"
                          )}
                        >
                          <span>{kol.label}</span>
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rowsTerurut.map((row, i) => {
                const barisId = (row.id as string) ?? String(i)
                return (
                  <tr
                    key={barisId}
                    className="group hover:bg-(--hover-baris) [&>td]:border-r [&>td]:border-b [&>td]:border-border [&>td]:px-3 [&>td]:whitespace-nowrap [&>td:last-child]:border-r-0"
                  >
                    {kolomTampil.map((kol) => {
                      const nilai = row[kol.id]
                      return (
                        <td
                          key={kol.id}
                          className={cn(
                            kol.pinned &&
                              "sticky left-0 z-10 bg-card group-hover:bg-(--hover-baris)",
                            kol.align === "right" && "text-right tabular-nums",
                            kol.mono && "font-mono"
                          )}
                        >
                          {kol.format
                            ? kol.format(nilai, row)
                            : nilai != null
                              ? String(nilai)
                              : "—"}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {rows.length === 0 && !memuat && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Tidak ada data DRD yang cocok dengan saringan ini.
            </p>
          )}
          {memuat && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Memuat data DRD…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
