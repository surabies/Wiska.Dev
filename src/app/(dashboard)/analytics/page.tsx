import type { Metadata } from "next"
import { PageContainer } from "@/components/layout/index"

export const metadata: Metadata = { title: "Analytics" }

export default function AnalyticsPage() {
  return (
    <PageContainer breadcrumbs={[{ label: "Analytics" }]}>
      <div className="border border-dashed border-sky-300/60 bg-sky-400/10 p-4 text-sm/6 text-sky-900 sm:p-5 dark:border-sky-300/30 dark:text-sky-200">
        <p className="font-medium">Halaman dalam tahap pengembangan</p>
        <p className="mt-1">
          Analisis dan grafik data akan tersedia setelah modul ini dibangun.
        </p>
      </div>
    </PageContainer>
  )
}
