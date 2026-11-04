import type { Metadata } from "next"
import { auth } from "@/lib/auth/Auth"
import { VerifikasiLapangan } from "@/features/dashboard/verifikasi/components/VerifikasiLapangan"

export const metadata: Metadata = { title: "Verifikasi Pembacaan Petugas" }

export default async function VerifikasiLapanganPage() {
  const session = await auth()
  // Role utuh (bukan boolean bisaAksi): verifikasi berjenjang V1/V2/V3
  // butuh tingkatan berbeda per ring (Supervisor/Manager/Senior Manager) —
  // pemetaan grup role ada di komponen client, server tetap penjaga aslinya.

  return <VerifikasiLapangan role={session?.user?.role ?? ""} />
}
