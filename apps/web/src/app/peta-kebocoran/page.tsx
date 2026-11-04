import type { Metadata } from "next"
import { PetaKebocoranView } from "@/features/dashboard/peta-kebocoran/PetaKebocoranView"

export const metadata: Metadata = {
  title: "GIS & Monitoring Kebocoran Pipa",
}

export default function PetaKebocoranPage() {
  return <PetaKebocoranView />
}
