import { PageContainer } from "@/components/layout/index"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import { PbpkView } from "@/features/dashboard/pbpk/PbpkView"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Import PBPK" }

export default async function ImportPbpkPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <PageContainer
      breadcrumbs={[
        { label: "Module Test", href: "/test/import-pbpk" },
        { label: "Import PBPK" },
      ]}
    >
      <PbpkView role={session.user.role} />
    </PageContainer>
  )
}
