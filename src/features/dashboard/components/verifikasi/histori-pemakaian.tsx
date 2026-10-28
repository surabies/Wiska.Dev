"use client";

// features/dashboard/components/verifikasi/histori-pemakaian.tsx — bar
// mini histori pemakaian (m³) beberapa periode terakhir dari PembacaanMeter
// resmi. Div berproporsi, bukan Recharts: dengan ≤3 titik, chart library
// merender kotak kosong yang terlihat rusak (lihat FRONTEND.md), sementara
// bar sederhana tetap terbaca bahkan dengan satu titik.
import * as React from "react";
import { formatBulanSingkat } from "@/features/public/lib/format";
import { ambilList, ApiError } from "../../lib/api-client";
import type { PembacaanRingkas } from "./types/tipe";

/// Komponen ini dirender di dalam panel yang di-remount lewat `key` tiap
/// ganti baris terpilih — state selalu mulai bersih, tidak perlu reset
/// sinkron di effect (react-hooks/set-state-in-effect melarangnya).
export function HistoriPemakaian({
  pelangganId,
}: {
  pelangganId: string | null | undefined;
}) {
  const [rows, setRows] = React.useState<PembacaanRingkas[] | null>(null);
  const [galat, setGalat] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pelangganId) return;
    let batal = false;
    ambilList<PembacaanRingkas>("/pembacaan", { pelangganId, pageSize: 3 })
      .then(({ rows }) => {
        if (!batal) setRows(rows);
      })
      .catch((err) => {
        if (!batal)
          setGalat(
            err instanceof ApiError ? err.message : "Gagal memuat histori.",
          );
      });
    return () => {
      batal = true;
    };
  }, [pelangganId]);

  if (!pelangganId) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Belum ada pembacaan resmi untuk pelanggan ini.
      </p>
    );
  }
  if (galat) return <p className="text-[11px] text-destructive">{galat}</p>;
  if (rows === null)
    return <p className="text-[11px] text-muted-foreground">Memuat histori…</p>;
  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Belum ada pembacaan resmi untuk pelanggan ini.
      </p>
    );
  }

  // API mengurut periode desc; tampilkan kronologis (lama -> baru).
  const urut = [...rows].reverse();
  const maks = Math.max(...urut.map((r) => r.pemakaianM3), 1);

  return (
    <div className="flex flex-col gap-1.5">
      {urut.map((r) => {
        const d = new Date(r.periode);
        const thbl = d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
        return (
          <div key={r.id} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[10px] font-medium text-muted-foreground uppercase">
              {formatBulanSingkat(thbl)}
            </span>
            <div className="h-3 flex-1 bg-muted/50">
              <div
                className="h-full bg-primary/70"
                style={{
                  width: `${Math.max(4, (r.pemakaianM3 / maks) * 100)}%`,
                }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
              {r.pemakaianM3.toLocaleString("id-ID")}
            </span>
          </div>
        );
      })}
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Pemakaian m³ per periode (pembacaan resmi terakhir)
      </p>
    </div>
  );
}
