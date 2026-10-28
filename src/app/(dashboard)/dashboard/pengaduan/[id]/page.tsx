// app/(dashboard)/dashboard/pengaduan/[id]/page.tsx — /dashboard/pengaduan/:id
//
// HALAMAN detail satu tiket (menggantikan sheet samping di daftar — detail
// tiket terlalu kompleks untuk lebar sheet: duduk perkara, wilayah, chat,
// penyelesaian berfoto, eskalasi, linimasa penuh). Route concern saja;
// seluruh isi + data-fetching ada di DetailTiket (client component, karena
// semua aksinya interaktif dan lewat /api/v1).

import type { Metadata } from "next"
import { PageContainer } from "@/components/layout"
import { DetailTiket } from "@/features/dashboard/components/pengaduan/detail-tiket"

export const metadata: Metadata = { title: "Detail Pengaduan" }

export default async function DetailPengaduanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PageContainer
      breadcrumbs={[
        { label: "Pengaduan", href: "/dashboard/pengaduan" },
        { label: "Detail tiket" },
      ]}
    >
      <DetailTiket pengaduanId={id} />
    </PageContainer>
  )
}