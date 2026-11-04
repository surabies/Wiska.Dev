"use client"

import Link from "next/link"
import { AppLogo } from "@/components/LogoAplikasi"
import type { StatusPengaduan } from "../../types/TipePengaduan"

interface Props {
  totalAduan: number
  totalKegiatan: number
  filterStatus: StatusPengaduan | "semua"
  jumlahFilter: number
}

export function KepalaPanel({
  totalAduan,
  totalKegiatan,
  filterStatus,
  jumlahFilter,
}: Props) {
  return (
    <header className="flex flex-col gap-3 border-b bg-card/60 p-4 backdrop-blur-xs shrink-0">
      {/* Baris Identitas Logo & Judul dengan tautan kembali ke Dashboard */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          title="Kembali ke Dashboard"
          aria-label="Kembali ke Dashboard"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-card p-1.5 shadow-2xs transition-all hover:border-primary/50 hover:bg-muted hover:scale-105 active:scale-95 cursor-pointer"
        >
          <AppLogo className="size-7" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href="/dashboard"
            className="group block outline-none"
            title="Kembali ke Dashboard"
          >
            <h1 className="truncate text-sm font-bold tracking-tight text-foreground leading-tight group-hover:text-primary transition-colors cursor-pointer">
              Peta Kendali Pengaduan
            </h1>
          </Link>
          <p className="truncate text-[11px] text-muted-foreground">
            Pusat Monitoring GIS & Dispatch Petugas
          </p>
        </div>
      </div>

      {/* Baris Status Live & Statistik Ringkas */}
      <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Live GIS Monitoring
            </span>
          </div>
          <span className="text-[11px] font-bold text-foreground">
            {totalAduan} Aduan Terdata
          </span>
        </div>

        {/* Baris Bawah: Sebelah kiri Linimasa Lapangan, sebelah kanan jumlah filter tiket yang diklik */}
        <div className="flex items-center justify-between border-t border-border/50 pt-1.5 text-[11px]">
          <span className="text-muted-foreground flex items-center gap-1 font-medium">
            <span>Linimasa Lapangan:</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {totalKegiatan} Log
            </span>
          </span>

          <span className="font-medium text-foreground">
            {filterStatus === "semua" && (
              <span className="text-muted-foreground">
                Filter: <strong className="text-foreground">{jumlahFilter} Semua</strong>
              </span>
            )}
            {filterStatus === "baru" && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Filter: {jumlahFilter} Baru
              </span>
            )}
            {filterStatus === "diproses" && (
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                Filter: {jumlahFilter} Ditangani
              </span>
            )}
            {filterStatus === "selesai" && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Filter: {jumlahFilter} Selesai
              </span>
            )}
          </span>
        </div>
      </div>
    </header>
  )
}
