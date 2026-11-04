import type { Metadata } from "next"
import { PetaWilayahView } from "@/features/dashboard/peta-wilayah/PetaWilayahView"

export const metadata: Metadata = { title: "Peta Jaringan" }

export default function WilayahPage() {
  return <PetaWilayahView />
}
