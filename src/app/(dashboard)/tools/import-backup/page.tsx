import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PageContainer } from "@/components/layout"
import { ImporCadanganClient } from "@/features/dashboard/components/import/impor-cadangan-client"




export const metadata: Metadata = { title: "Import Backup · Tirtawening" }

export default async function PetugasPage() {
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