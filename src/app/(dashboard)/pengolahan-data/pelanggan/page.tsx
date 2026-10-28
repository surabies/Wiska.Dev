import type { Metadata } from "next"
import { PageContainer } from "@/components/layout"
import { PelangganGrid } from "@/features/dashboard/components/grids/pelanggan-grid"

export const metadata: Metadata = { title: "Data Pelanggan · Tirtawening" }

export default function Page() {
  return (
    <PageContainer
      penuh
      className="flex min-h-0 flex-1 flex-col"
      breadcrumbs={[
        { label: "Pelanggan", href: "/pengolahan-data/pelanggan" },
        { label: "Data Pelanggan" },
      ]}
    >
      {/* Breadcrumb sudah punya garis bawah sendiri, sedangkan DataGrid
          merender card ber-border penuh. Dua garis itulah yang tampak ganda.
          Kelas [&>section] menghapus border, sudut, dan bayangan card DataGrid
          supaya grid menyatu dengan area konten (garis pemisah hanya satu:
          milik breadcrumb, lalu border bawah toolbar). */}
      <div className="flex min-h-0 flex-1 flex-col [&>section]:flex-1 [&>section]:rounded-none [&>section]:border-0 [&>section]:shadow-none">
        <PelangganGrid />
    
      </div>
    </PageContainer>
  )
}