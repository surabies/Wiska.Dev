import {  PageContainer } from "@/components/layout"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Metadata } from "next/dist/lib/metadata/types/metadata-interface"
import { PemutusanGrid } from "@/features/dashboard/components/grids/pemutusan-grid"
import { TerapkanStatusPemutusan } from "@/features/dashboard/components/test/import-r-nomor/terapkan-status"


export const metadata: Metadata = { title: "Import Lapdatameter · Tirtawening" }

export default async function ImportLapdatameterPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <PageContainer
      breadcrumbs={[
        { label: "Module Test", href: "/test/import-lapdatameter" },
        { label: "Import Lapdatameter" },
      ]}
    >
      <div className="flex flex-col gap-4">
        <TerapkanStatusPemutusan />
        <PemutusanGrid />
      </div>
    </PageContainer>
  )
}
