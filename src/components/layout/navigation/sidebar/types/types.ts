// components/layout/navigation/sidebar/types.ts

import type { NavFolder, NavItem } from "@/config/navigation"

/** Halaman aktif + rantai folder induknya (hasil findActiveNav). */
export type ActiveInfo = {
  item?: NavItem
  trail: readonly NavFolder[]
}

/** Arah animasi geser: masuk ke grup (forward) atau kembali ke root (back). */
export type Direction = "forward" | "back"
