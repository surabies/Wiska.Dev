import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import { PageContainer } from "@/components/layout/index"
import { PemetaanRuteClient } from "@/features/dashboard/pemetaan-rute/components/KlienPemetaanRute"
import { adalahSupervisorUp } from "@/features/dashboard/lib/Wewenang"

export const metadata: Metadata = { title: "Pemetaan Rute" }

export default async function PemetaanPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  // Penjaga asli ada di server; di sini hanya menyembunyikan tombol tulis
  // (tambah, lepas, urutkan) bagi peran yang pasti ditolak.
  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-var(--navbar-h)-4rem)] lg:flex-none lg:overflow-hidden"
      breadcrumbs={[
        { label: "Master", href: "/master/urut" },
        { label: "Pemetaan Rute" },
      ]}
    >
      <PemetaanRuteClient bolehUbah={adalahSupervisorUp(session.user.role)} />
    </PageContainer>
  )
}
