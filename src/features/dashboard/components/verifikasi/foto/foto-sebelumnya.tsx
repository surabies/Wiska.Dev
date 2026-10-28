"use client";

// features/dashboard/components/verifikasi/foto-sebelumnya.tsx — foto
// pembanding: foto bukti pembacaan RESMI terakhir SEBELUM periode laporan
// yang sedang diperiksa, ditampilkan di panel detail tepat di atas foto
// periode berjalan supaya verifikator membandingkan angka dua bulan
// bersebelahan tanpa membuka halaman lain.
import * as React from "react";
import { formatPeriode } from "@/features/public/lib/format";
import { ambilList, ApiError } from "@/features/dashboard/lib/api-client";
import type { PembacaanRingkas } from "../types/tipe";
import { FotoBukti, FotoKosong } from "./foto-bukti";

function thblDariIso(iso: string): number {
  const d = new Date(iso);
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
}

/// Dirender di dalam panel yang di-remount lewat `key` tiap ganti baris —
/// state selalu mulai bersih.
export function FotoSebelumnya({
  pelangganId,
  periode,
}: {
  pelangganId: string | null | undefined;
  /** Periode laporan yang sedang diperiksa (thbl, mis. 202606). */
  periode: number;
}) {
  const [row, setRow] = React.useState<PembacaanRingkas | null | undefined>(
    undefined,
  );
  const [galat, setGalat] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pelangganId) return;
    let batal = false;
    // 6 pembacaan terakhir (periode desc) cukup untuk menemukan pembanding
    // terdekat sebelum periode laporan, termasuk bila ada bulan bolong.
    ambilList<PembacaanRingkas>("/pembacaan", { pelangganId, pageSize: 6 })
      .then(({ rows }) => {
        if (batal) return;
        setRow(rows.find((r) => thblDariIso(r.periode) < periode) ?? null);
      })
      .catch((err) => {
        if (!batal)
          setGalat(
            err instanceof ApiError
              ? err.message
              : "Gagal memuat foto pembanding.",
          );
      });
    return () => {
      batal = true;
    };
  }, [pelangganId, periode]);

  if (!pelangganId) {
    return (
      <FotoKosong
        label="Foto periode sebelumnya"
        keterangan="Pelanggan belum terhubung — tidak ada pembanding."
      />
    );
  }
  if (galat) return <p className="text-[11px] text-destructive">{galat}</p>;
  if (row === undefined)
    return (
      <p className="text-[11px] text-muted-foreground">Memuat foto pembanding…</p>
    );
  if (row === null) {
    return (
      <FotoKosong
        label="Foto periode sebelumnya"
        keterangan="Belum ada pembacaan resmi sebelum periode ini."
      />
    );
  }

  const thbl = thblDariIso(row.periode);
  return (
    <FotoBukti
      url={row.fotoBukti}
      label={`Foto meter — ${formatPeriode(thbl)} (pembanding)`}
      keterangan={`Pembacaan resmi ${formatPeriode(thbl)} (stand ${row.standAkhir.toLocaleString("id-ID")}) tidak menyertakan foto.`}
    />
  );
}
