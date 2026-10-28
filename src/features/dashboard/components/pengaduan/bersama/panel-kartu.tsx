// features/dashboard/components/pengaduan/bersama/panel-kartu.tsx — wadah
// panel gaya Geist: permukaan --card, garis --border, bayangan --shadow-panel,
// header dipisah garis --border-subtle. Dipakai SEMUA blok di halaman detail
// supaya radius, padding, dan bayangannya seragam dan diubah di satu tempat.
import type * as React from "react";
import { cn } from "@/lib/utils";

export function PanelKartu({
  judul,
  ikon: Ikon,
  nada = "biasa",
  className,
  children,
}: {
  judul: string;
  ikon?: React.ElementType;
  /** "sukses" = ikon header berwarna --success (mis. blok penyelesaian). */
  nada?: "biasa" | "sukses";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-panel",
        nada === "sukses" ? "border-success/30" : "border-border",
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        {Ikon && (
          <Ikon className={cn("size-4", nada === "sukses" ? "text-success" : "text-muted-foreground")} />
        )}
        <h3 className="text-sm font-medium">{judul}</h3>
      </header>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  );
}
