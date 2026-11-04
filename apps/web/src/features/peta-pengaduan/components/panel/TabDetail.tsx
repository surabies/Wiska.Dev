"use client"

import Link from "next/link"
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  Phone,
  User,
  UserCheck,
  Wrench,
} from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "../StatusBadgePengaduan"
import { labelKategori } from "../../lib/KonstantaPengaduan"
import type { Pengaduan, StatusPengaduan } from "../../types/TipePengaduan"
import type { PetugasOption } from "../../lib/ApiPengaduan"

interface Props {
  tiket: Pengaduan | null
  onBukaDaftar: () => void
  onFokusPeta: (id: string) => void
  onBukaModalDetail?: () => void
  prosesAksi: boolean
  onAksiStatus: (statusBaru: StatusPengaduan) => void
  daftarPetugas: PetugasOption[]
  petugasTugaskan: string
  onPetugasTugaskanChange: (v: string) => void
  onAksiTugaskan: () => void
  catatanOperator: string
  onCatatanOperatorChange: (v: string) => void
  onAksiCatatan: () => void
  formatWaktu: Intl.DateTimeFormat
}

export function TabDetail({
  tiket,
  onBukaDaftar,
  onFokusPeta,
  onBukaModalDetail,
  prosesAksi,
  onAksiStatus,
  daftarPetugas,
  petugasTugaskan,
  onPetugasTugaskanChange,
  onAksiTugaskan,
  catatanOperator,
  onCatatanOperatorChange,
  onAksiCatatan,
  formatWaktu,
}: Props) {
  if (!tiket) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 px-4 text-center">
        <FileText className="size-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-semibold text-foreground">Belum Ada Tiket Terpilih</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
          Klik salah satu titik pengaduan di peta atau pilih dari tab Aduan untuk melihat berkas perkara lengkap.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 text-xs"
          onClick={onBukaDaftar}
        >
          Buka Daftar Aduan
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 text-xs min-w-0 overflow-hidden">
      {/* 1. Kartu Ringkasan Kepala Tiket (Tahan Overflow) */}
      <div className="rounded-xl border bg-card p-4 shadow-2xs flex flex-col gap-2.5 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="font-mono text-sm font-bold text-foreground truncate min-w-0">
            {tiket.nomor}
          </span>
          <div className="shrink-0">
            <StatusBadge status={tiket.status} />
          </div>
        </div>

        <h3 className="text-sm font-bold text-foreground break-words leading-snug">
          {tiket.judul || labelKategori(tiket.kategori)}
        </h3>

        <div className="flex flex-wrap gap-2 pt-1 text-[11px] min-w-0">
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-muted-foreground shrink-0">
            <Clock className="size-3" /> Masuk: {formatWaktu.format(new Date(tiket.dibuatPada))}
          </span>
          {tiket.prioritas && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-medium shrink-0">
              Prioritas: {tiket.prioritas}
            </span>
          )}
        </div>
      </div>

      {/* 2. Uraian Masalah Warga */}
      <div className="rounded-xl border bg-card p-4 shadow-2xs flex flex-col gap-2 min-w-0">
        <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          Uraian Masalah Warga
        </h4>
        <p className="text-xs leading-relaxed text-foreground break-words whitespace-pre-wrap">
          {tiket.deskripsi}
        </p>
      </div>

      {/* 3. Lokasi & Pelapor */}
      <div className="rounded-xl border bg-card p-4 shadow-2xs flex flex-col gap-2.5 min-w-0">
        <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          Identitas Kejadian
        </h4>
        <div className="flex items-start gap-2 min-w-0">
          <MapPin className="size-4 shrink-0 text-primary mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground text-xs break-words">{tiket.alamat}</p>
            <p className="font-mono text-[11px] text-muted-foreground truncate">
              {tiket.lat.toFixed(6)}, {tiket.lng.toFixed(6)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t pt-2 min-w-0">
          <User className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate">
              Pelapor: {tiket.pelapor || "Warga"}
            </p>
            {tiket.kontakPelapor && (
              <p className="text-muted-foreground flex items-center gap-1 truncate text-[11px]">
                <Phone className="size-3 shrink-0" /> {tiket.kontakPelapor}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t pt-2 min-w-0">
          <UserCheck className="size-4 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              Petugas Lapangan:
            </p>
            <p className="text-muted-foreground truncate">
              {tiket.petugasNama || "Belum ditugaskan ke teknisi"}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Panel Interaksi Ringkas Operator / Dispatcher */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 shadow-2xs flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <Wrench className="size-4 text-primary shrink-0" />
            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider truncate">
              Aksi Cepat Operator
            </h4>
          </div>
          <span className="text-[10px] text-muted-foreground bg-background px-2 py-0.5 rounded-full border shadow-2xs shrink-0">
            Live Dispatch
          </span>
        </div>

        {/* 4a. Ubah Status Cepat */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground">
            Pembaruan Status Tiket:
          </label>
          <div className="grid grid-cols-2 gap-1.5 min-w-0">
            <Button
              variant={tiket.status === "terverifikasi" ? "default" : "outline"}
              size="sm"
              disabled={prosesAksi || tiket.status === "terverifikasi"}
              onClick={() => onAksiStatus("terverifikasi")}
              className="h-7 text-[11px] justify-start truncate"
            >
              <CheckCircle2 className="size-3 mr-1 text-red-500 shrink-0" /> Verifikasi
            </Button>
            <Button
              variant={tiket.status === "diproses" ? "default" : "outline"}
              size="sm"
              disabled={prosesAksi || tiket.status === "diproses"}
              onClick={() => onAksiStatus("diproses")}
              className="h-7 text-[11px] justify-start truncate"
            >
              <Wrench className="size-3 mr-1 text-indigo-500 shrink-0" /> Tangani
            </Button>
            <Button
              variant={tiket.status === "selesai" ? "default" : "outline"}
              size="sm"
              disabled={prosesAksi || tiket.status === "selesai"}
              onClick={() => onAksiStatus("selesai")}
              className="h-7 text-[11px] justify-start truncate"
            >
              <CheckCircle2 className="size-3 mr-1 text-emerald-500 shrink-0" /> Selesai
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={prosesAksi}
              onClick={() => onAksiStatus("baru")}
              className="h-7 text-[11px] justify-start text-muted-foreground truncate"
            >
              <Clock className="size-3 mr-1 shrink-0" /> Reset Status
            </Button>
          </div>
        </div>

        {/* 4b. Tugaskan Petugas */}
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
          <label className="text-[11px] font-semibold text-muted-foreground">
            Tugaskan Teknisi / Regu:
          </label>
          <div className="flex gap-1.5 min-w-0">
            <select
              value={petugasTugaskan}
              onChange={(e) => onPetugasTugaskanChange(e.target.value)}
              className="flex-1 min-w-0 h-8 rounded-lg border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary truncate"
            >
              <option value="">Pilih regu / teknisi...</option>
              {daftarPetugas.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={prosesAksi || !petugasTugaskan}
              onClick={onAksiTugaskan}
              className="h-8 text-xs shrink-0"
            >
              <UserCheck className="size-3.5 mr-1 shrink-0" /> Tugaskan
            </Button>
          </div>
        </div>

        {/* 4c. Catatan Tindak Lanjut */}
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
          <label className="text-[11px] font-semibold text-muted-foreground">
            Catatan Lapangan / Tindak Lanjut:
          </label>
          <div className="flex gap-1.5 min-w-0">
            <Input
              value={catatanOperator}
              onChange={(e) => onCatatanOperatorChange(e.target.value)}
              placeholder="Tulis instruksi atau progres..."
              className="h-8 text-xs bg-background flex-1 min-w-0"
              onKeyDown={(e) => {
                if (e.key === "Enter") onAksiCatatan()
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={prosesAksi || !catatanOperator.trim()}
              onClick={onAksiCatatan}
              className="h-8 text-xs shrink-0"
            >
              Simpan
            </Button>
          </div>
        </div>
      </div>

      {/* 5. Aksi Lembar Kerja & Fokus Peta */}
      <div className="flex flex-col gap-2 pt-1 min-w-0">
        <Link
          href={`/pengaduan/${tiket.id}`}
          target="_blank"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors text-center break-words"
        >
          <span>Buka Lembar Kerja Penuh di Dashboard</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </Link>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs truncate"
            onClick={() => onFokusPeta(tiket.id)}
          >
            Fokuskan di Peta
          </Button>
          {onBukaModalDetail && (
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs truncate"
              onClick={onBukaModalDetail}
            >
              Lihat Foto & Berkas
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
