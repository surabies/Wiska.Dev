import type { Metadata } from "next"
import { PageContainer } from "@/components/layout/index"
import { LaporanMandiriGrid } from "@/features/dashboard/laporan-mandiri/components/LaporanMandiriGrid"

export const metadata: Metadata = { title: "Stand Konsumen" }

export default function StandKonsumenPage() {
  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col"
      breadcrumbs={[
        { label: "Pemetaan Rute", href: "/meter/pemetaan" },
        { label: "Stand Konsumen" },
      ]}
    >
      <LaporanMandiriGrid />
    </PageContainer>
  )
}
