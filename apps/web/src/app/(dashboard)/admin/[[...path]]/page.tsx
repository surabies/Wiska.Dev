import { MenuPage } from "@/components/layout/index"

export default async function AdminMenuPage({
  params,
}: {
  params: Promise<{ path?: string[] }>
}) {
  const { path } = await params
  const href = path?.length ? `/admin/${path.join("/")}` : "/admin"

  return <MenuPage href={href} />
}
