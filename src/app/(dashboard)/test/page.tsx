import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/index"
import { ModuleTestView } from "@/features/dashboard/impor-lapdatameter/ModuleTestView"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Module Test" }

export default async function ModuleTestIndexPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return <ModuleTestView role={session.user.role} />
}
