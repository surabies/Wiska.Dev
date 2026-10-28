import type { Metadata } from "next"
import {  PageContainer } from "@/components/layout"
import { LaporanMandiriGrid } from "@/features/dashboard/components/grids/laporan-mandiri-grid"


export const metadata: Metadata = { title: "Laporan mandiri" }


export default function Page() {
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
