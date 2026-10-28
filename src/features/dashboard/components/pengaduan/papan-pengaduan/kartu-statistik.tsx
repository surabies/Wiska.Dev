// features/dashboard/components/pengaduan/papan-pengaduan/kartu-statistik.tsx
// — empat kartu ringkasan antrean. Gaya Geist: permukaan --card, garis
// --border, bayangan --shadow-panel; warna hanya pada ikon (token semantik).
import type * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  InboxIcon,
  StarIcon,
  TimerOffIcon,
  TriangleAlertIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { StatistikPengaduan } from "@/features/dashboard/components/pengaduan/tipe";

function KartuAngka({
  ikon,
  label,
  nilai,
  nada,
}: {
  ikon: IconSvgElement;
  label: string;
  nilai: React.ReactNode;
  /** Kelas warna teks ikon, mis. "text-info". */
  nada: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-panel">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <HugeiconsIcon icon={ikon} className={cn("size-[18px]", nada)} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tracking-tight tabular-nums">{nilai}</p>
      </div>
    </div>
  );
}

export function KartuStatistik({ stat }: { stat: StatistikPengaduan }) {
  const daruratTinggi =
    (stat.perPrioritasTerbuka.DARURAT ?? 0) + (stat.perPrioritasTerbuka.TINGGI ?? 0);

  return (
    <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KartuAngka ikon={InboxIcon} label="Belum ditugaskan" nilai={stat.belumDitugaskan} nada="text-info" />
      <KartuAngka ikon={TimerOffIcon} label="Lewat tenggat" nilai={stat.melanggarSla} nada="text-destructive" />
      <KartuAngka
        ikon={TriangleAlertIcon}
        label="Darurat & tinggi (terbuka)"
        nilai={daruratTinggi}
        nada="text-warning"
      />
      <KartuAngka
        ikon={StarIcon}
        label="Rata-rata kepuasan"
        nada="text-success"
        nilai={
          stat.rataRating !== null ? (
            <>
              {stat.rataRating.toFixed(1)}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                /5 · {stat.jumlahDinilai} penilaian
              </span>
            </>
          ) : (
            <span className="text-sm font-normal text-muted-foreground">Belum ada</span>
          )
        }
      />
    </div>
  );
}
