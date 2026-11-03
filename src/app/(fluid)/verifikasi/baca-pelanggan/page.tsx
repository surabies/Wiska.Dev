import type { Metadata } from "next"
import { VerifikasiMandiri } from "@/features/dashboard/verifikasi/components/VerifikasiMandiri"
import { auth } from "@/lib/auth/Auth"

export const metadata: Metadata = { title: "Verifikasi Pembacaan Pelanggan" }
/// Cermin ROLE_GROUPS.STAFF_UP (server/middleware/rbac.ts). Server tetap
/// penjaga aslinya; ini hanya menentukan apakah tombol aksi tampil.
const STAFF_UP = new Set([
  "SUPER_ADMIN",
  "DIREKSI",
  "SENIOR_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "STAFF",
])

export default async function VerifikasiMandiriPage() {
  const session = await auth()
  const role = session?.user?.role ?? ""
  const bisaAksi = STAFF_UP.has(role)

  return <VerifikasiMandiri bisaAksi={bisaAksi} role={role} />
}
