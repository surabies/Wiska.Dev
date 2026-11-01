import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PageContainer } from "@/components/layout"
import { JendelaLaporMandiri } from "@/features/dashboard/components/pengaturan/jendela-lapor-mandiri"
import { auth } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Pengaturan Laporan Mandiri",
}

export default async function PengaturanLaporanMandiriPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard")

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
