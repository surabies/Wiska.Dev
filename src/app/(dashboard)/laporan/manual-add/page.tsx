import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PageContainer } from "@/components/layout"
import { auth } from "@/lib/auth"
import { ManualAddClient } from "@/features/dashboard/components/manual-add/manual-add-client"

export const metadata: Metadata = {
  title: "Manual Add · Tirtawening",
}

export default async function ManualAddPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <PageContainer
      breadcrumbs={[
        { label: "Laporan", href: "/laporan/manual-add" },
        { label: "Manual Add" },
      ]}
    >
      <ManualAddClient />
    </PageContainer>
  )
}
