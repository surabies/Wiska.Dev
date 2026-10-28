// features/dashboard/components/pengaduan/papan-pengaduan/use-statistik-pengaduan.ts
// — ambil angka ringkasan antrean untuk kartu di atas grid.
import * as React from "react";
import { ambilSatu } from "@/features/dashboard/lib/api-client";
import type { StatistikPengaduan } from "@/features/dashboard/components/pengaduan/tipe";

export function useStatistikPengaduan() {
  const [stat, setStat] = React.useState<StatistikPengaduan | null>(null);

  const muat = React.useCallback(() => {
    ambilSatu<StatistikPengaduan>("/pengaduan/statistik")
      .then(setStat)
      // Kartu ringkasan adalah pelengkap: kalau gagal, grid di bawahnya tetap
      // berguna. Menggagalkan seluruh halaman karena angka hiasan tidak masuk
      // akal.
      .catch(() => setStat(null));
  }, []);

  React.useEffect(() => {
    muat();
  }, [muat]);

  return { stat, muat };
}
