import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import { PageContainer } from "@/components/layout/index"
import { KelolaWilayah } from "@/features/dashboard/wilayah/components/KelolaWilayah"

export const metadata: Metadata = {
  title: "Wilayah Administratif",
}

export default async function WilayahPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "USER" || session.user.role === "PELAKSANA") {
    redirect("/dashboard")
  }

  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col gap-4"
      breadcrumbs={[
        { label: "Master", href: "/master/wilayah" },
        { label: "Wilayah Administratif" },
      ]}
    >
      <KelolaWilayah />
    </PageContainer>
  )
}
