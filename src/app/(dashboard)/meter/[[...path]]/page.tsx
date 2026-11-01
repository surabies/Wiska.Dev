import { redirect } from "next/navigation"
import { MenuPage } from "@/components/layout/index"

export default async function MeterMenuPage({
  params,
}: {
  params: Promise<{ path?: string[] }>
}) {
  const { path } = await params
  if (!path?.length) redirect("/verifikasi/baca-petugas")

  return <MenuPage href={`/meter/${path.join("/")}`} />
}
