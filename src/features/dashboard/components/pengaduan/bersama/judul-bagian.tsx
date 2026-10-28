// features/dashboard/components/pengaduan/bersama/judul-bagian.tsx — judul
// kecil di dalam panel (mis. "Foto dari pelapor"). Gaya Geist: sentence case,
// bukan huruf kapital semua.
import type * as React from "react";

export function JudulBagian({
  ikon: Ikon,
  children,
}: {
  ikon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {Ikon && <Ikon className="size-3.5" />}
      {children}
    </p>
  );
}
