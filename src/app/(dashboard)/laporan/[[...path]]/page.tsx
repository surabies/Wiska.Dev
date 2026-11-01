import { MenuPage } from "@/components/layout/index"

export default async function LaporanMenuPage({
  params,
}: {
  params: Promise<{ path?: string[] }>
}) {
  const { path } = await params
  const href = path?.length ? `/laporan/${path.join("/")}` : "/laporan"

  return <MenuPage href={href} />
}
