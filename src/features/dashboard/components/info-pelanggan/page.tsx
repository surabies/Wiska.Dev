import type { Metadata } from "next"
import { Suspense } from "react"
import { InfoPelangganView } from "@/features/dashboard/components/info-pelanggan"

export const metadata: Metadata = { title: "Info Pelanggan · Tirtawening" }

export default function InfoPelangganPage() {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      {/* useSearchParams di view memerlukan Suspense. */}
      <Suspense fallback={null}>
        <InfoPelangganView />
      </Suspense>
    </div>
  )
}
