import type { Metadata } from "next"
import { Suspense } from "react"
import { InfoPelangganView } from "@/features/dashboard/info-pelanggan/index"

export const metadata: Metadata = { title: "Info Pelanggan" }

// Tanpa breadcrumb: judul halaman berada di tengah, di dalam view.
export default function InfoPelangganPage() {
  return (
    <div className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col">
      {/* useSearchParams di view memerlukan Suspense. */}
      <Suspense fallback={null}>
        <InfoPelangganView />
      </Suspense>
    </div>
  )
}
