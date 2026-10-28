import type { Metadata } from "next"
import { PageContainer } from "@/components/layout"
import { PembacaanGrid } from "@/features/dashboard/components/grids/pembacaan-grid"

export const metadata: Metadata = { title: "Data Pembacaan Meter · Tirtawening" }

export default function InfoPembacaanPage() {
  return (
    <PageContainer
      penuh
      className="flex min-h-0 flex-1 flex-col"
      breadcrumbs={[
        { label: "Pengolahan Data", href: "/pengolahan-data/dpm" },
        { label: "Data Pembacaan Meter" },
      ]}
    >
      {/* Breadcrumb sudah punya garis bawah sendiri, sedangkan DataGrid
          merender card ber-border penuh. Dua garis itulah yang tampak ganda.
          Kelas [&>section] menghapus border, sudut, dan bayangan card DataGrid
          supaya grid menyatu dengan area konten (garis pemisah hanya satu:
          milik breadcrumb, lalu border bawah toolbar). */}
      <div className="flex min-h-0 flex-1 flex-col [&>section]:flex-1 [&>section]:rounded-none [&>section]:border-0 [&>section]:shadow-none">
        
        <PembacaanGrid />
      </div>
    </PageContainer>
  )
}