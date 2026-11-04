import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import { PageContainer } from "@/components/layout/index"
import { LaporanHarianClient } from "@/features/dashboard/laporan-harian/components/KlienLaporanHarian"

export const metadata: Metadata = { title: "Laporan Pencatatan Meter" }

export default async function LaporanPencatatanMeterPage() {
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
