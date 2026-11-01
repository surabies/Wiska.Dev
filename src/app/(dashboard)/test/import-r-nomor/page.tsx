import {  PageContainer } from "@/components/layout"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import type { Metadata } from "next"
import { PemutusanGrid } from "@/features/dashboard/components/grids/pemutusan-grid"
import { TerapkanStatusPemutusan } from "@/features/dashboard/components/test/import-r-nomor/terapkan-status"


export const metadata: Metadata = { title: "Import R-Nomor" }

export default async function ImporRNomorPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <PageContainer
      breadcrumbs={[
        { label: "Module Test", href: "/test/import-r-nomor" },
        { label: "Import R-Nomor" },
      ]}
    >
      <div className="flex flex-col gap-4">
        <TerapkanStatusPemutusan />
        <PemutusanGrid />
      </div>
    </PageContainer>
  )
}
