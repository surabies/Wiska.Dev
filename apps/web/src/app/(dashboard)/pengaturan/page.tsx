import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PageContainer } from "@/components/layout/index"
import { JendelaLaporMandiri } from "@/features/dashboard/pengaturan/components/JendelaLaporMandiri"
import { auth } from "@/lib/auth/index"

export const metadata: Metadata = {
  title: "Pengaturan Laporan Mandiri",
}

export default async function PengaturanPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "USER" || session.user.role === "PELAKSANA") {
    redirect("/dashboard")
  }

  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col gap-4"
      breadcrumbs={[
        { label: "Pengaturan", href: "/pengaturan" },
        { label: "Laporan Mandiri" },
      ]}
    >
      <JendelaLaporMandiri />
    </PageContainer>
  )
}
