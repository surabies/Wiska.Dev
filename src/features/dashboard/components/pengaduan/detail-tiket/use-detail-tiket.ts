// features/dashboard/components/pengaduan/detail-tiket/use-detail-tiket.ts —
// SEMUA urusan data halaman detail: ambil tiket, ambil daftar petugas, dan
// pembungkus aksi (`jalankan`) yang mengatur status mengirim, galat, dan
// muat ulang. Komponen panel tinggal memanggil `jalankan`, tidak perlu tahu
// cara memuat ulang.
import * as React from "react";
import { ambilSatu, ApiError } from "@/features/dashboard/lib/api-client";
import type { PengaduanDetail, PetugasRingkas } from "@/features/dashboard/components/pengaduan/tipe";

/// Menjalankan satu aksi ke server lalu memuat ulang tiket. Mengembalikan
/// true bila berhasil — pemanggil memakainya untuk mengosongkan form-nya
/// sendiri HANYA saat aksi sukses.
export type JalankanAksi = (aksi: () => Promise<unknown>) => Promise<boolean>;

function pesanGalat(err: unknown, cadangan: string) {
  return err instanceof ApiError ? err.message : cadangan;
}

export function useDetailTiket(pengaduanId: string) {
  const [detail, setDetail] = React.useState<PengaduanDetail | null>(null);
  const [petugas, setPetugas] = React.useState<PetugasRingkas[]>([]);
  const [memuat, setMemuat] = React.useState(true);
  const [galat, setGalat] = React.useState<string | null>(null);
  const [mengirim, setMengirim] = React.useState(false);

  const muat = React.useCallback(async () => {
    try {
      setDetail(await ambilSatu<PengaduanDetail>(`/pengaduan/${pengaduanId}`));
      setGalat(null);
    } catch (err) {
      setGalat(pesanGalat(err, "Gagal memuat detail tiket."));
    }
  }, [pengaduanId]);

  React.useEffect(() => {
    let batal = false;
    void muat().finally(() => {
      if (!batal) setMemuat(false);
    });
    return () => {
      batal = true;
    };
  }, [muat]);

  // Sumbernya /pengaduan/petugas, BUKAN /users — /users dibatasi
  // MANAGEMENT_UP sementara menugaskan tiket cuma butuh SUPERVISOR_UP.
  React.useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const rows = await ambilSatu<PetugasRingkas[]>("/pengaduan/petugas");
        if (!batal) setPetugas(rows);
      } catch {
        // Dropdown kosong sudah cukup menjelaskan dirinya; aksi lain tetap
        // berguna.
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  const jalankan: JalankanAksi = React.useCallback(
    async (aksi) => {
      setMengirim(true);
      setGalat(null);
      try {
        await aksi();
        await muat();
        return true;
      } catch (err) {
        setGalat(pesanGalat(err, "Aksi gagal. Coba lagi."));
        return false;
      } finally {
        setMengirim(false);
      }
    },
    [muat],
  );

  return { detail, petugas, memuat, galat, mengirim, jalankan };
}
