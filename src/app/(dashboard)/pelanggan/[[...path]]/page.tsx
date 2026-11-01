import { redirect } from "next/navigation"
import { MenuPage } from "@/components/layout/index"

export default async function PelangganMenuPage({
  params,
}: {
  params: Promise<{ path?: string[] }>
}) {
  const { path } = await params
  if (!path?.length) redirect("/pengolahan-data/pelanggan")

  return <MenuPage href={`/pelanggan/${path.join("/")}`} />
}
