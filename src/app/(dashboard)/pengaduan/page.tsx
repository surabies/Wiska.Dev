import type { Metadata } from "next"
import { PageContainer } from "@/components/layout/index"
import { PapanPengaduan } from "@/features/dashboard/pengaduan/components/papan-pengaduan/index"

export const metadata: Metadata = { title: "Pengaduan" }

export default async function PengaduanPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const { q } = await searchParams

  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col"
      breadcrumbs={[{ label: "Pengaduan", href: "/pengaduan" }]}
    >
      <PapanPengaduan initialQ={typeof q === "string" ? q : ""} />
    </PageContainer>
  )
}
