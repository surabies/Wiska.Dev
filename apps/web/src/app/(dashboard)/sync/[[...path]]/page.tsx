import { MenuPage } from "@/components/layout/index"

export default async function SyncMenuPage({
  params,
}: {
  params: Promise<{ path?: string[] }>
}) {
  const { path } = await params
  const href = path?.length ? `/sync/${path.join("/")}` : "/sync"

  return <MenuPage href={href} />
}
