import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PageContainer } from "@/components/layout"
import { HalamanUrutanPelanggan } from "@/features/dashboard/components/pemetaan-rute/halaman-urutan-pelanggan"
import { adalahSupervisorUp } from "@/features/dashboard/lib/wewenang"

export const metadata: Metadata = { title: "Urutan Pelanggan · Tirtawening" }

export default async function UrutanPelangganPage({
  params,
  searchParams,
}: {
  params: Promise<{ ruteId: string }>
  searchParams: Promise<{ kode?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const [{ ruteId }, { kode }] = await Promise.all([params, searchParams])

  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-var(--navbar-h)-4rem)] lg:flex-none lg:overflow-hidden"
      breadcrumbs={[
        { label: "Master", href: "/master/urut" },
        { label: "Pemetaan Rute", href: "/master/urut" },
        { label: `Urutan ${kode ?? ruteId}` },
      ]}
    >
      <HalamanUrutanPelanggan
        ruteId={ruteId}
        kodeRute={kode ?? ruteId}
        bolehUbah={adalahSupervisorUp(session.user.role)}
      />
    </PageContainer>
  )
}
