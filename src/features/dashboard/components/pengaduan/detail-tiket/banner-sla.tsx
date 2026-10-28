// features/dashboard/components/pengaduan/detail-tiket/banner-sla.tsx —
// peringatan saat tiket lewat tenggat. Angka terlambat/sisa waktu datang dari
// server (`sla`), tidak dihitung ulang di sini.
import { TriangleAlert } from "@/components/ui/hugeicons-compat";
import { formatSisaWaktu } from "@/features/public/lib/format";
import type { SlaTiket } from "@/features/dashboard/components/pengaduan/tipe";

export function BannerSla({ sla }: { sla: SlaTiket }) {
  if (!sla.melanggar) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>Tiket ini melewati target penyelesaian — {formatSisaWaktu(sla.sisaMenit)}.</span>
    </div>
  );
}
