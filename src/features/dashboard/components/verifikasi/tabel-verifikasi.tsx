"use client"

// features/dashboard/components/verifikasi/tabel-verifikasi.tsx — tabel
// khusus layar verifikasi (kotak centang + aksi massal, pewarnaan per ring,
// ribuan baris, kolom beku, navigasi papan ketik).
//
// URUTAN KOLOM mengikuti alur kerja verifikator, dari kiri ke kanan:
//   1. SIAPA        No. Pel · Nama                      (No. Pel beku)
//   2. ANGKA DIUJI  ST Awal · ST Akhir · Pakai · Lalu · Dev %
//   3. KONDISI      Kondisi catat (menjelaskan angka yang janggal)
//   4. HASIL        ST Resmi · Tagihan (terisi setelah diverifikasi)
//   5. KONTEKS      Rute · Petugas · Tgl Catat
//   6. REFERENSI    Alamat (lebar, jarang menentukan keputusan) · Status
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
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LABEL_KONDISI_CATAT } from "../../lib/label"
import { GAYA_TAHAP, GAYA_BELUM_DIBACA, gayaAnomali, tahapDari, type Tahap } from "./types/warna-ring"

export interface BarisVerifikasi {
  id: string
  nomorLangganan?: string | null
  namaPelanggan?: string | null
  alamatPelanggan?: string | null
  periode?: number | null
  standAwal?: number | null
  standAkhir?: number | null
  standAkhirRevisi?: number | null
  pemakaian?: number | null
  pemakaianTagihVerif?: number | null
  pemakaianLalu?: number | null
  pembacaan?: {
    standAkhir: number
    pemakaianM3: number
  } | null
  persentase?: number | null
  kondisi?: string | null
  tanggalCatat?: string | null
  verif1At?: string | null
  verif2At?: string | null
  verif3At?: string | null
  verifiedAt?: string | null
  isVerified?: boolean | null
  pencatat?: { id: string; namaLapangan: string } | null
  pelanggan?: {
    nomorLangganan?: string
    nama?: string
    alamat?: string | null
    rute?: { kode?: string } | null
  } | null
}

export type Kerapatan = "padat" | "normal"
export type ModeRing = "berjenjang" | "tunggal"

const angka = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("id-ID")

const tanggal = (s: string | null | undefined) => {
  if (!s) return "—"
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
}

function Lencana({ kelas, anak }: { kelas: string; anak: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${kelas}`}>
      {anak}
    </span>
  )
}

/// Jumlah ring yang sudah dilewati tiap tahap — menggerakkan batang mini.
const RING_LOLOS: Record<Tahap, number> = { MENUNGGU: 0, V1: 1, V2: 2, V3: 3, DITOLAK: 0 }
const TEKS_CHIP: Record<Tahap, string> = { MENUNGGU: "—", V1: "V1", V2: "V2", V3: "V3", DITOLAK: "Cek" }

function ChipRing({ tahap }: { tahap: Tahap }) {
  const gaya = GAYA_TAHAP[tahap]
  const lolos = RING_LOLOS[tahap]
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-semibold whitespace-nowrap ${gaya.lencana}`}
      aria-label={`Tahap ${gaya.label}`}
    >
      <span className="flex items-center gap-0.5" aria-hidden>
        {([1, 2, 3] as const).map((r) => (
          <span
            key={r}
            className={`h-3 w-1 rounded-full ${r <= lolos ? gaya.titik : "bg-current opacity-20"}`}
          />
        ))}
      </span>
      {tahap === "DITOLAK" && <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3" aria-hidden />}
      {TEKS_CHIP[tahap]}
    </span>
  )
}

const IKON_TUNGGAL = {
  MENUNGGU: Clock01Icon,
  V1: Clock01Icon,
  V2: Clock01Icon,
  V3: CheckmarkCircle02Icon,
  DITOLAK: CancelCircleIcon,
} as const
const LABEL_TUNGGAL: Record<Tahap, string> = {
  MENUNGGU: "Menunggu verifikasi",
  V1: "Menunggu verifikasi",
  V2: "Menunggu verifikasi",
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
          <HugeiconsIcon icon={IKON_TUNGGAL[tahap]} strokeWidth={2} className="size-3.5" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent>{LABEL_TUNGGAL[tahap]}</TooltipContent>
    </Tooltip>
  )
}

/// Lebar kolom beku — dipakai header DAN badan supaya `left` keduanya sama.
/// Salah 1px di sini membuat kolom kedua menindih yang pertama saat digulir.
const L_CEKLIS = 40
const L_RING = 92
const L_NOMOR = 132
const X_RING = L_CEKLIS
const X_NOMOR = L_CEKLIS + L_RING

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
}) {
  const semuaTerpilih = rows.length > 0 && rows.every((r) => terpilih.has(r.id))
  const sebagianTerpilih = !semuaTerpilih && rows.some((r) => terpilih.has(r.id))
  const wadahRef = React.useRef<HTMLDivElement>(null)

  // `[&_td]` (keturunan), BUKAN `[&>td]`: kelas dipasang di <table>, sedangkan
  // <td> adalah anak <tr>.
  const pad = kerapatan === "padat" ? "[&_td]:py-1 [&_th]:py-1.5" : "[&_td]:py-2.5 [&_th]:py-2.5"
  const tinggiBaris = kerapatan === "padat" ? "0 32px" : "0 44px"

  // Baris aktif selalu ditarik ke dalam pandangan.
  React.useEffect(() => {
    if (!idTerpilih || !wadahRef.current) return
    const el = wadahRef.current.querySelector<HTMLElement>(`[data-id="${idTerpilih}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [idTerpilih])

  const thBeku = "bg-muted/95 supports-[backdrop-filter]:bg-muted/85 sticky z-30 backdrop-blur"

  return (
    <div
      ref={wadahRef}
      className="scrollbar-tipis border-border/70 relative h-full min-w-0 overflow-auto rounded-lg border"
    >
      <table className={`w-max min-w-full border-collapse text-sm ${pad}`}>
        <thead className="sticky top-0 z-20">
          <tr className="text-muted-foreground bg-muted/95 supports-backdrop-filter:bg-muted/85 [&>th]:border-border/70 [&>th]:border-b [&>th]:px-3 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-medium [&>th]:tracking-wide [&>th]:whitespace-nowrap [&>th]:backdrop-blur">
            <th className={thBeku} style={{ left: 0, width: L_CEKLIS, minWidth: L_CEKLIS }}>
              <Checkbox
                checked={semuaTerpilih ? true : sebagianTerpilih ? "indeterminate" : false}
                onCheckedChange={(v) => onToggleSemua(v === true)}
                aria-label="Pilih semua baris yang tampil"
              />
            </th>
            <th className={thBeku} style={{ left: X_RING, width: L_RING, minWidth: L_RING }} title="Tahap verifikasi">
              Ring
            </th>
            <th
              className={`${thBeku} border-border/70 border-r`}
              style={{ left: X_NOMOR, width: L_NOMOR, minWidth: L_NOMOR }}
              title="Nomor pelanggan (langganan)"
            >
              No. Pel
            </th>
            <th style={{ minWidth: 220 }}>Nama</th>
            {!modeBelumDibaca && (
              <>
                <th className="text-right" style={{ minWidth: 88 }} title="Stand awal (angka meter bulan lalu)">ST Awal</th>
                <th className="text-right" style={{ minWidth: 88 }} title="Stand akhir hasil catat petugas / laporan pelanggan">ST Akhir</th>
                <th className="text-right" style={{ minWidth: 72 }} title="Pemakaian hasil catat (m³)">Pakai</th>
                <th className="text-right" style={{ minWidth: 72 }} title="Pemakaian bulan lalu (m³)">Lalu</th>
                <th className="text-right" style={{ minWidth: 84 }} title="Deviasi pemakaian terhadap bulan lalu">Dev %</th>
                <th style={{ minWidth: 140 }} title="Keterangan kondisi saat dicatat">Kondisi</th>
                <th className="text-right" style={{ minWidth: 96 }} title="Stand akhir resmi (setelah diverifikasi; * = dikoreksi)">ST Resmi</th>
                <th className="text-right" style={{ minWidth: 88 }} title="Pemakaian yang ditagihkan (m³)">Tagihan</th>
              </>
            )}
            <th style={{ minWidth: 84 }} title="Kode rute pembacaan">Rute</th>
            <th style={{ minWidth: 130 }} title="Petugas pencatat">Petugas</th>
            {!modeBelumDibaca && <th style={{ minWidth: 92 }} title="Tanggal catat">Tgl Catat</th>}
            <th style={{ minWidth: 300 }}>Alamat</th>
            <th style={{ minWidth: 132 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const tahap = tahapDari(row)
            const gaya = modeBelumDibaca ? GAYA_BELUM_DIBACA : GAYA_TAHAP[tahap]
            const anomali = modeBelumDibaca ? null : gayaAnomali(row.persentase ?? null, ambangAnomali)
            const dipilih = terpilih.has(row.id)
            const aktif = idTerpilih === row.id
            const nomor = row.nomorLangganan ?? row.pelanggan?.nomorLangganan ?? "—"
            const nama = row.pelanggan?.nama ?? row.namaPelanggan ?? "—"
            const alamat = row.pelanggan?.alamat ?? row.alamatPelanggan ?? "—"
            const hasilStandAkhir = row.pembacaan?.standAkhir ?? null
            const hasilPemakaian = row.pembacaan?.pemakaianM3 ?? null

            const labelStatus = modeBelumDibaca
              ? gaya.label
              : modeRing === "tunggal"
                ? tahap === "V3"
                  ? "Terverifikasi"
                  : tahap === "DITOLAK"
                    ? "Cek ulang"
                    : "Menunggu"
                : gaya.label

            // Sel beku butuh latar SENDIRI supaya isi kolom lain tidak
            // menembus saat digulir.
            const latarBaris = aktif || dipilih ? "bg-table-accent" : gaya.baris
            const latarBeku = [
              aktif || dipilih ? "bg-table-accent" : "bg-card",
              !aktif && !dipilih ? "group-hover:bg-table-accent" : "",
              "sticky z-10",
              gaya.lapis,
            ].join(" ")

            return (
              <tr
                key={row.id}
                data-id={row.id}
                aria-selected={aktif}
                onClick={() => onKlikBaris(row)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onKlikKanan(row, { x: e.clientX, y: e.clientY })
                }}
                style={{ contentVisibility: "auto", containIntrinsicSize: tinggiBaris }}
                className={[
                  "cursor-pointer",
                  "group",
                  latarBaris,
                  !aktif && !dipilih ? "hover:bg-table-accent" : "",
                  "[&>td]:border-border/40 [&>td]:border-b [&>td]:px-3 [&>td]:whitespace-nowrap",
                ].join(" ")}
              >
                <td
                  className={`${latarBeku} ${gaya.garis}`}
                  style={{ left: 0, width: L_CEKLIS }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={dipilih}
                    onCheckedChange={() => onToggle(row.id, false, i)}
                    onClick={(e) => {
                      if ((e as React.MouseEvent).shiftKey) onToggle(row.id, true, i)
                    }}
                    aria-label={`Pilih ${nomor}`}
                  />
                </td>
                <td className={latarBeku} style={{ left: X_RING, width: L_RING }}>
                  {modeRing === "tunggal" ? (
                    <IkonRingTunggal tahap={modeBelumDibaca ? "MENUNGGU" : tahap} />
                  ) : (
                    <ChipRing tahap={modeBelumDibaca ? "MENUNGGU" : tahap} />
                  )}
                </td>
                <td className={`${latarBeku} border-border/70 border-r font-mono`} style={{ left: X_NOMOR }}>
                  {nomor}
                </td>
                <td className="max-w-60 truncate font-medium" title={nama}>{nama}</td>
                {!modeBelumDibaca && (
                  <>
                    <td className="text-right tabular-nums">{angka(row.standAwal)}</td>
                    <td className="text-right tabular-nums">{angka(row.standAkhir)}</td>
                    <td className="text-right font-medium tabular-nums">{angka(row.pemakaian)}</td>
                    <td className="text-muted-foreground text-right tabular-nums">{angka(row.pemakaianLalu)}</td>
                    <td className="text-right tabular-nums">
                      {row.persentase === null || row.persentase === undefined ? (
                        "—"
                      ) : anomali ? (
                        <Lencana kelas={anomali} anak={`${row.persentase}%`} />
                      ) : (
                        `${row.persentase}%`
                      )}
                    </td>
                    <td className="text-muted-foreground max-w-36 truncate">
                      {row.kondisi ? (LABEL_KONDISI_CATAT[row.kondisi] ?? row.kondisi) : "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {angka(hasilStandAkhir)}
                      {row.pembacaan &&
                        row.standAkhirRevisi != null &&
                        row.standAkhirRevisi !== row.standAkhir && (
                          <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400" title="Dikoreksi saat verifikasi">*</span>
                        )}
                    </td>
                    <td className="text-right tabular-nums">{angka(hasilPemakaian)}</td>
                  </>
                )}
                <td className="text-muted-foreground font-mono">{row.pelanggan?.rute?.kode ?? "—"}</td>
                <td className="text-muted-foreground max-w-32 truncate">{row.pencatat?.namaLapangan ?? "—"}</td>
                {!modeBelumDibaca && <td className="text-muted-foreground tabular-nums">{tanggal(row.tanggalCatat)}</td>}
                <td className="text-muted-foreground max-w-80 truncate" title={alamat}>{alamat}</td>
                <td>
                  <Lencana kelas={gaya.lencana} anak={labelStatus} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {rows.length === 0 && !memuat && (
        <p className="text-muted-foreground p-8 text-center text-sm">
          {pesanKosong ?? (modeBelumDibaca
            ? "Semua sambungan di daftar catat sudah punya setoran — tidak ada yang tertinggal."
            : "Tidak ada laporan yang cocok dengan saringan ini.")}
        </p>
      )}
      {memuat && <p className="text-muted-foreground p-8 text-center text-sm">Memuat…</p>}
    </div>
  )
}