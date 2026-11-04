"use client"

import type { ComponentProps } from "react"
import dynamic from "next/dynamic"

// dynamic import dengan ssr: false aman ditaruh di Client Component ini
const PetaWilayah = dynamic(
  () => import("./PetaWilayah").then((mod) => mod.PetaWilayah),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full flex-1 items-center justify-center rounded-xl border border-border bg-card">
        <p className="animate-pulse text-sm text-muted-foreground">
          Memuat peta wilayah operasional...
        </p>
      </div>
    ),
  }
)

export function PetaClientWrapper(props: ComponentProps<typeof PetaWilayah>) {
  return <PetaWilayah {...props} />
}
