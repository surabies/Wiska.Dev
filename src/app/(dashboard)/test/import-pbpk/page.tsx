import {  PageContainer } from "@/components/layout"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PbpkClient } from "@/features/dashboard/components/pbpk/pbpk-client"
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
      <PbpkClient role={session.user.role} />
    </PageContainer>
  )
}
