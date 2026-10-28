import {  PageContainer } from "@/components/layout"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PbpkClient } from "@/features/dashboard/components/pbpk/pbpk-client"
import { Metadata } from "next/dist/lib/metadata/types/metadata-interface"


export const metadata: Metadata = { title: "Import PBPK · Tirtawening" }

export default async function ImportPbpkPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <PageContainer
      breadcrumbs={[
        { label: "Tools", href: "/tools/running-text" },
        { label: "Import PBPK" },
      ]}
    >
      <PbpkClient role={session.user.role} />
    </PageContainer>
  )
}
