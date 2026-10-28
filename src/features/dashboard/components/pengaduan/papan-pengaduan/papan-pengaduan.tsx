"use client";

// features/dashboard/components/pengaduan/papan-pengaduan/papan-pengaduan.tsx
// — halaman kerja pengaduan: kartu ringkasan antrean + grid; klik baris
// membuka HALAMAN detail (dulu sheet samping — detail tiket terlalu kompleks
// untuk lebar sheet, lihat ../detail-tiket).
//
// Pembagian berkas:
//   use-statistik-pengaduan.ts  data kartu ringkasan
//   kartu-statistik.tsx         tampilan kartu
//   kolom.tsx                   definisi kolom grid (+ sel-sla.tsx)
//   filter.ts                   dropdown filter
import { useRouter } from "next/navigation";
import { DataGrid } from "@/features/dashboard/components/data-grid";
import { KartuStatistik } from "./kartu-statistik";
import { FILTER_PENGADUAN } from "./filter";
import { KOLOM_PENGADUAN } from "./kolom";
import { useStatistikPengaduan } from "./use-statistik-pengaduan";

export function PapanPengaduan({ initialQ }: { initialQ?: string }) {
  const router = useRouter();
  const { stat } = useStatistikPengaduan();

  return (
    // Rantai tinggi penuh: kartu statistik shrink-0, tabel mengisi sisa
    // (flex-1 min-h-0) dengan gulir-internal AG Grid — konsisten dengan
    // halaman tabel lain.
    <div className="flex h-full min-h-0 flex-col gap-4">
      {stat && <KartuStatistik stat={stat} />}

      <div className="min-h-0 min-w-0 flex-1">
        <DataGrid
          judul="Pengaduan Warga"
          endpoint="/pengaduan"
          columnDefs={KOLOM_PENGADUAN}
          searchParam="q"
          searchPlaceholder="Cari judul / tiket…"
          initialSearch={initialQ}
          // DataGrid mengoper baris sebagai Record<string, unknown> (ia tidak
          // tahu bentuk data tiap endpoint) — `id` dibaca langsung, bukan
          // lewat cast ke PengaduanBaris yang cuma menipu pemeriksa tipe.
          onRowClicked={(row) => {
            if (typeof row.id === "string") router.push(`/dashboard/pengaduan/${row.id}`);
          }}
          filters={FILTER_PENGADUAN}
        />
      </div>
    </div>
  );
}
