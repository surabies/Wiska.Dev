// components/layout/templates/DashboardLayoutTemplate.tsx
// Tugas: membungkus semua halaman dashboard dengan kerangka (sidebar + pola).
// Tanda kurung pada (dashboard) = route group: tidak muncul di URL.
import type { ReactNode } from "react"
import { DashboardShell } from "@/components/layout"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
