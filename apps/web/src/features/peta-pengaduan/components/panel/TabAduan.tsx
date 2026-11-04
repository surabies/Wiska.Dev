"use client"

import { Inbox, MapPin, Search, User } from "@/components/ui/hugeicons-compat"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "../StatusBadgePengaduan"
import { labelKategori } from "../../lib/KonstantaPengaduan"
import type { Pengaduan, StatusPengaduan } from "../../types/TipePengaduan"

interface Props {
  daftar: Pengaduan[]
  terpilihId: string | null
  cariTeks: string
  onCariTeksChange: (v: string) => void
  filterStatus: StatusPengaduan | "semua"
  onFilterStatusChange: (v: StatusPengaduan | "semua") => void
  hitungan?: { total: number; baru: number; diproses: number; selesai: number }
  onPilihTiket: (id: string) => void
  formatWaktu: Intl.DateTimeFormat
}

export function TabAduan({
  daftar,
  terpilihId,
  cariTeks,
  onCariTeksChange,
  filterStatus,
  onFilterStatusChange,
  onPilihTiket,
  formatWaktu,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* Pencarian dan Filter Status */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cariTeks}
            onChange={(e) => onCariTeksChange(e.target.value)}
            placeholder="Cari tiket, lokasi, pelapor..."
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>

        {/* Status pills filter tanpa angka count (ringkas & bersih) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => onFilterStatusChange("semua")}
            className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === "semua"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => onFilterStatusChange("baru")}
            className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === "baru"
                ? "bg-amber-500 text-white shadow-2xs"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Baru
          </button>
          <button
            type="button"
            onClick={() => onFilterStatusChange("diproses")}
            className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === "diproses"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Ditangani
          </button>
          <button
            type="button"
            onClick={() => onFilterStatusChange("selesai")}
            className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === "selesai"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Selesai
          </button>
        </div>
      </div>

      {/* Daftar Kartu Aduan */}
      {daftar.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto size-8 text-muted-foreground/60 mb-2" />
          Tidak ada aduan yang cocok dengan filter.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {daftar.map((p) => {
            const terpilih = p.id === terpilihId
            return (
              <li key={p.id}>
                <div
                  onClick={() => onPilihTiket(p.id)}
                  className={`group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 transition-all hover:bg-accent/60 ${
                    terpilih
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                      : "bg-card shadow-2xs hover:border-foreground/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="font-mono text-xs font-bold text-foreground truncate min-w-0">
                      {p.nomor}
                    </span>
                    <div className="shrink-0">
                      <StatusBadge status={p.status} />
                    </div>
                  </div>

                  <p className="line-clamp-1 text-xs font-semibold text-foreground break-words">
                    {p.judul || labelKategori(p.kategori)}
                  </p>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    <MapPin className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate min-w-0">{p.alamat}</span>
                  </div>

                  {/* Baris Bawah: Petugas & Waktu */}
                  <div className="mt-1 flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground min-w-0">
                    <span className="flex items-center gap-1 truncate min-w-0 pr-2">
                      <User className="size-3 shrink-0" />
                      {p.petugasNama ? (
                        <span className="text-foreground font-medium truncate">
                          {p.petugasNama}
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground/80">Belum ditugaskan</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[10px]">
                      {formatWaktu.format(new Date(p.dibuatPada))}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
