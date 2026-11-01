"use client"

// features/dashboard/verifikasi/components/TabelVerifikasi.tsx — tabel
// khusus layar verifikasi (kotak centang + aksi massal, pewarnaan per ring,
// ribuan baris, kolom beku, navigasi papan ketik).
//
// Urutan dan makna kolom mengikuti kontrak tabel verifikasi di dokumentasi.
//
// PENAMAAN HEADER ringkas, mengikuti header tabel.md dan istilah PDAM; nama
// panjangnya ada di tooltip (atribut title) tiap header.
//
// GULIR MENDATAR: `w-max min-w-full` (tumbuh mengikuti isi, tidak pernah lebih
// sempit dari wadah) dan seluruh rantai induk wajib `min-w-0`.
//
// KOLOM RING dua mode: "berjenjang" (Petugas) = chip kecil berwarna V1/V2/V3 —
// V3 diperlakukan SAMA dengan V1 dan V2 (tanpa ikon ceklis tambahan);
// "tunggal" (Pelanggan) = satu ikon penanda status.

import * as React from "react"
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Columns3CogIcon,
  Clock01Icon,
  Drag01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ToggleGroupItem } from "@/components/ui/toggle-group"
import { LABEL_KONDISI_CATAT } from "../../lib/LabelPencatatan"
import {
  GAYA_TAHAP,
  GAYA_BELUM_DIBACA,
  gayaAnomali,
  tahapDari,
  type Tahap,
} from "../types/WarnaTahap"
import { tentukanHasilPembacaan } from "../lib/HasilPembacaan"
import {
  type KolomVerifikasi,
  type PreferensiKolom,
  ubahLebarKolom,
} from "../lib/PreferensiKolom"
import type {
  BarisVerifikasi,
  Kerapatan,
  ModeRing,
} from "../types/TipeVerifikasi"

const angka = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("id-ID")

const tanggal = (s: string | null | undefined) => {
  if (!s) return "—"
  const d = new Date(s)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
}

function Lencana({ kelas, anak }: { kelas: string; anak: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${kelas}`}
    >
      {anak}
    </span>
  )
}

const TEKS_CHIP: Record<Tahap, string> = {
  MENUNGGU: "—",
  V1: "V1",
  V2: "V2",
  TERVERIFIKASI: "M",
  V3: "V3",
  DITOLAK: "Cek",
}

function ChipRing({ tahap }: { tahap: Tahap }) {
  const gaya = GAYA_TAHAP[tahap]
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-semibold whitespace-nowrap ${gaya.lencana}`}
      aria-label={`Tahap ${gaya.label}`}
    >
      <span className={`size-2 rounded-full ${gaya.titik}`} aria-hidden />
      {tahap === "DITOLAK" && (
        <HugeiconsIcon
          icon={Alert02Icon}
          strokeWidth={2}
          className="size-3"
          aria-hidden
        />
      )}
      {TEKS_CHIP[tahap]}
    </span>
  )
}

const IKON_TUNGGAL = {
  MENUNGGU: Clock01Icon,
  V1: Clock01Icon,
  V2: Clock01Icon,
  TERVERIFIKASI: CheckmarkCircle02Icon,
  V3: CheckmarkCircle02Icon,
  DITOLAK: CancelCircleIcon,
} as const
const LABEL_TUNGGAL: Record<Tahap, string> = {
  MENUNGGU: "Menunggu verifikasi",
  V1: "Menunggu verifikasi",
  V2: "Menunggu verifikasi",
  TERVERIFIKASI: "Laporan Mandiri terverifikasi; belum menjadi pembacaan resmi",
  V3: "Sudah terverifikasi",
  DITOLAK: "Ditolak / cek ulang",
}

function IkonRingTunggal({ tahap }: { tahap: Tahap }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-grid size-6 place-items-center rounded-md ${GAYA_TAHAP[tahap].lencana}`}
          aria-label={LABEL_TUNGGAL[tahap]}
        >
          <HugeiconsIcon
            icon={IKON_TUNGGAL[tahap]}
            strokeWidth={2}
            className="size-3.5"
            aria-hidden
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{LABEL_TUNGGAL[tahap]}</TooltipContent>
    </Tooltip>
  )
}

const L_CEKLIS = 40
const DEFINISI_KOLOM: {
  id: KolomVerifikasi
  label: string
  title: string
  minWidth: number
  numeric?: boolean
}[] = [
  { id: "ring", label: "Ring", title: "Tahap verifikasi", minWidth: 76 },
  {
    id: "nomor",
    label: "No. Pel",
    title: "Nomor pelanggan (langganan)",
    minWidth: 132,
  },
  { id: "nama", label: "Nama", title: "Nama pelanggan", minWidth: 220 },
  { id: "alamat", label: "Alamat", title: "Alamat pelanggan", minWidth: 280 },
  {
    id: "standAwal",
    label: "ST Awal",
    title: "Stand awal aktif",
    minWidth: 88,
    numeric: true,
  },
  {
    id: "standAkhir",
    label: "ST Akhir",
    title: "Stand akhir hasil catat petugas / laporan pelanggan",
    minWidth: 88,
    numeric: true,
  },
  {
    id: "standRevisi",
    label: "ST Revisi",
    title: "Stand awal hasil revisi",
    minWidth: 88,
    numeric: true,
  },
  {
    id: "standResmi",
    label: "ST Resmi",
    title: "Stand akhir resmi setelah diverifikasi",
    minWidth: 96,
    numeric: true,
  },
  {
    id: "pakai",
    label: "Pakai",
    title: "Pemakaian periode ini (m³)",
    minWidth: 72,
    numeric: true,
  },
  {
    id: "lalu",
    label: "Lalu",
    title: "Pemakaian bulan sebelumnya (m³)",
    minWidth: 72,
    numeric: true,
  },
  {
    id: "tagihan",
    label: "Tagihan",
    title: "Pemakaian tagihan dalam m³",
    minWidth: 88,
    numeric: true,
  },
  {
    id: "deviasi",
    label: "Dev %",
    title: "Deviasi pemakaian terhadap bulan lalu",
    minWidth: 84,
    numeric: true,
  },
  { id: "rute", label: "Rute", title: "Kode rute pembacaan", minWidth: 84 },
  {
    id: "kondisi",
    label: "Ket Catat",
    title: "Keterangan saat pencatatan",
    minWidth: 140,
  },
  { id: "petugas", label: "Petugas", title: "Petugas pencatat", minWidth: 130 },
  {
    id: "tanggal",
    label: "Tgl Catat",
    title: "Tanggal dan waktu catat",
    minWidth: 155,
  },
  {
    id: "status",
    label: "Status",
    title: "Status proses verifikasi",
    minWidth: 116,
  },
]

export function KontrolKolomVerifikasi({
  preferensi,
  onVisibilitas,
  onPindah,
  onReset,
}: {
  preferensi: PreferensiKolom
  onVisibilitas: (kolom: KolomVerifikasi, tampil: boolean) => void
  onPindah: (dari: KolomVerifikasi, ke: KolomVerifikasi) => void
  onReset: () => void
}) {
  const dragged = React.useRef<KolomVerifikasi | null>(null)

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <ToggleGroupItem
              value="kolom-verifikasi"
              aria-label="Atur kolom tabel"
            >
              <HugeiconsIcon
                icon={Columns3CogIcon}
                strokeWidth={2}
                className="size-4"
                aria-hidden
              />
            </ToggleGroupItem>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Atur kolom tabel</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Kolom tabel</PopoverTitle>
        </PopoverHeader>
        <div className="scrollbar-tipis max-h-80 overflow-y-auto">
          {preferensi.urutan.map((id, index) => {
            const kolom = DEFINISI_KOLOM.find((item) => item.id === id)
            if (!kolom) return null
            return (
              <div
                key={id}
                draggable
                onDragStart={(event) => {
                  dragged.current = id
                  event.dataTransfer.effectAllowed = "move"
                  event.dataTransfer.setData("text/plain", id)
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const dari = dragged.current
                  if (dari) onPindah(dari, id)
                  dragged.current = null
                }}
                onDragEnd={() => {
                  dragged.current = null
                }}
                className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent"
              >
                <span
                  aria-hidden
                  className="cursor-grab text-muted-foreground select-none"
                  title="Seret"
                >
                  <HugeiconsIcon
                    icon={Drag01Icon}
                    strokeWidth={2}
                    className="size-4"
                    aria-hidden
                  />
                </span>
                <Checkbox
                  id={`kolom-verifikasi-${id}`}
                  checked={preferensi.tampil[id]}
                  onCheckedChange={(checked) =>
                    onVisibilitas(id, checked === true)
                  }
                />
                <label
                  htmlFor={`kolom-verifikasi-${id}`}
                  className="min-w-0 flex-1 cursor-pointer text-sm"
                >
                  {kolom.label}
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      aria-label={`Pindahkan ${kolom.label} ke atas`}
                      disabled={index === 0}
                      onClick={() =>
                        onPindah(id, preferensi.urutan[index - 1]!)
                      }
                    >
                      <HugeiconsIcon
                        icon={ArrowUp01Icon}
                        strokeWidth={2}
                        className="size-4"
                        aria-hidden
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Pindahkan ke atas</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      aria-label={`Pindahkan ${kolom.label} ke bawah`}
                      disabled={index === preferensi.urutan.length - 1}
                      onClick={() =>
                        onPindah(id, preferensi.urutan[index + 1]!)
                      }
                    >
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        strokeWidth={2}
                        className="size-4"
                        aria-hidden
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Pindahkan ke bawah</TooltipContent>
                </Tooltip>
              </div>
            )
          })}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="sm" onClick={onReset}>
              Kembalikan pengaturan awal
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset kolom dan urutan</TooltipContent>
        </Tooltip>
      </PopoverContent>
    </Popover>
  )
}

function statusLabel(
  row: BarisVerifikasi,
  tahap: Tahap,
  modeBelumDibaca: boolean,
  modeRing: ModeRing
): string {
  if (modeBelumDibaca) return "Belum dibaca"
  if (row.laporanMandiriTerverifikasi) return "Terverifikasi"
  if (modeRing === "tunggal") {
    if (row.status === "DITOLAK") return "Perlu Review"
    if (row.status === "DIVERIFIKASI" || row.status === "DIGUNAKAN")
      return "Disetujui"
    return "Pending"
  }
  if (tahap === "V3") return "Disetujui"
  if (tahap === "DITOLAK") return "Perlu Review"
  return "Pending"
}

function statusKelas(label: string): string {
  if (label === "Disetujui") {
    return "bg-green-500/10 text-green-700 ring-1 ring-inset ring-green-500/25 dark:text-green-400"
  }
  if (label === "Terverifikasi") {
    return "bg-blue-500/10 text-blue-700 ring-1 ring-inset ring-blue-500/25 dark:text-blue-400"
  }
  if (label === "Perlu Review") {
    return "bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/25 dark:text-red-400"
  }
  if (label === "Belum dibaca") return GAYA_BELUM_DIBACA.lencana
  return "bg-neutral-500/10 text-neutral-700 ring-1 ring-inset ring-neutral-500/20 dark:text-neutral-300"
}

export function TabelVerifikasi({
  rows,
  terpilih,
  onToggle,
  onToggleSemua,
  idTerpilih,
  onKlikBaris,
  onKlikKanan,
  ambangAnomali,
  modeBelumDibaca = false,
  modeRing = "berjenjang",
  memuat,
  kerapatan = "normal",
  pesanKosong,
  preferensiKolom,
  onLebarKolom,
  onPindahKolom,
}: {
  rows: BarisVerifikasi[]
  terpilih: Set<string>
  onToggle: (id: string, rentangDariShift: boolean, indeks: number) => void
  onToggleSemua: (pilih: boolean) => void
  idTerpilih: string | null
  onKlikBaris: (row: BarisVerifikasi) => void
  onKlikKanan: (row: BarisVerifikasi, posisi: { x: number; y: number }) => void
  ambangAnomali: number
  modeBelumDibaca?: boolean
  /** "tunggal" = laporan mandiri (satu ring): ikon penanda, bukan chip V1–V3. */
  modeRing?: ModeRing
  memuat: boolean
  kerapatan?: Kerapatan
  /** Menggantikan teks keadaan-kosong bawaan. */
  pesanKosong?: React.ReactNode
  preferensiKolom: PreferensiKolom
  onLebarKolom: (kolom: KolomVerifikasi, lebar: number) => void
  onPindahKolom: (dari: KolomVerifikasi, ke: KolomVerifikasi) => void
}) {
  const semuaTerpilih = rows.length > 0 && rows.every((r) => terpilih.has(r.id))
  const sebagianTerpilih =
    !semuaTerpilih && rows.some((r) => terpilih.has(r.id))
  const wadahRef = React.useRef<HTMLDivElement>(null)
  const [sortir, setSortir] = React.useState<{
    kolom: KolomVerifikasi
    arah: "asc" | "desc"
  } | null>(null)
  const [lebarSementara, setLebarSementara] = React.useState<{
    kolom: KolomVerifikasi
    lebar: number
  } | null>(null)
  const resizeRef = React.useRef<{
    kolom: KolomVerifikasi
    x: number
    lebar: number
    pointerId: number
  } | null>(null)
  const kolomDiseret = React.useRef<KolomVerifikasi | null>(null)

  const kolomTampil = preferensiKolom.urutan
    .filter((id) => preferensiKolom.tampil[id])
    .filter(
      (id) =>
        !modeBelumDibaca ||
        ![
          "standAwal",
          "standAkhir",
          "standRevisi",
          "standResmi",
          "pakai",
          "lalu",
          "tagihan",
          "deviasi",
          "kondisi",
          "tanggal",
        ].includes(id)
    )
  const rowsTerurut = React.useMemo(() => {
    if (!sortir) return rows.map((row, index) => ({ row, index }))
    const rankTahap: Record<Tahap, number> = {
      MENUNGGU: 0,
      V1: 1,
      V2: 2,
      TERVERIFIKASI: 3,
      V3: 4,
      DITOLAK: 5,
    }
    const nilai = (row: BarisVerifikasi): string | number | null => {
      const tahap = tahapDari(row)
      const { standAwal, standAkhir, pemakaian } = tentukanHasilPembacaan(row)
      switch (sortir.kolom) {
        case "ring":
          return rankTahap[tahap]
        case "status":
          return statusLabel(row, tahap, modeBelumDibaca, modeRing)
        case "nomor":
          return row.nomorLangganan ?? row.pelanggan?.nomorLangganan ?? null
        case "nama":
          return row.pelanggan?.nama ?? row.namaPelanggan ?? null
        case "alamat":
          return row.pelanggan?.alamat ?? row.alamatPelanggan ?? null
        case "standAwal":
          return standAwal
        case "standAkhir":
          return standAkhir
        case "standRevisi":
          return row.standAwalRevisi ?? null
        case "standResmi":
          return row.pembacaan?.standAkhir ?? null
        case "pakai":
          return pemakaian
        case "lalu":
          return row.pemakaianLalu ?? row.pembacaan?.pemakaianLalu ?? null
        case "tagihan":
          return row.verif3At != null || row.pembacaan != null
            ? (row.pemakaianTagihVerif ?? row.pembacaan?.pemakaianM3 ?? null)
            : null
        case "deviasi":
          return row.persentase ?? null
        case "rute":
          return row.pelanggan?.rute?.kode ?? null
        case "kondisi":
          return row.kondisi
            ? (LABEL_KONDISI_CATAT[row.kondisi] ?? row.kondisi)
            : null
        case "petugas":
          return row.pencatat?.namaLapangan ?? null
        case "tanggal":
          return row.tanggalCatat ? new Date(row.tanggalCatat).getTime() : null
      }
    }
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const left = nilai(a.row)
        const right = nilai(b.row)
        if (left == null && right == null) return a.index - b.index
        if (left == null) return 1
        if (right == null) return -1
        const compare =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right), "id", {
                numeric: true,
                sensitivity: "base",
              })
        return (sortir.arah === "asc" ? compare : -compare) || a.index - b.index
      })
  }, [modeBelumDibaca, modeRing, rows, sortir])

  function ubahSort(kolom: KolomVerifikasi) {
    setSortir((sekarang) => ({
      kolom,
      arah:
        sekarang?.kolom === kolom && sekarang.arah === "asc" ? "desc" : "asc",
    }))
  }

  function mulaiResize(
    event: React.PointerEvent<HTMLButtonElement>,
    kolom: KolomVerifikasi
  ) {
    event.preventDefault()
    event.stopPropagation()
    const lebar = preferensiKolom.lebar[kolom]
    resizeRef.current = {
      kolom,
      x: event.clientX,
      lebar,
      pointerId: event.pointerId,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function gerakResize(event: React.PointerEvent<HTMLButtonElement>) {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const minWidth =
      DEFINISI_KOLOM.find((column) => column.id === resize.kolom)?.minWidth ??
      48
    setLebarSementara({
      kolom: resize.kolom,
      lebar: Math.max(
        minWidth,
        Math.min(800, resize.lebar + event.clientX - resize.x)
      ),
    })
  }

  function selesaiResize(event: React.PointerEvent<HTMLButtonElement>) {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const minWidth =
      DEFINISI_KOLOM.find((column) => column.id === resize.kolom)?.minWidth ??
      48
    const lebar = Math.max(
      minWidth,
      Math.min(800, resize.lebar + event.clientX - resize.x)
    )
    onLebarKolom(resize.kolom, lebar)
    resizeRef.current = null
    setLebarSementara(null)
  }

  function batalResize(event: React.PointerEvent<HTMLButtonElement>) {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    resizeRef.current = null
    setLebarSementara(null)
  }

  function ubahLebarDenganKeyboard(
    event: React.KeyboardEvent<HTMLButtonElement>,
    kolom: KolomVerifikasi
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const kolomDefinisi = DEFINISI_KOLOM.find((item) => item.id === kolom)
    if (!kolomDefinisi) return
    const delta = event.key === "ArrowRight" ? 10 : -10
    onLebarKolom(
      kolom,
      Math.max(
        kolomDefinisi.minWidth,
        Math.min(800, preferensiKolom.lebar[kolom] + delta)
      )
    )
  }

  // `[&_td]` (keturunan), BUKAN `[&>td]`: kelas dipasang di <table>, sedangkan
  // <td> adalah anak <tr>.
  const pad = kerapatan === "padat" ? "[&_td]:py-1" : "[&_td]:py-2.5"
  const padHeader = kerapatan === "padat" ? "[&>th]:py-1.5" : "[&>th]:py-3"
  const tinggiBaris = kerapatan === "padat" ? "0 32px" : "0 44px"

  // Baris aktif selalu ditarik ke dalam pandangan.
  React.useEffect(() => {
    if (!idTerpilih || !wadahRef.current) return
    const el = wadahRef.current.querySelector<HTMLElement>(
      `[data-id="${idTerpilih}"]`
    )
    el?.scrollIntoView({ block: "nearest" })
  }, [idTerpilih])

  const thBeku =
    "bg-muted/95 supports-[backdrop-filter]:bg-muted/85 sticky z-30 backdrop-blur"

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border/70">
      <div
        ref={wadahRef}
        className="scrollbar-tipis relative min-h-0 min-w-0 flex-1 overflow-auto"
      >
        <table
          className={`tabel-verifikasi w-max min-w-full table-fixed border-separate border-spacing-0 text-sm ${pad}`}
        >
          <colgroup>
            <col style={{ width: L_CEKLIS }} />
            {kolomTampil.map((id) => (
              <col
                key={id}
                style={{
                  width:
                    lebarSementara?.kolom === id
                      ? lebarSementara.lebar
                      : preferensiKolom.lebar[id],
                }}
              />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr
              className={`bg-muted/95 text-muted-foreground supports-backdrop-filter:bg-muted/85 [&>th]:border-r [&>th]:border-b [&>th]:border-border [&>th]:px-3 [&>th]:text-left [&>th]:text-xs [&>th]:leading-4 [&>th]:font-medium [&>th]:tracking-wide [&>th]:whitespace-nowrap [&>th]:backdrop-blur [&>th:last-child]:border-r-0 ${padHeader}`}
            >
              <th
                className={`${thBeku} left-0`}
                style={{ width: L_CEKLIS, minWidth: L_CEKLIS }}
              >
                <Checkbox
                  checked={
                    semuaTerpilih
                      ? true
                      : sebagianTerpilih
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(v) => onToggleSemua(v === true)}
                  aria-label="Pilih semua baris yang tampil"
                />
              </th>
              {kolomTampil.map((id) => {
                const kolom = DEFINISI_KOLOM.find((item) => item.id === id)!
                return (
                  <th
                    key={id}
                    aria-sort={
                      sortir?.kolom === id
                        ? sortir.arah === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    draggable
                    onDragStart={(event) => {
                      kolomDiseret.current = id
                      event.dataTransfer.effectAllowed = "move"
                      event.dataTransfer.setData("text/plain", id)
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      const dari = kolomDiseret.current
                      if (dari && dari !== id) {
                        onPindahKolom(dari, id)
                      }
                      kolomDiseret.current = null
                    }}
                    onDragEnd={() => {
                      kolomDiseret.current = null
                    }}
                    className="relative select-none"
                    style={{
                      width:
                        lebarSementara?.kolom === id
                          ? lebarSementara.lebar
                          : preferensiKolom.lebar[id],
                      minWidth: kolom.minWidth,
                    }}
                    title={kolom.title}
                  >
                    <button
                      type="button"
                      className={`flex w-full items-center gap-1 ${kolom.numeric ? "justify-end" : "justify-start"}`}
                      onClick={() => ubahSort(id)}
                      title={`Urutkan ${kolom.label} menaik atau menurun`}
                    >
                      {kolom.label}
                      <HugeiconsIcon
                        icon={
                          sortir?.kolom === id
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
                    <button
                      type="button"
                      aria-label={`Ubah lebar kolom ${kolom.label}`}
                      className="absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none hover:bg-primary/60"
                      onPointerDown={(event) => mulaiResize(event, id)}
                      onPointerMove={gerakResize}
                      onPointerUp={selesaiResize}
                      onPointerCancel={batalResize}
                      onKeyDown={(event) => ubahLebarDenganKeyboard(event, id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-valuemin={kolom.minWidth}
                      aria-valuemax={800}
                      aria-valuenow={preferensiKolom.lebar[id]}
                      draggable={false}
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rowsTerurut.map(({ row, index: i }) => {
              const tahap = tahapDari(row)
              const gaya = modeBelumDibaca
                ? GAYA_BELUM_DIBACA
                : GAYA_TAHAP[tahap]
              const anomali = modeBelumDibaca
                ? null
                : gayaAnomali(row.persentase ?? null, ambangAnomali)
              const dipilih = terpilih.has(row.id)
              const aktif = idTerpilih === row.id
              const nomor =
                row.nomorLangganan ?? row.pelanggan?.nomorLangganan ?? "—"
              const nama = row.pelanggan?.nama ?? row.namaPelanggan ?? "—"
              const alamat = row.pelanggan?.alamat ?? row.alamatPelanggan ?? "—"
              const { standAwal, standAkhir, pemakaian } =
                tentukanHasilPembacaan(row)
              const hasilPemakaian = row.pembacaan?.pemakaianM3 ?? null
              const v3SudahMemproses =
                row.verif3At != null || row.pembacaan != null
              const pemakaianTagih = v3SudahMemproses
                ? row.pemakaianTagihVerif
                : null

              const standAwalDikoreksi =
                row.standAwalRevisi != null &&
                row.standAwalRevisi !== row.standAwal
              const standAkhirDikoreksi =
                row.standAkhirRevisi != null &&
                row.standAkhirRevisi !== row.standAkhir
              const pemakaianDikoreksi =
                standAwalDikoreksi ||
                standAkhirDikoreksi ||
                pemakaianTagih != null
              const barisDikoreksi = pemakaianDikoreksi
              const barisKoreksiAktif =
                barisDikoreksi && !modeBelumDibaca && tahap === "MENUNGGU"

              const labelStatus = statusLabel(
                row,
                tahap,
                modeBelumDibaca,
                modeRing
              )
              const standAwalAktif = standAwal
              const hasilTagihan = v3SudahMemproses
                ? (pemakaianTagih ?? hasilPemakaian)
                : null

              // Sel beku butuh latar SENDIRI supaya isi kolom lain tidak
              // menembus saat digulir.
              const latarBaris =
                aktif || dipilih ? "bg-table-accent" : gaya.baris
              // Warna hover SATU sumber: variabel --hover-baris di globals.css
              // (juga dipakai aturan baris koreksi). Lapis tint tahap
              // disembunyikan saat hover supaya sel beku tidak lebih
              // berwarna daripada sisa baris.
              const latarBeku = [
                aktif || dipilih ? "bg-table-accent" : "bg-card",
                !aktif && !dipilih
                  ? "group-hover:bg-(color:--hover-baris) group-hover:after:bg-transparent"
                  : "",
                "sticky z-10",
                !barisKoreksiAktif ? gaya.lapis : "",
              ].join(" ")

              return (
                <tr
                  key={row.id}
                  data-id={row.id}
                  data-koreksi={barisKoreksiAktif ? "true" : undefined}
                  data-dipilih={dipilih ? "true" : undefined}
                  aria-selected={aktif}
                  onClick={() => onKlikBaris(row)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onKlikKanan(row, { x: e.clientX, y: e.clientY })
                  }}
                  style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: tinggiBaris,
                  }}
                  className={[
                    "cursor-pointer",
                    "group",
                    latarBaris,
                    !aktif && !dipilih ? "hover:bg-(color:--hover-baris)" : "",
                    "[&>td]:border-r [&>td]:border-b [&>td]:border-border [&>td]:px-3 [&>td]:whitespace-nowrap [&>td:last-child]:border-r-0",
                  ].join(" ")}
                >
                  <td
                    className={`${latarBeku} left-0 ${gaya.garis}`}
                    style={{ width: L_CEKLIS }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={dipilih}
                      onCheckedChange={() => onToggle(row.id, false, i)}
                      onClick={(e) => {
                        if ((e as React.MouseEvent).shiftKey)
                          onToggle(row.id, true, i)
                      }}
                      aria-label={`Pilih ${nomor}`}
                    />
                  </td>
                  {kolomTampil.map((kolom) => {
                    switch (kolom) {
                      case "ring":
                        return (
                          <td key={kolom}>
                            {modeRing === "tunggal" ? (
                              <IkonRingTunggal
                                tahap={modeBelumDibaca ? "MENUNGGU" : tahap}
                              />
                            ) : (
                              <ChipRing
                                tahap={modeBelumDibaca ? "MENUNGGU" : tahap}
                              />
                            )}
                          </td>
                        )
                      case "status":
                        return (
                          <td key={kolom} className="text-xs">
                            <Lencana
                              kelas={statusKelas(labelStatus)}
                              anak={labelStatus}
                            />
                          </td>
                        )
                      case "nomor":
                        return (
                          <td key={kolom} className="font-mono">
                            {nomor}
                          </td>
                        )
                      case "nama":
                        return (
                          <td
                            key={kolom}
                            className="max-w-60 truncate font-medium"
                            title={nama}
                          >
                            {nama}
                          </td>
                        )
                      case "alamat":
                        return (
                          <td
                            key={kolom}
                            className="max-w-80 truncate text-muted-foreground"
                            title={alamat}
                          >
                            {alamat}
                          </td>
                        )
                      case "standAwal":
                        return (
                          <td key={kolom} className="text-right tabular-nums">
                            {angka(standAwalAktif)}
                          </td>
                        )
                      case "standAkhir":
                        return (
                          <td
                            key={kolom}
                            className="text-right tabular-nums"
                            title={
                              standAkhirDikoreksi
                                ? `Dikoreksi verifikator; stand catat awal ${angka(row.standAkhir)}.`
                                : undefined
                            }
                          >
                            {angka(standAkhir)}
                          </td>
                        )
                      case "standRevisi":
                        return (
                          <td key={kolom} className="text-right tabular-nums">
                            {angka(row.standAwalRevisi)}
                          </td>
                        )
                      case "standResmi":
                        return (
                          <td
                            key={kolom}
                            className="text-right tabular-nums"
                            title={
                              row.pembacaan && standAkhirDikoreksi
                                ? "Stand resmi hasil koreksi verifikator."
                                : undefined
                            }
                          >
                            {angka(row.pembacaan?.standAkhir ?? null)}
                          </td>
                        )
                      case "pakai":
                        return (
                          <td
                            key={kolom}
                            className="text-right font-medium tabular-nums"
                            title={
                              pemakaianDikoreksi
                                ? "Pemakaian dihitung dari hasil koreksi."
                                : undefined
                            }
                          >
                            {angka(pemakaian)}
                          </td>
                        )
                      case "lalu":
                        return (
                          <td
                            key={kolom}
                            className="text-right text-muted-foreground tabular-nums"
                          >
                            {angka(row.pemakaianLalu)}
                          </td>
                        )
                      case "tagihan":
                        return (
                          <td
                            key={kolom}
                            className="text-right tabular-nums"
                            title={
                              pemakaianTagih != null
                                ? "Pemakaian Tagihan hasil penetapan V3."
                                : undefined
                            }
                          >
                            {angka(hasilTagihan)}
                          </td>
                        )
                      case "deviasi":
                        return (
                          <td key={kolom} className="text-right tabular-nums">
                            {row.persentase === null ||
                            row.persentase === undefined ? (
                              "—"
                            ) : anomali ? (
                              <Lencana
                                kelas={anomali}
                                anak={`${row.persentase}%`}
                              />
                            ) : (
                              `${row.persentase}%`
                            )}
                          </td>
                        )
                      case "rute":
                        return (
                          <td
                            key={kolom}
                            className="font-mono text-muted-foreground"
                          >
                            {row.pelanggan?.rute?.kode ?? "—"}
                          </td>
                        )
                      case "kondisi":
                        return (
                          <td
                            key={kolom}
                            className="max-w-36 truncate text-muted-foreground"
                          >
                            {row.kondisi
                              ? (LABEL_KONDISI_CATAT[row.kondisi] ??
                                row.kondisi)
                              : "—"}
                            {row.jenisInput && row.jenisInput !== "PETUGAS" && (
                              <span
                                className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
                                title={
                                  row.alasanManual ??
                                  (row.jenisInput === "KONSUMEN"
                                    ? "Stand berasal dari laporan Mandiri konsumen"
                                    : "Laporan ditambahkan secara manual")
                                }
                              >
                                {row.jenisInput === "KONSUMEN"
                                  ? "Mandiri"
                                  : "Manual"}
                              </span>
                            )}
                          </td>
                        )
                      case "petugas":
                        return (
                          <td
                            key={kolom}
                            className="max-w-32 truncate text-muted-foreground"
                          >
                            {row.pencatat?.namaLapangan ?? "—"}
                          </td>
                        )
                      case "tanggal":
                        return (
                          <td
                            key={kolom}
                            className="text-muted-foreground tabular-nums"
                          >
                            {tanggal(row.tanggalCatat)}
                          </td>
                        )
                    }
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>

        {rows.length === 0 && !memuat && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {pesanKosong ??
              (modeBelumDibaca
                ? "Semua sambungan di daftar catat sudah punya setoran — tidak ada yang tertinggal."
                : "Tidak ada laporan yang cocok dengan saringan ini.")}
          </p>
        )}
        {memuat && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Memuat…
          </p>
        )}
      </div>
    </div>
  )
}
