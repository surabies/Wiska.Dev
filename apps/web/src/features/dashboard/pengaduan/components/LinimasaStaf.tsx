"use client"

// features/dashboard/pengaduan/components/LinimasaStaf.tsx — linimasa tiket
// versi PETUGAS dengan antarmuka CHAT BUBBLE (tik-tok-kan: Kiri Petugas, Kanan Pelanggan)
// dan LINIMASA AUDIT konvensional.
//
// Karakteristik Desain:
// - Mode Chat:
//   * Sisi KIRI: Pesan Petugas/Staf (avatar petugas, role badge, bubble netral lembut).
//   * Sisi KANAN: Pesan Pelanggan/Warga (bubble aksen warna sky/iMessage, avatar pelapor, centang ganda).
//   * Tengah: Catatan Internal Tim (memo proteksi gembok amber) dan Event Log Transisi Status.
// - Mode Linimasa:
//   * Rel kronologis formal dengan status dot accent berdampingan di sisi kiri.
import * as React from "react"
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  Lock,
  MessageCircle,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Star,
  ThumbsUp,
  Ticket,
  User,
  UserCheck,
} from "@/components/ui/hugeicons-compat"
import { BingkaiFoto } from "@/components/BingkaiFoto"
import { formatWaktu } from "@/features/public/lib/Format"
import { statusPengaduanStaf } from "@/features/dashboard/lib/LabelPengaduan"
import { cn } from "@/lib/Utilitas"
import type { EntriRiwayat } from "../types/TipePengaduan"

export type ModeTampilanRiwayat = "CHAT" | "LINIMASA"

export const LABEL_AKSI: Record<string, string> = {
  DIBUAT: "Tiket Dibuat",
  DIVERIFIKASI: "Diverifikasi Operator",
  DITUGASKAN: "Penugasan Petugas",
  STATUS_DIUBAH: "Perubahan Status",
  CATATAN: "Catatan Tindak Lanjut",
  CHAT: "Pesan Chat",
  ESKALASI: "Eskalasi Manajemen",
  DIKONFIRMASI: "Konfirmasi Selesai",
  DIBUKA_KEMBALI: "Tiket Dibuka Kembali",
  DINILAI: "Penilaian Kepuasan",
  DITUTUP_OTOMATIS: "Ditutup Otomatis",
}

function dapatkanIkonAksi(aksi: string): React.ElementType {
  switch (aksi) {
    case "DIBUAT":
      return Ticket
    case "DIVERIFIKASI":
      return ShieldCheck
    case "DITUGASKAN":
      return UserCheck
    case "STATUS_DIUBAH":
      return FileCheck2
    case "CATATAN":
      return FileText
    case "CHAT":
      return MessageCircle
    case "ESKALASI":
      return AlertTriangle
    case "DIKONFIRMASI":
      return ThumbsUp
    case "DIBUKA_KEMBALI":
      return RotateCcw
    case "DINILAI":
      return Star
    case "DITUTUP_OTOMATIS":
      return Clock
    default:
      return MessageSquare
  }
}

// =======================================================================
// 1. KOMPONEN PENGALIH MODE (DITAMPILKAN DI HEADER CARD POJOK KANAN)
// =======================================================================

export function PengalihModeRiwayat({
  mode,
  onGantiMode,
}: {
  mode: ModeTampilanRiwayat
  onGantiMode: (m: ModeTampilanRiwayat) => void
}) {
  return (
    <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onGantiMode("CHAT")}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
          mode === "CHAT"
            ? "bg-background text-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="Tampilan Gelembung Obrolan (WhatsApp / Telegram / iMessage)"
      >
        <MessageCircle className="size-3.5 text-sky-500" />
        <span>Chat Bubble</span>
      </button>

      <button
        type="button"
        onClick={() => onGantiMode("LINIMASA")}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
          mode === "LINIMASA"
            ? "bg-background text-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="Tampilan Rel Linimasa Terstruktur"
      >
        <FileText className="size-3.5 text-indigo-500" />
        <span>Linimasa</span>
      </button>
    </div>
  )
}

// =======================================================================
// 2. TAMPILAN GAYA CHAT BUBBLE (TIK-TOK-KAN: KIRI PETUGAS, KANAN PELANGGAN)
// =======================================================================

/** Sisi KIRI: Pesan Petugas / Tim Lapangan / Operator */
function GelembungPesanPetugas({ e }: { e: EntriRiwayat }) {
  const inisial = (e.olehNama || "P").slice(0, 2).toUpperCase()

  return (
    <div className="flex items-start gap-2.5 justify-start my-1.5">
      {/* Avatar Petugas di Kiri */}
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[10.5px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs border border-border/60">
        {inisial}
      </div>

      {/* Bubble Chat Petugas (Sisi Kiri) */}
      <div className="relative max-w-[84%] sm:max-w-[72%] rounded-2xl rounded-tl-xs border border-border/80 bg-muted/65 p-3.5 text-xs text-foreground shadow-2xs">
        <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
          <span className="font-semibold text-foreground">{e.olehNama}</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9.5px] font-medium text-primary">
            {e.oleh?.role ?? "PETUGAS"}
          </span>
        </div>

        <p className="leading-relaxed whitespace-pre-wrap">{e.catatan}</p>

        {e.fotoUrl && (
          <div className="mt-2">
            <BingkaiFoto
              src={e.fotoUrl}
              alt="Lampiran chat petugas"
              className="max-w-56 rounded-xl border border-border/60"
            />
          </div>
        )}

        <div className="mt-1.5 flex justify-end text-[10px] text-muted-foreground">
          {formatWaktu(e.createdAt)} WIB
        </div>
      </div>
    </div>
  )
}

/** Sisi KANAN: Pesan Pelanggan / Warga / Pelapor */
function GelembungPesanPelapor({ e }: { e: EntriRiwayat }) {
  const inisial = (e.olehNama || "W").slice(0, 2).toUpperCase()

  return (
    <div className="flex items-start gap-2.5 justify-end my-1.5">
      {/* Bubble Chat Pelanggan (Sisi Kanan ala WhatsApp / iMessage) */}
      <div className="relative max-w-[84%] sm:max-w-[72%] rounded-2xl rounded-tr-xs bg-sky-600 text-white dark:bg-sky-600 p-3.5 text-xs shadow-xs">
        <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-sky-100">
          <span className="font-semibold">{e.olehNama || "Pelapor"}</span>
          <span className="flex items-center gap-1 text-[10px] text-sky-200">
            <Eye className="size-2.5" />
            Warga
          </span>
        </div>

        <p className="leading-relaxed whitespace-pre-wrap text-white">
          {e.catatan}
        </p>

        {e.fotoUrl && (
          <div className="mt-2">
            <BingkaiFoto
              src={e.fotoUrl}
              alt="Lampiran chat pelapor"
              className="max-w-56 rounded-xl border border-white/20"
            />
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-sky-100/80">
          <span>{formatWaktu(e.createdAt)} WIB</span>
          <CheckCheck className="size-3 text-sky-200" />
        </div>
      </div>

      {/* Avatar Pelanggan di Kanan */}
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-700 text-[10.5px] font-bold text-white shadow-2xs">
        {inisial}
      </div>
    </div>
  )
}

/** Memo Catatan Internal Staf (Terpusat) */
function GelembungMemoInternal({ e }: { e: EntriRiwayat }) {
  return (
    <div className="my-2 max-w-[92%] sm:max-w-[82%] mx-auto rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3 text-xs shadow-2xs dark:bg-amber-500/[0.06]">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-amber-500/20 pb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
          <Lock className="size-3 text-amber-600 dark:text-amber-400" />
          <span>Catatan Internal Tim</span>
        </div>
        <span className="text-[10.5px] text-muted-foreground">
          {e.olehNama}
          {e.oleh?.role ? ` (${e.oleh.role})` : ""} · {formatWaktu(e.createdAt)}{" "}
          WIB
        </span>
      </div>

      <p className="leading-relaxed text-foreground whitespace-pre-wrap">
        {e.catatan}
      </p>

      {e.fotoUrl && (
        <div className="mt-2">
          <BingkaiFoto
            src={e.fotoUrl}
            alt="Foto internal"
            className="max-w-56 rounded-lg border border-amber-500/20"
          />
        </div>
      )}
    </div>
  )
}

/** Kapsul Peristiwa Sistem Terpusat */
function KapsulPeristiwaSistem({ e }: { e: EntriRiwayat }) {
  const nada = e.statusKe ? statusPengaduanStaf(e.statusKe) : null
  const Ikon = dapatkanIkonAksi(e.aksi)

  return (
    <div className="my-2.5 flex justify-center">
      <div className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-border/70 bg-muted/45 px-3.5 py-1 text-[11px] font-medium text-muted-foreground shadow-2xs backdrop-blur-xs">
        <Ikon className="size-3 text-foreground" />
        <span className="font-semibold text-foreground">
          {LABEL_AKSI[e.aksi] ?? e.aksi}
        </span>

        {nada && (
          <span className="inline-flex items-center gap-1 text-foreground">
            <span>·</span>
            <span
              className={cn("size-1.5 rounded-full shrink-0", nada.dotClass)}
            />
            {e.statusDari && (
              <span className="opacity-70">{e.statusDari} → </span>
            )}
            <span>{nada.label}</span>
          </span>
        )}

        {e.olehNama && e.aksi !== "DIBUAT" && (
          <span className="opacity-80">oleh {e.olehNama}</span>
        )}

        <span className="opacity-60">· {formatWaktu(e.createdAt)} WIB</span>
      </div>
    </div>
  )
}

// =======================================================================
// 3. TAMPILAN GAYA LINIMASA AUDIT
// =======================================================================

function EntriLinimasaAudit({ e }: { e: EntriRiwayat }) {
  const nada = e.statusKe ? statusPengaduanStaf(e.statusKe) : null
  const Ikon = dapatkanIkonAksi(e.aksi)
  const inisial = (e.olehNama || "U").slice(0, 2).toUpperCase()

  return (
    <li
      className={cn(
        "relative pb-6 pl-9.5 last:pb-0",
        "before:absolute before:top-4 before:bottom-0 before:left-2.75 before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border/80 before:to-border/40 last:before:hidden"
      )}
    >
      <div className="absolute top-0.5 left-0 flex size-5.5 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground shadow-2xs">
        <Ikon className="size-3" />
      </div>

      <div className="group relative flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs transition-colors hover:border-border">
        {/* Baris 1: Aksi + Status Dot Accent berdampingan di Kiri, Scope di Kanan */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-tight text-foreground">
              {LABEL_AKSI[e.aksi] ?? e.aksi}
            </span>

            {nada && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-foreground/90 shadow-2xs">
                <span
                  className={cn("size-1.5 rounded-full shrink-0", nada.dotClass)}
                />
                {e.statusDari && (
                  <span className="text-muted-foreground font-normal">
                    {e.statusDari} →{" "}
                  </span>
                )}
                <span>{nada.label}</span>
              </span>
            )}
          </div>

          <div>
            {!e.isPublik ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-700 dark:text-amber-400"
                title="Catatan koordinasi internal tim"
              >
                <Lock className="size-2.5 text-amber-600 dark:text-amber-400" />
                Internal
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10.5px] font-medium text-sky-700 dark:text-sky-400"
                title="Terlihat oleh warga di pelacakan publik"
              >
                <Eye className="size-2.5 text-sky-600 dark:text-sky-400" />
                Publik
              </span>
            )}
          </div>
        </div>

        {/* Baris 2: Pelaku & Waktu */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground/90">
            <div className="flex size-4.5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
              {inisial}
            </div>
            <span>{e.olehNama}</span>
          </div>

          {e.oleh?.role && (
            <span className="rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
              {e.oleh.role}
            </span>
          )}

          <span>·</span>

          <time
            dateTime={e.createdAt}
            className="flex items-center gap-1 text-[11px]"
          >
            <Clock className="size-3 opacity-60" />
            {formatWaktu(e.createdAt)} WIB
          </time>
        </div>

        {/* Baris 3: Catatan */}
        {e.catatan && (
          <div
            className={cn(
              "rounded-lg p-3 text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap",
              e.aksi === "CHAT"
                ? "border border-teal-500/20 bg-teal-500/[0.03]"
                : e.aksi === "ESKALASI"
                  ? "border border-rose-500/20 bg-rose-500/[0.03]"
                  : !e.isPublik
                    ? "border border-amber-500/20 bg-amber-500/[0.03]"
                    : "border border-border/60 bg-muted/30"
            )}
          >
            {e.aksi === "CHAT" && (
              <div className="mb-1 flex items-center gap-1 text-[10.5px] font-semibold text-teal-700 dark:text-teal-400">
                <MessageCircle className="size-3" />
                <span>Pesan Chat:</span>
              </div>
            )}
            <p>{e.catatan}</p>
          </div>
        )}

        {e.fotoUrl && (
          <div className="mt-0.5 flex flex-col gap-1.5">
            <span className="text-[10.5px] font-medium text-muted-foreground">
              Dokumentasi Foto:
            </span>
            <BingkaiFoto
              src={e.fotoUrl}
              alt="Foto tindak lanjut"
              className="max-w-56 rounded-lg border border-border/70 shadow-2xs"
            />
          </div>
        )}
      </div>
    </li>
  )
}

// =======================================================================
// 4. KOMPONEN UTAMA
// =======================================================================

export function LinimasaStaf({
  riwayat,
  modeTampilan: modeExternal,
  onGantiMode,
}: {
  riwayat: EntriRiwayat[]
  modeTampilan?: ModeTampilanRiwayat
  onGantiMode?: (m: ModeTampilanRiwayat) => void
}) {
  const [filterAkses, setFilterAkses] = React.useState<
    "SEMUA" | "PUBLIK" | "INTERNAL"
  >("SEMUA")
  const [modeInternal, setModeInternal] =
    React.useState<ModeTampilanRiwayat>("CHAT")

  const modeTampilan = modeExternal ?? modeInternal
  const setMode = onGantiMode ?? setModeInternal

  const jumlahPublik = riwayat.filter((r) => r.isPublik).length
  const jumlahInternal = riwayat.filter((r) => !r.isPublik).length

  const riwayatTersaring = React.useMemo(() => {
    if (filterAkses === "PUBLIK") return riwayat.filter((r) => r.isPublik)
    if (filterAkses === "INTERNAL") return riwayat.filter((r) => !r.isPublik)
    return riwayat
  }, [riwayat, filterAkses])

  if (riwayat.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center text-muted-foreground">
        <Clock className="size-5 mb-2 opacity-40" />
        <p className="text-sm">Belum ada riwayat tindak lanjut.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Toolbar Filter Kategori */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterAkses("SEMUA")}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
              filterAkses === "SEMUA"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            <span>Semua</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                filterAkses === "SEMUA"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {riwayat.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterAkses("PUBLIK")}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
              filterAkses === "PUBLIK"
                ? "bg-sky-600 text-white shadow-2xs"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            <Eye className="size-3" />
            <span>Publik</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                filterAkses === "PUBLIK"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {jumlahPublik}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterAkses("INTERNAL")}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
              filterAkses === "INTERNAL"
                ? "bg-amber-600 text-white shadow-2xs"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            <Lock className="size-3" />
            <span>Internal</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                filterAkses === "INTERNAL"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {jumlahInternal}
            </span>
          </button>
        </div>

        {/* Fallback switcher jika tidak dipasang di header card */}
        {!modeExternal && (
          <PengalihModeRiwayat mode={modeTampilan} onGantiMode={setMode} />
        )}
      </div>

      {/* Konten Riwayat */}
      {riwayatTersaring.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Tidak ada entri riwayat untuk kategori filter ini.
        </p>
      ) : modeTampilan === "CHAT" ? (
        // Mode Obrolan Chat Bubble (Tik-Tok-Kan: Kiri Petugas, Kanan Pelanggan)
        <div className="flex flex-col gap-1.5 rounded-xl bg-muted/20 p-2 sm:p-3 border border-border/40">
          {riwayatTersaring.map((e) => {
            // 1. Pesan Chat
            if (e.aksi === "CHAT") {
              const isPelapor =
                !e.oleh ||
                e.oleh.role === "USER" ||
                e.olehNama.toLowerCase().includes("pelapor")

              // KANAN: Pelanggan/Warga, KIRI: Petugas/Staf
              return isPelapor ? (
                <GelembungPesanPelapor key={e.id} e={e} />
              ) : (
                <GelembungPesanPetugas key={e.id} e={e} />
              )
            }

            // 2. Catatan Internal Staf
            if (e.aksi === "CATATAN" || !e.isPublik) {
              return <GelembungMemoInternal key={e.id} e={e} />
            }

            // 3. Peristiwa Sistem / Transisi Status
            return <KapsulPeristiwaSistem key={e.id} e={e} />
          })}
        </div>
      ) : (
        // Mode Linimasa Konvensional
        <ol className="flex flex-col pt-1">
          {riwayatTersaring.map((e) => (
            <EntriLinimasaAudit key={e.id} e={e} />
          ))}
        </ol>
      )}
    </div>
  )
}
