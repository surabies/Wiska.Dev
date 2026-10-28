// features/dashboard/components/pengaduan/bersama/baris-info.tsx — satu
// pasang "ikon + label + isi" untuk blok fakta tiket (pelapor, lokasi, dst).
import type * as React from "react";

export function BarisInfo({
  ikon: Ikon,
  label,
  children,
}: {
  ikon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Ikon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="text-sm wrap-break-word">{children}</div>
      </div>
    </div>
  );
}
