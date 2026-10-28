// features/dashboard/components/pengaduan/papan-pengaduan/sel-sla.tsx — sel
// kolom "Tenggat". Yang paling dicari supervisor tiap pagi adalah "mana yang
// hampir/sudah lewat tenggat" — angka mentah targetSelesaiAt tidak menjawab
// itu tanpa dihitung di kepala. Penanda: titik berwarna + teks netral
// (kontras teks tetap aman di tema terang maupun gelap), kecuali yang sudah
// lewat: teks --destructive.
import type { ICellRendererParams } from "ag-grid-community";
import { formatSisaWaktu } from "@/features/public/lib/format";
import { cn } from "@/lib/utils";
import type { SlaTiket } from "@/features/dashboard/components/pengaduan/tipe";

/// Ambang "perlu diperhatikan hari ini": kurang dari 4 jam tersisa.
const AMBANG_MENIT_MENDEKAT = 240;

function Penanda({ titik, teks, tebal }: { titik: string; teks: string; tebal?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-1.5 rounded-full", titik)} />
      <span className={cn(tebal && "font-medium text-destructive")}>{teks}</span>
    </span>
  );
}

export function SelSla(p: ICellRendererParams) {
  const sla = p.data?.sla as SlaTiket | undefined;
  if (!sla?.targetSelesaiAt) return <span className="text-muted-foreground">—</span>;
  if (sla.terjeda) return <Penanda titik="bg-chart-4" teks="dijeda" />;

  const teks = formatSisaWaktu(sla.sisaMenit);
  if (sla.melanggar) return <Penanda titik="bg-destructive" teks={teks} tebal />;
  if (sla.sisaMenit !== null && sla.sisaMenit < AMBANG_MENIT_MENDEKAT)
    return <Penanda titik="bg-warning" teks={teks} />;
  return <span className="text-muted-foreground">{teks}</span>;
}
