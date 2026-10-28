import type { ChartConfig } from "@/components/ui/chart"
import type { JenisHari, Status } from "./tipe"

export const URUTAN_JENIS: JenisHari[] = ["kerja", "akhirpekan", "libur", "lembur"]

/** Warna batang grafik; nilai literal agar tidak bergantung pada variabel tema. */
const WARNA = {
  kerja: "oklch(0.623 0.214 259.8)",
  akhirpekan: "oklch(0.708 0 0 / 0.45)",
  libur: "oklch(0.769 0.188 70.1)",
  lembur: "oklch(0.606 0.25 292.7)",
} as const

export const GAYA_HARI: Record<
  JenisHari,
  { label: string; kepala: string; sel: string; teks: string; titik: string }
> = {
  kerja: {
    label: "Hari kerja",
    kepala: "bg-muted text-foreground",
    sel: "",
    teks: "text-foreground",
    titik: "bg-blue-500",
  },
  akhirpekan: {
    label: "Sabtu/Minggu",
    kepala: "bg-muted/40 text-muted-foreground",
    sel: "bg-muted/30",
    teks: "text-muted-foreground",
    titik: "bg-foreground/25",
  },
  libur: {
    label: "Libur nasional",
    kepala: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    sel: "bg-amber-500/5",
    teks: "text-amber-700 dark:text-amber-400",
    titik: "bg-amber-500",
  },
  lembur: {
    label: "Lembur (menyetor di hari libur)",
    kepala: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    sel: "bg-violet-500/5",
    teks: "text-violet-700 dark:text-violet-400",
    titik: "bg-violet-500",
  },
}

export const KONFIG_GRAFIK = {
  jumlah: { label: "Setoran" },
  kerja: { label: GAYA_HARI.kerja.label, color: WARNA.kerja },
  akhirpekan: { label: GAYA_HARI.akhirpekan.label, color: WARNA.akhirpekan },
  libur: { label: GAYA_HARI.libur.label, color: WARNA.libur },
  lembur: { label: "Lembur", color: WARNA.lembur },
} satisfies ChartConfig

export const WARNA_BATANG: Record<JenisHari, string> = {
  kerja: "var(--color-kerja)",
  akhirpekan: "var(--color-akhirpekan)",
  libur: "var(--color-libur)",
  lembur: "var(--color-lembur)",
}

export const GAYA_STATUS: Record<Status, { label: string; titik: string }> = {
  selesai: { label: "Selesai", titik: "bg-emerald-500" },
  jalan: { label: "Jalan", titik: "bg-blue-500" },
  diam: { label: "Diam", titik: "bg-amber-500" },
  belum: { label: "Belum mulai", titik: "bg-red-500" },
}
