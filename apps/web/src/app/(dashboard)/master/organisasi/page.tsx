import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import { PageContainer } from "@/components/layout/index"
import { KelolaOrganisasi } from "@/features/dashboard/organisasi/components/KelolaOrganisasi"

export const metadata: Metadata = {
  title: "Struktur Organisasi (SOTK)",
}

export default async function OrganisasiPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "USER" || session.user.role === "PELAKSANA") {
    redirect("/dashboard")
  }

  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col gap-4"
      breadcrumbs={[
        { label: "Master", href: "/master/organisasi" },
        { label: "Struktur Organisasi (SOTK)" },
      ]}
    >
      <KelolaOrganisasi />
    </PageContainer>
  )
}
