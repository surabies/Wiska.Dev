import "server-only";

import { prisma } from "@db";

const FILTER_KEBOCORAN = `
  jenis = 'BOCOR_PIPA_DINAS'
  AND status NOT IN ('SELESAI', 'DITOLAK', 'DITUTUP')
`;

export interface RingkasanLaporanPeta {
  aktif: number;
  laporan30Hari: number;
  rataRataResponsJam: number | null;
  rataRataPenyelesaianJam: number | null;
  trenBulanan: Array<{ bulan: string; jumlah: number }>;
  hotspot: Array<{ kelurahan: string; jumlah: number }>;
}

export interface RingkasanAsetPeta {
  totalRute: number;
  ruteDenganGeometri: number;
  pelangganBerkoordinat: number;
  kelurahanDenganGeometri: number;
}

export async function ringkasanLaporanPeta(): Promise<RingkasanLaporanPeta> {
  const [kpi, trenBulanan, hotspot] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{
        aktif: bigint;
        laporan30Hari: bigint;
        rataRataResponsJam: number | null;
        rataRataPenyelesaianJam: number | null;
      }>
    >(
      `SELECT
         count(*) FILTER (WHERE status NOT IN ('SELESAI', 'DITOLAK', 'DITUTUP')) AS aktif,
         count(*) FILTER (WHERE "createdAt" >= now() - interval '30 days') AS "laporan30Hari",
         avg(extract(epoch FROM ("responsAt" - "createdAt")) / 3600)
           FILTER (WHERE "responsAt" IS NOT NULL) AS "rataRataResponsJam",
         avg(extract(epoch FROM ("selesaiAt" - "createdAt")) / 3600)
           FILTER (WHERE "selesaiAt" IS NOT NULL) AS "rataRataPenyelesaianJam"
       FROM pengaduan
       WHERE jenis = 'BOCOR_PIPA_DINAS'`,
    ),
    prisma.$queryRawUnsafe<Array<{ bulan: string; jumlah: bigint }>>(
      `WITH bulan AS (
         SELECT generate_series(
           date_trunc('month', now()) - interval '5 months',
           date_trunc('month', now()),
           interval '1 month'
         ) AS mulai
       )
       SELECT to_char(bulan.mulai, 'YYYY-MM') AS bulan, count(p.id) AS jumlah
       FROM bulan
       LEFT JOIN pengaduan p
         ON p.jenis = 'BOCOR_PIPA_DINAS'
         AND p."createdAt" >= bulan.mulai
         AND p."createdAt" < bulan.mulai + interval '1 month'
       GROUP BY bulan.mulai
       ORDER BY bulan.mulai`,
    ),
    prisma.$queryRawUnsafe<Array<{ kelurahan: string; jumlah: bigint }>>(
      `SELECT coalesce(k.nama, 'Belum terpetakan') AS kelurahan, count(*) AS jumlah
       FROM pengaduan p
       LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
       WHERE p.jenis = 'BOCOR_PIPA_DINAS'
         AND p."createdAt" >= now() - interval '12 months'
       GROUP BY k.nama
       ORDER BY jumlah DESC, kelurahan
       LIMIT 8`,
    ),
  ]);

  const ringkas = kpi[0];
  return {
    aktif: Number(ringkas?.aktif ?? 0),
    laporan30Hari: Number(ringkas?.laporan30Hari ?? 0),
    rataRataResponsJam:
      ringkas?.rataRataResponsJam === null ||
      ringkas?.rataRataResponsJam === undefined
        ? null
        : Number(ringkas.rataRataResponsJam),
    rataRataPenyelesaianJam:
      ringkas?.rataRataPenyelesaianJam === null ||
      ringkas?.rataRataPenyelesaianJam === undefined
        ? null
        : Number(ringkas.rataRataPenyelesaianJam),
    trenBulanan: trenBulanan.map((row) => ({
      bulan: row.bulan,
      jumlah: Number(row.jumlah),
    })),
    hotspot: hotspot.map((row) => ({
      kelurahan: row.kelurahan,
      jumlah: Number(row.jumlah),
    })),
  };
}

export async function ringkasanAsetPeta(): Promise<RingkasanAsetPeta> {
  const [rute, pelanggan, kelurahan] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ total: bigint; denganGeometri: bigint }>>(
      `SELECT count(*) AS total, count(*) FILTER (WHERE area IS NOT NULL) AS "denganGeometri"
       FROM rute`,
    ),
    prisma.$queryRawUnsafe<Array<{ jumlah: bigint }>>(
      `SELECT count(*) AS jumlah
       FROM pelanggan
       WHERE koordinat IS NOT NULL AND "deletedAt" IS NULL`,
    ),
    prisma.$queryRawUnsafe<Array<{ jumlah: bigint }>>(
      `SELECT count(*) AS jumlah FROM kelurahan WHERE area IS NOT NULL`,
    ),
  ]);

  return {
    totalRute: Number(rute[0]?.total ?? 0),
    ruteDenganGeometri: Number(rute[0]?.denganGeometri ?? 0),
    pelangganBerkoordinat: Number(pelanggan[0]?.jumlah ?? 0),
    kelurahanDenganGeometri: Number(kelurahan[0]?.jumlah ?? 0),
  };
}

export async function daftarKebocoranAktifPeta() {
  return prisma.$queryRawUnsafe<
    Array<{
      id: string;
      tiket: string;
      judul: string;
      status: string;
      prioritas: string;
      alamat: string | null;
      kelurahan: string | null;
      dibuat: Date;
      longitude: number;
      latitude: number;
    }>
  >(
    `SELECT p.id, p."nomorTiket" AS tiket, p.judul, p.status::text AS status,
            p.prioritas::text AS prioritas, p."alamatKejadian" AS alamat,
            k.nama AS kelurahan, p."createdAt" AS dibuat,
            ST_X(p.koordinat) AS longitude, ST_Y(p.koordinat) AS latitude
     FROM pengaduan p
     LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
     WHERE ${FILTER_KEBOCORAN}
       AND p.koordinat IS NOT NULL
     ORDER BY CASE p.prioritas
                WHEN 'DARURAT' THEN 4
                WHEN 'TINGGI' THEN 3
                WHEN 'NORMAL' THEN 2
                WHEN 'RENDAH' THEN 1
                ELSE 0
              END DESC,
              p."createdAt" DESC
     LIMIT 100`,
  );
}
