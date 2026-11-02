import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { DrdView } from "@/features/dashboard/drd/DrdView"
import { auth } from "@/lib/auth/index"
import { canAccess } from "@/lib/server/middleware/RBAC"

export const metadata: Metadata = { title: "Laporan DRD" }

export default async function LaporanDRDPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (!canAccess("LAPORAN_DRD", session.user.role)) redirect("/dashboard")

  return <DrdView />
}
