import type { Metadata } from "next"
import { auth } from "@/lib/auth/auth";
import { PageContainer } from "@/components/layout"
import { VerifikasiLapangan } from "@/features/dashboard/components/verifikasi/verifikasi-lapangan";

export const metadata: Metadata = { title: "Verifikasi Pembacaan · Tirtawening" }

export default async function VerifikasiLapanganPage() {
  const session = await auth();
  // Role utuh (bukan boolean bisaAksi): verifikasi berjenjang V1/V2/V3
  // butuh tingkatan berbeda per ring (Supervisor/Manager/Senior Manager) —
  // pemetaan grup role ada di komponen client, server tetap penjaga aslinya.

  return <PageContainer
  className="flex min-h-0 flex-1 flex-col"
      breadcrumbs={[
        { label: "Pengolahan Data", href: "/pengolahan-data/dpm" },
        { label: "Daftar Pencatatan Meter" },
      ]}
    >
    <VerifikasiLapangan role={session?.user?.role ?? ""} />
    </PageContainer>
}
