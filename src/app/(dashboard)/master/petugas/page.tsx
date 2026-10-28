import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PageContainer } from "@/components/layout"
import { PetugasClient } from "@/features/dashboard/components/petugas/petugas-client"
import { adalahSupervisorUp } from "@/features/dashboard/lib/wewenang"

export const metadata: Metadata = { title: "Petugas Pencatat Meter · Tirtawening" }

export default async function PetugasPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  // Menulis dijaga SUPERVISOR_UP di server (lihat pencatat.router.ts). Di sini
  // hanya soal tidak memajang kontrol yang pasti ditolak — server tetap
  // penjaga aslinya.
  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col"
      breadcrumbs={[
        { label: "Pencatat Meter", href: "/master/petugas" },
        { label: "Petugas" },
      ]}
    >
      <PetugasClient bolehUbah={adalahSupervisorUp(session.user.role)} />
    </PageContainer>
  )
}