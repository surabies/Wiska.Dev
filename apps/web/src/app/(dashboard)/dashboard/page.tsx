import type { Metadata } from "next"
import { RingkasanView } from "@/features/dashboard/ringkasan/RingkasanView"

export const metadata: Metadata = { title: "Ringkasan" }

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  return <RingkasanView searchParams={searchParams} />
}
