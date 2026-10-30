import type { Metadata } from "next"
import { PageContainer } from "@/components/layout"
import { TarifGrid } from "@/features/dashboard/components/grids/tarif-grid"

export const metadata: Metadata = { title: "Struktur Tarif · Tirtawening" }

export default function Page() {
  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col"
      breadcrumbs={[
        { label: "Tagihan & Pembayaran", href: "/tagihan" },
        { label: "Struktur Tarif" },
      ]}
    >
      <TarifGrid />
    </PageContainer>
  )
}