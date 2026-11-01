import { PageContainer } from "@/components/layout/index"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import type { Metadata } from "next"
import { PemutusanView } from "@/features/dashboard/pemutusan/PemutusanView"

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
      <PemutusanView />
    </PageContainer>
  )
}
