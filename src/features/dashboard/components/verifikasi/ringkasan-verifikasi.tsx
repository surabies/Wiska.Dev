"use client";

// features/dashboard/components/verifikasi/ringkasan-verifikasi.tsx — strip 4
// kartu statistik yang BISA DILIPAT, ringkasan sebaris untuk keadaan terlipat,
// dan dropdown periode. Dipakai halaman petugas DAN pelanggan.
//
// WARNA mengikuti arti yang sama dengan tabel (warna-ring.ts): amber =
// menunggu, hijau = selesai, biru = progres, abu = total.
import {
  CheckmarkCircle02Icon, HourglassIcon, PercentCircleIcon, Task01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/native-select";
import { formatPeriode } from "@/features/public/lib/format";
import { StatCard } from "../stat-card";
import type { StatsVerifikasi } from "./types/tipe";

export function PilihPeriode({
  periodes,
  nilai,
  onGanti,
}: {
  periodes: number[];
  nilai: number | null;
  onGanti: (p: number | null) => void;
}) {
  return (
    <NativeSelect
      aria-label="Filter periode"
      value={nilai ?? ""}
      onChange={(e) => onGanti(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
      className="h-8 w-auto min-w-36 text-xs"
    >
      <option value="">Semua periode</option>
      {periodes.map((p) => (
        <option key={p} value={p}>
          {formatPeriode(p)}
        </option>
      ))}
    </NativeSelect>
  );
}

/// Angka turunan dihitung SATU kali di sini, dipakai kartu dan ringkasan sebaris
/// — dua tampilan tidak boleh menghitung "progres" dengan cara berbeda.
function hitung(stats: StatsVerifikasi | null) {
  const total = stats?.total ?? 0;
  const menunggu = stats?.menunggu ?? 0;
  const ditolak = stats?.ditolak ?? 0;
  const diverifikasi = stats?.diverifikasi ?? 0;
  const selesai = diverifikasi + ditolak;
  const progres = total > 0 ? Math.round((selesai / total) * 100) : 0;
  return { total, menunggu, ditolak, diverifikasi, selesai, progres };
}

const id = (n: number) => n.toLocaleString("id-ID");

/// Strip kartu. `terbuka` menggerakkan lipatan gaya accordion: baris grid
/// bergeser 1fr ↔ 0fr, jadi tingginya beranimasi TANPA mengukur tinggi lewat
/// JS, dan tabel di bawahnya otomatis mengisi ruang yang dilepas.
export function RingkasanVerifikasi({
  stats,
  periode,
  terbuka = true,
}: {
  stats: StatsVerifikasi | null;
  /// Periode yang sedang dihitung — ditulis di kartu supaya kartu dan tabel
  /// yang bicara soal bulan berbeda tidak lolos tanpa terlihat.
  periode: number | null;
  terbuka?: boolean;
}) {
  const h = hitung(stats);
  const labelPeriode = periode ? formatPeriode(periode) : "Semua periode";

  return (
    // -mb-3 saat terlipat: induknya flex-col dengan gap-3, dan elemen
    // setinggi 0 tetap menyisakan gap itu. Margin negatif menghapusnya.
    <div
      aria-hidden={!terbuka}
      className={cn(
        "grid shrink-0 transition-[grid-template-rows,margin] duration-200 ease-out motion-reduce:transition-none",
        terbuka ? "grid-rows-[1fr]" : "-mb-3 grid-rows-[0fr]"
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total laporan" nilai={id(h.total)} icon={Task01Icon} keterangan={labelPeriode} />
          <StatCard
            label="Menunggu"
            nilai={id(h.menunggu)}
            icon={HourglassIcon}
            keterangan="Belum diverifikasi"
            // Amber hanya saat ada antrean; kosong = netral, bukan "aman" hijau.
            nada={h.menunggu > 0 ? "peringatan" : "netral"}
          />
          <StatCard
            label="Terverifikasi"
            nilai={id(h.diverifikasi)}
            icon={CheckmarkCircle02Icon}
            keterangan={`${id(h.ditolak)} perlu cek ulang`}
            nada="sukses"
          />
          <StatCard
            label="Progres selesai"
            nilai={`${h.progres}%`}
            icon={PercentCircleIcon}
            keterangan={`${id(h.selesai)} dari ${id(h.total)} laporan`}
            nada="info"
            progres={h.progres}
          />
        </div>
      </div>
    </div>
  );
}

/// Versi sebaris saat kartu terlipat — angkanya tidak boleh ikut hilang.
export function RingkasanSebaris({ stats }: { stats: StatsVerifikasi | null }) {
  const h = hitung(stats);
  return (
    <p className="text-muted-foreground hidden items-center gap-3 text-xs tabular-nums lg:flex">
      <span>Total <strong className="text-foreground font-medium">{id(h.total)}</strong></span>
      <span>
        Menunggu{" "}
        <strong className={cn("font-medium", h.menunggu > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
          {id(h.menunggu)}
        </strong>
      </span>
      <span>Resmi <strong className="font-medium text-green-700 dark:text-green-400">{id(h.diverifikasi)}</strong></span>
      <span><strong className="font-medium text-blue-700 dark:text-blue-400">{h.progres}%</strong> selesai</span>
    </p>
  );
}