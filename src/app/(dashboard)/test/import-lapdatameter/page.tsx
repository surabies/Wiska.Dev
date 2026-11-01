import {  PageContainer } from "@/components/layout"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ImporDataClient } from "@/features/dashboard/components/test/import-lapdatameter/impor-data-client"
import type { Metadata } from "next"


export const metadata: Metadata = { title: "Import Lapdatameter" }

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
