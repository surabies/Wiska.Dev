import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import { PageContainer } from "@/components/layout/index"
import { ImporCadanganClient } from "@/features/dashboard/impor/components/KlienImporCadangan"

export const metadata: Metadata = { title: "Import Backup" }

export default async function ImporBackupPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  // Menulis dijaga SUPERVISOR_UP di server (lihat pencatat.router.ts). Di sini
  // hanya soal tidak memajang kontrol yang pasti ditolak — server tetap
  // penjaga aslinya.
  return (
    <PageContainer
      breadcrumbs={[
        { label: "Tools", href: "/tools/running-text" },
        { label: "Import Backup" },
      ]}
    >
      <ImporCadanganClient />
    </PageContainer>
  )
}
