import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import { PageContainer } from "@/components/layout/index"
import { KelolaTarifView } from "@/features/dashboard/tarif/components/KelolaTarifView"

export const metadata: Metadata = { title: "Struktur Tarif & Harga Air" }

export default async function TarifPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "USER" || session.user.role === "PELAKSANA") {
    redirect("/dashboard")
  }

  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col gap-4"
      breadcrumbs={[
        { label: "Master", href: "/tarif" },
        { label: "Struktur Tarif & Harga Air" },
      ]}
    >
      <KelolaTarifView />
    </PageContainer>
  )
}
