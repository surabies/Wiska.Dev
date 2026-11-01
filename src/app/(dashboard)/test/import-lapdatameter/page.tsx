import { PageContainer } from "@/components/layout/index"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import { ImporLapdatameterView } from "@/features/dashboard/impor-lapdatameter/ImporLapdatameterView"
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
      <ImporLapdatameterView />
    </PageContainer>
  )
}
