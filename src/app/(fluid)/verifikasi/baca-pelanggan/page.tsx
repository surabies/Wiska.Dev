import type { Metadata } from "next"
import { PageContainer } from "@/components/layout"
import { VerifikasiMandiri } from "@/features/dashboard/components/verifikasi/verifikasi-mandiri";
import { auth } from "@/lib/auth/auth";

export const metadata: Metadata = { title: "Verifikasi Pembacaan · Tirtawening" }
/// Cermin ROLE_GROUPS.STAFF_UP (server/middleware/rbac.ts). Server tetap
/// penjaga aslinya; ini hanya menentukan apakah tombol aksi tampil.
const STAFF_UP = new Set([
  "SUPER_ADMIN",
  "DIREKSI",
  "SENIOR_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "STAFF",
]);

export default async function VerifikasiMandiriPage() {
  const session = await auth();
  const bisaAksi = STAFF_UP.has(session?.user?.role ?? "");

  return <PageContainer
  className="flex min-h-0 flex-1 flex-col"
      breadcrumbs={[
        { label: "Pengolahan Data", href: "/pengolahan-data/dpm" },
        { label: "Pembacaan Pelanggan" },
      ]}
    >
    <VerifikasiMandiri bisaAksi={bisaAksi} />
  </PageContainer>
}
