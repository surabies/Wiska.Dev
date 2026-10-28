import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { PageContainer } from "@/components/layout"
import { PenggunaClient } from "@/features/dashboard/components/pengguna/pengguna-client"


export const metadata: Metadata = { title: "Pengguna & akses" }

export default async function PenggunaPage() {
  // id akun sendiri diteruskan ke form supaya role & status DIRINYA dikunci
  // di layar — aturan yang sama sudah ditegakkan server (lihat user.router.ts),
  // ini hanya menjelaskannya lebih awal.
  const session = await auth()
  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col"
      breadcrumbs={[
        { label: "Master", href: "/master/pengguna" },
        { label: "Pengguna" },
      ]}
    >
      <PenggunaClient idSaya={session?.user?.id ?? null} roleSaya={session?.user?.role ?? null} />
    </PageContainer>
  )
}
