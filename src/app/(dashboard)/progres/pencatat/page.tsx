import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PageContainer } from "@/components/layout"
import { LaporanHarianClient } from "@/features/dashboard/components/laporan-harian/laporan-harian-client"


export const metadata: Metadata = { title: "Petugas Pencatat Meter · Tirtawening" }

export default async function PetugasPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  // Menulis dijaga SUPERVISOR_UP di server (lihat pencatat.router.ts). Di sini
  // hanya soal tidak memajang kontrol yang pasti ditolak — server tetap
  // penjaga aslinya.
  return (
    <PageContainer
      breadcrumbs={[
        { label: "Laporan", href: "/laporan/pencatat" },
        { label: "Pencatat Meter" },
      ]}
    >
      <LaporanHarianClient />
    </PageContainer>
  )
}