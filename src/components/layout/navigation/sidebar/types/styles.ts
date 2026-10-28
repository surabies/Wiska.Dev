// components/layout/navigation/sidebar/styles.ts
// Kelas Tailwind yang dipakai bersama. Warna semuanya berasal dari token di
// globals.css (--sidebar-*), jadi tema terang/gelap otomatis ikut.
//
// SEMUA baris (menu utama, grup, kembali, halaman) memakai satu bentuk yang
// sama lewat navRowClass(): satu baris 36px, ikon kiri, teks, aksesori kanan.
//   normal : teks abu
//   hover  : latar --sidebar-hover (gray-100), teks gelap
//   aktif  : latar --sidebar-accent (gray-200), teks gelap, tanpa garis tepi

import { cn } from "@/lib/utils"

/** Cincin fokus — hanya muncul untuk navigasi keyboard (bukan klik mouse). */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50"

/** Label seksi kecil huruf kapital (nama folder di dalam grup). */
export const SECTION_LABEL =
  "px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/70"

/** Bentuk satu baris menu. `group/row` dipakai untuk efek hover ikon/panah. */
export function navRowClass(active: boolean) {
  return cn(
    "group/row flex h-control w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm transition-colors",
    FOCUS_RING,
    active
      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-accent-foreground",
  )
}
