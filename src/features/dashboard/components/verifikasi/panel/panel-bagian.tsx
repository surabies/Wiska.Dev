"use client"

// features/dashboard/components/verifikasi/panel-bagian.tsx — potongan kecil
// yang dipakai panel verifikasi (lapangan & mandiri) dan modalnya: judul
// bagian (modal), seksi lipat (panel), kartu informasi pelanggan, grid stand
// 3 kolom, badge status, dan empty state panel.
//
// SEKSI LIPAT memakai Collapsible, bukan Accordion: tanpa animasi tinggi yang
// diukur lewat JS, dan isi seksi yang tertutup TIDAK dirender — histori dan
// foto pembanding baru mengambil data setelah seksinya dibuka.
import * as React from "react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { GAYA_TAHAP } from "../types/warna-ring"

/// Judul bagian untuk modal (bukan seksi lipat).
export function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-center text-xs font-medium text-muted-foreground">{judul}</p>
      {children}
    </div>
  )
}

/// Ingatan buka/tutup per seksi selama sesi. Panel di-remount lewat `key`
/// tiap ganti baris; tanpa ini seksi yang baru Anda tutup terbuka lagi di
/// baris berikutnya. Panel Petugas dan Pelanggan memakai id seksi yang sama,
/// jadi pilihan Anda berlaku di keduanya.
const INGATAN_SEKSI = new Map<string, boolean>()

export function Seksi({
  id,
  judul,
  awalBuka = false,
  children,
}: {
  id: string
  judul: string
  /** Terbuka saat pertama kali, sebelum Anda mengubahnya. */
  awalBuka?: boolean
  children: React.ReactNode
}) {
  const [buka, setBuka] = React.useState(() => INGATAN_SEKSI.get(id) ?? awalBuka)

  return (
    <Collapsible
      open={buka}
      onOpenChange={(b) => {
        INGATAN_SEKSI.set(id, b)
        setBuka(b)
      }}
      className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card"
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 bg-muted/30 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent data-[state=open]:border-b data-[state=open]:border-border/70">
        {judul}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0 p-3">
        <div className="flex min-w-0 flex-col gap-2.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/// Informasi pelanggan: nama + badge status di satu baris (seperti semula),
/// lalu baris label–nilai ala tabel. Baris tanpa nilai dilewati.
export function InfoPelanggan({
  nama,
  status,
  nomor,
  kondisi,
  alamat,
}: {
  nama: string
  status: string
  nomor: string
  kondisi?: string | null
  alamat?: string | null
}) {
  const baris: { label: string; nilai: string | null | undefined; mono?: boolean }[] = [
    { label: "No. Pel", nilai: nomor, mono: true },
    { label: "Kondisi", nilai: kondisi },
    { label: "Alamat", nilai: alamat },
  ]
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm leading-snug font-semibold wrap-break-word text-foreground">{nama}</p>
        <BadgeStatusVerif status={status} />
      </div>
      <dl className="divide-y divide-border/60 border-t border-border/60 text-xs">
        {baris
          .filter((b) => b.nilai)
          .map((b) => (
            <div key={b.label} className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-2 py-1.5">
              <dt className="text-muted-foreground">{b.label}</dt>
              <dd className={cn("min-w-0 wrap-break-word text-foreground", b.mono && "font-mono")}>{b.nilai}</dd>
            </div>
          ))}
      </dl>
    </div>
  )
}

/// Kelas kolom ditulis utuh, bukan dirangkai — Tailwind memindai source secara statis.
const KOLOM_GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

export type NadaStand = "netral" | "info" | "sukses"

/// Aksen warna per sel: netral = nilai awal, biru = angka akhir, hijau = pemakaian.
const NADA: Record<NadaStand, { kotak: string; nilai: string }> = {
  netral: { kotak: "bg-muted/30", nilai: "text-foreground" },
  info: { kotak: "bg-blue-500/[0.06]", nilai: "text-blue-700 dark:text-blue-400" },
  sukses: { kotak: "bg-green-500/[0.06]", nilai: "text-green-700 dark:text-green-400" },
}

export interface SelStand {
  label: string
  nilai: number | null
  nada?: NadaStand
}

/// Murni penampil angka. Tiga sel (ST awal / ST akhir / Pakai) muat di panel tersempit.
export function GridStand({ sel }: { sel: SelStand[] }) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70",
        KOLOM_GRID[sel.length] ?? "grid-cols-3",
      )}
    >
      {sel.map((s) => {
        const nada = NADA[s.nada ?? "netral"]
        return (
          <div key={s.label} className={cn("min-w-0 px-1.5 py-2 text-center", nada.kotak)} title={s.nilai?.toLocaleString("id-ID")}>
            <p className="truncate text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">{s.label}</p>
            <p className={cn("mt-0.5 truncate text-[13px] font-semibold tabular-nums", nada.nilai)}>
              {s.nilai?.toLocaleString("id-ID") ?? "—"}
            </p>
          </div>
        )
      })}
    </div>
  )
}

/// Nada warna sama dengan tabel supaya panel dan tabel membaca status identik.
const BADGE_STATUS: Record<string, { label: string; kelas: string }> = {
  MENUNGGU:     { label: "Menunggu",      kelas: GAYA_TAHAP.MENUNGGU.lencana },
  MENUNGGU_V1:  { label: "Menunggu V1",   kelas: GAYA_TAHAP.MENUNGGU.lencana },
  MENUNGGU_V2:  { label: "Menunggu V2",   kelas: GAYA_TAHAP.V1.lencana },
  MENUNGGU_V3:  { label: "Menunggu V3",   kelas: GAYA_TAHAP.V2.lencana },
  RESMI:        { label: "Resmi",         kelas: GAYA_TAHAP.V3.lencana },
  DIVERIFIKASI: { label: "Terverifikasi", kelas: GAYA_TAHAP.V3.lencana },
  DIGUNAKAN:    { label: "Digunakan",     kelas: GAYA_TAHAP.V3.lencana },
  DITOLAK:      { label: "Cek ulang",     kelas: GAYA_TAHAP.DITOLAK.lencana },
}

export function BadgeStatusVerif({ status }: { status: string }) {
  const cfg = BADGE_STATUS[status] ?? { label: status, kelas: "border-border bg-muted text-muted-foreground" }
  return (
    <span className={cn("inline-block shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", cfg.kelas)}>
      {cfg.label}
    </span>
  )
}

export function PanelKosong({ icon, pesan }: { icon: IconSvgElement; pesan: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-14 text-center">
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-xs text-muted-foreground">{pesan}</p>
    </div>
  )
}