import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import { PageContainer } from "@/components/layout/index"
import { PetugasClient } from "@/features/dashboard/petugas/components/KlienPetugas"
import { adalahSupervisorUp } from "@/features/dashboard/lib/Wewenang"

export const metadata: Metadata = { title: "Petugas Pencatat Meter" }

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
        { label: "Master", href: "/master/petugas" },
        { label: "Petugas" },
      ]}
    >
      <PetugasClient bolehUbah={adalahSupervisorUp(session.user.role)} />
    </PageContainer>
  )
}
