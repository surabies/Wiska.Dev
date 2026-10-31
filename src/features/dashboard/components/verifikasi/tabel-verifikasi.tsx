"use client"

// features/dashboard/components/verifikasi/tabel-verifikasi.tsx — tabel
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
  pelangganId?: string | null
  nomorLangganan?: string | null
  namaPelanggan?: string | null
  alamatPelanggan?: string | null
  periode?: number | null
  standAwal?: number | null
  standAwalRevisi?: number | null
  standAkhir?: number | null
  standAkhirRevisi?: number | null
  standAngkatLama?: number | null
  standAwalMeterBaru?: number | null
  pemakaian?: number | null
  pemakaianTagihVerif?: number | null
  kondisiRevisi?: string | null
  jenisInput?: string | null
  alasanManual?: string | null
  meterVerifId?: string | null
  blokTarifVerif?: number | null
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
  status?: string | null
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
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${kelas}`}>
      {anak}
    </span>
  )
}

const TEKS_CHIP: Record<Tahap, string> = { MENUNGGU: "—", V1: "V1", V2: "V2", V3: "V3", DITOLAK: "Cek" }

function ChipRing({ tahap }: { tahap: Tahap }) {
  const gaya = GAYA_TAHAP[tahap]
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-semibold whitespace-nowrap ${gaya.lencana}`}
      aria-label={`Tahap ${gaya.label}`}
    >
      <span className={`size-2 rounded-full ${gaya.titik}`} aria-hidden />
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
const L_CEKLIS = 40
const L_RING = 76
const L_STATUS = 116
const L_NOMOR = 132
const X_RING = L_CEKLIS
const X_STATUS = X_RING + L_RING
const X_NOMOR = X_STATUS + L_STATUS

function statusLabel(
  row: BarisVerifikasi,
  tahap: Tahap,
  modeBelumDibaca: boolean,
  modeRing: ModeRing,
): string {
  if (modeBelumDibaca) return "Belum dibaca"
  if (modeRing === "tunggal") {
    if (row.status === "DITOLAK") return "Perlu Review"
    if (row.status === "DIVERIFIKASI" || row.status === "DIGUNAKAN") return "Disetujui"
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
              className={thBeku}
              style={{ left: X_STATUS, width: L_STATUS, minWidth: L_STATUS }}
              title="Status proses verifikasi"
            >
              Status
            </th>
            <th
              className={`${thBeku} border-border/70 border-r`}
              style={{ left: X_NOMOR, width: L_NOMOR, minWidth: L_NOMOR }}
              title="Nomor pelanggan (langganan)"
            >
              No. Pel
            </th>
            <th style={{ minWidth: 220 }}>Nama</th>
            <th style={{ minWidth: 280 }}>Alamat</th>
            <th style={{ minWidth: 84 }} title="Kode rute pembacaan">Rute</th>
            {!modeBelumDibaca && (
              <th style={{ minWidth: 140 }} title="Keterangan saat pencatatan">Ket Catat</th>
            )}
            {!modeBelumDibaca && (
              <>
                <th className="text-right" style={{ minWidth: 88 }} title="Stand awal aktif">ST Awal</th>
                <th className="text-right" style={{ minWidth: 88 }} title="Stand akhir hasil catat petugas / laporan pelanggan">ST Akhir</th>
                <th className="text-right" style={{ minWidth: 88 }} title="Stand awal hasil revisi">ST Revisi</th>
                <th className="text-right" style={{ minWidth: 96 }} title="Stand akhir resmi (setelah diverifikasi; * = dikoreksi)">ST Resmi</th>
                <th className="text-right" style={{ minWidth: 72 }} title="Pemakaian periode ini (m³)">Pakai</th>
                <th className="text-right" style={{ minWidth: 72 }} title="Pemakaian bulan sebelumnya (m³)">Lalu</th>
                <th className="text-right" style={{ minWidth: 84 }} title="Deviasi pemakaian terhadap bulan lalu">Dev %</th>
                <th className="text-right" style={{ minWidth: 88 }} title="Pemakaian tagihan dalam m³">Tagihan</th>
              </>
            )}
            <th style={{ minWidth: 130 }} title="Petugas pencatat">Petugas</th>
            {!modeBelumDibaca && <th style={{ minWidth: 155 }} title="Tanggal dan waktu catat">Tgl Catat</th>}
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

            const labelStatus = statusLabel(row, tahap, modeBelumDibaca, modeRing)
            const standAwalAktif = row.standAwalRevisi ?? row.standAwal
            const hasilTagihan = row.pemakaianTagihVerif ?? hasilPemakaian

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
                <td className={`${latarBeku} text-xs`} style={{ left: X_STATUS, width: L_STATUS }}>
                  <Lencana kelas={statusKelas(labelStatus)} anak={labelStatus} />
                </td>
                <td className={`${latarBeku} border-border/70 border-r font-mono`} style={{ left: X_NOMOR }}>
                  {nomor}
                </td>
                <td className="max-w-60 truncate font-medium" title={nama}>{nama}</td>
                <td className="text-muted-foreground max-w-80 truncate" title={alamat}>{alamat}</td>
                <td className="text-muted-foreground font-mono">{row.pelanggan?.rute?.kode ?? "—"}</td>
                {!modeBelumDibaca && (
                  <td className="text-muted-foreground max-w-36 truncate">
                    {row.kondisi ? (LABEL_KONDISI_CATAT[row.kondisi] ?? row.kondisi) : "—"}
                    {row.jenisInput && row.jenisInput !== "PETUGAS" && (
                      <span
                        className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
                        title={row.alasanManual ?? "Laporan ditambahkan secara manual"}
                      >
                        Manual
                      </span>
                    )}
                  </td>
                )}
                {!modeBelumDibaca && (
                  <>
                    <td className="text-right tabular-nums">{angka(standAwalAktif)}</td>
                    <td className="text-right tabular-nums">{angka(row.standAkhir)}</td>
                    <td className="text-right tabular-nums">{angka(row.standAwalRevisi)}</td>
                    <td className="text-right tabular-nums">
                      {angka(hasilStandAkhir)}
                      {row.pembacaan &&
                        row.standAkhirRevisi != null &&
                        row.standAkhirRevisi !== row.standAkhir && (
                          <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400" title="Dikoreksi saat verifikasi">*</span>
                        )}
                    </td>
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
                    <td className="text-right tabular-nums">{angka(hasilTagihan)}</td>
                  </>
                )}
                <td className="text-muted-foreground max-w-32 truncate">{row.pencatat?.namaLapangan ?? "—"}</td>
                {!modeBelumDibaca && <td className="text-muted-foreground tabular-nums">{tanggal(row.tanggalCatat)}</td>}
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