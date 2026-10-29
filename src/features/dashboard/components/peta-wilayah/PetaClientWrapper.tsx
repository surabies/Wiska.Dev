"use client";

import dynamic from "next/dynamic";

// dynamic import dengan ssr: false aman ditaruh di Client Component ini
const PetaWilayah = dynamic(
  () => import("./peta-wilayah").then((mod) => mod.PetaWilayah),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full flex-1 items-center justify-center rounded-xl border border-border bg-card">
        <p className="text-sm text-muted-foreground animate-pulse">Memuat peta wilayah operasional...</p>
      </div>
    ),
  }
);

export function PetaClientWrapper(props: any) {
  return <PetaWilayah {...props} />;
}