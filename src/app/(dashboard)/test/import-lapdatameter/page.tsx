import {  PageContainer } from "@/components/layout"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ImporDataClient } from "@/features/dashboard/components/test/import-lapdatameter/impor-data-client"
import { Metadata } from "next/dist/lib/metadata/types/metadata-interface"


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
      <ImporDataClient />
    </PageContainer>
  )
}
