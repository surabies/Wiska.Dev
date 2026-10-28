import "server-only";

// features/dashboard/lib/geo-queries.ts — pengambilan data spasial untuk
// halaman peta wilayah. Server component membaca DB langsung (pola
// queries.ts), hasilnya GeoJSON FeatureCollection siap dimakan MapLibre.
//
// Kolom geometry bertipe Unsupported di Prisma — HARUS lewat raw SQL
// (ST_AsGeoJSON). Mengikuti aturan server/lib/spatial.ts: $queryRawUnsafe
// dengan identifier tetap (bukan input), tanpa Prisma.raw().
import { prisma } from "@db";

export interface FC {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: unknown;
    properties: Record<string, unknown>;
  }>;
}

interface StatistikWilayah {
  pelangganAktif: number;
  pelangganNonaktif: number;
  tutupSementara: number;
  disegel: number;
  tutupSpt: number;
  pelangganDihapus: number;
  potensi: number;
  eksPelanggan: number;
  riwayatPemutusan: number;
  pengaduan: number;
  pengaduanAktif: number;
  kebocoran: number;
}

function keFC<T extends { geom: unknown }>(rows: T[]): FC {
  return {
    type: "FeatureCollection",
    features: rows.map((row) => {
      const { geom } = row;
      const properties = Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== "geom"),
      );
      return { type: "Feature", geometry: geom, properties };
    }),
  };
}

/// Berapa warna yang dipakai membedakan kelurahan bertetangga. Tiga, bukan
/// delapan: di peta SETIAP pasang warna bisa berakhir bersebelahan, dan pada
/// syarat "semua pasangan" hanya tiga warna pertama palet yang lolos ambang
/// keterbacaan buta warna. Slot ke-4 dipakai HANYA bila tiga tidak cukup —
/// dia abu-abu netral, bukan warna keempat yang menuntut dibedakan.
const JUMLAH_WARNA = 3;

/// Pewarnaan peta: kelurahan yang BERSINGGUNGAN tidak boleh sewarna.
///
/// Kenapa tidak sekadar `urutan % 3`: urutan abjad tidak tahu apa-apa soal
/// geografi, jadi dua kelurahan bersebelahan bisa saja kebagian warna yang
/// sama — dan justru pasangan itulah yang perlu dibedakan. Di sini
/// ketetanggaannya ditanyakan ke PostGIS (ST_Touches), lalu diwarnai serakah:
/// tiap kelurahan mengambil warna terkecil yang belum dipakai tetangganya.
///
/// WARNANYA TIDAK BERARTI APA-APA. Ia tidak mengkodekan data — hanya
/// memisahkan bidang dari bidang sebelahnya, seperti peta wilayah cetak.
/// Identitas kelurahan dibawa NAMANYA, yang dilabelkan di peta; warna tidak
/// pernah jadi satu-satunya penanda.
async function warnaPerKelurahan(id: string[]): Promise<Map<string, number>> {
  if (id.length === 0) return new Map();

  const sisi = await prisma.$queryRawUnsafe<Array<{ a: string; b: string }>>(
    `SELECT a.id AS a, b.id AS b
       FROM kelurahan a
       JOIN kelurahan b ON a.id < b.id AND ST_Touches(a.area, b.area)
      WHERE a.area IS NOT NULL AND b.area IS NOT NULL`,
  );

  const tetangga = new Map<string, Set<string>>(
    id.map((x) => [x, new Set<string>()]),
  );
  for (const { a, b } of sisi) {
    tetangga.get(a)?.add(b);
    tetangga.get(b)?.add(a);
  }

  // Yang paling banyak bertetangga diwarnai lebih dulu (heuristik Welsh–
  // Powell): mewarnai simpul tersulit belakangan justru yang memaksa
  // pemakaian warna cadangan.
  const urut = [...id].sort(
    (x, y) => (tetangga.get(y)?.size ?? 0) - (tetangga.get(x)?.size ?? 0),
  );
  const warna = new Map<string, number>();
  for (const k of urut) {
    const terpakai = new Set<number>();
    for (const t of tetangga.get(k) ?? []) {
      const w = warna.get(t);
      if (w !== undefined) terpakai.add(w);
    }
    let pilih = 0;
    while (pilih < JUMLAH_WARNA && terpakai.has(pilih)) pilih++;
    // pilih === JUMLAH_WARNA berarti ketiga warna sudah dipakai tetangga —
    // jatuh ke slot netral. Pada peta wilayah nyata ini jarang terjadi.
    warna.set(k, pilih);
  }
  return warna;
}

/** Poligon batas kelurahan yang punya geometri, lengkap dengan indeks warna
 *  supaya dua kelurahan bersebelahan tidak pernah tampil sewarna. */
export async function batasKelurahanFC(): Promise<FC> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      geom: unknown;
      id: string;
      kode: string;
      nama: string;
      kecamatan: string;
      pelangganAktif: number;
      pelangganNonaktif: number;
      tutupSementara: number;
      disegel: number;
      tutupSpt: number;
      pelangganDihapus: number;
      potensi: number;
      eksPelanggan: number;
      riwayatPemutusan: number;
      pengaduan: number;
      pengaduanAktif: number;
      kebocoran: number;
    }>
  >(
    `SELECT wilayah.id, wilayah.kode, wilayah.nama, kecamatan.nama AS kecamatan,
            ST_AsGeoJSON(wilayah.area)::json AS geom,
            pelanggan."pelangganAktif", pelanggan."pelangganNonaktif",
            pelanggan."tutupSementara", pelanggan.disegel,
            pelanggan."tutupSpt", pelanggan."pelangganDihapus",
            potensi.jumlah AS potensi,
            pemutusan."eksPelanggan", pemutusan."riwayatPemutusan",
            pengaduan.jumlah AS pengaduan,
            pengaduan.aktif AS "pengaduanAktif",
            pengaduan.kebocoran
     FROM kelurahan wilayah
     JOIN kecamatan ON kecamatan.id = wilayah."kecamatanId"
     LEFT JOIN LATERAL (
       SELECT
         count(*) FILTER (WHERE p.status = 'AKTIF' AND p."deletedAt" IS NULL)::int AS "pelangganAktif",
         count(*) FILTER (WHERE p.status <> 'AKTIF' OR p."deletedAt" IS NOT NULL)::int AS "pelangganNonaktif",
         count(*) FILTER (WHERE p.status = 'TUTUP_SEMENTARA')::int AS "tutupSementara",
         count(*) FILTER (WHERE p.status = 'DISEGEL')::int AS disegel,
         count(*) FILTER (WHERE p.status = 'TUTUP_SPT')::int AS "tutupSpt",
         count(*) FILTER (WHERE p."deletedAt" IS NOT NULL)::int AS "pelangganDihapus"
       FROM pelanggan p
       WHERE p."kelurahanId" = wilayah.id
          OR (p."kelurahanId" IS NULL AND p.koordinat IS NOT NULL
              AND ST_Contains(wilayah.area, p.koordinat))
     ) pelanggan ON TRUE
     LEFT JOIN LATERAL (
       SELECT count(*)::int AS jumlah
       FROM potensi_pelanggan p
       WHERE p."kelurahanId" = wilayah.id
          OR (p."kelurahanId" IS NULL AND p.koordinat IS NOT NULL
              AND ST_Contains(wilayah.area, p.koordinat))
     ) potensi ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         count(*) FILTER (WHERE p."sumberData" = 'SURVEI_GEOJSON')::int AS "eksPelanggan",
         count(*)::int AS "riwayatPemutusan"
       FROM pemutusan p
       WHERE p."kelurahanId" = wilayah.id
          OR (p."kelurahanId" IS NULL AND p."koordinatVerifikasi" IS NOT NULL
              AND ST_Contains(wilayah.area, p."koordinatVerifikasi"))
     ) pemutusan ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         count(*)::int AS jumlah,
         count(*) FILTER (WHERE p.status NOT IN ('SELESAI', 'DITOLAK', 'DITUTUP'))::int AS aktif,
         count(*) FILTER (WHERE p.jenis = 'BOCOR_PIPA_DINAS')::int AS kebocoran
       FROM pengaduan p
       WHERE p."kelurahanId" = wilayah.id
          OR (p."kelurahanId" IS NULL AND p.koordinat IS NOT NULL
              AND ST_Contains(wilayah.area, p.koordinat))
     ) pengaduan ON TRUE
     WHERE wilayah.area IS NOT NULL`,
  );
  const warna = await warnaPerKelurahan(rows.map((r) => r.id));
  return keFC(rows.map((r) => ({ ...r, warna: warna.get(r.id) ?? 0 })));
}

/** Poligon batas kecamatan yang memiliki geometri. */
export async function batasKecamatanFC(): Promise<FC> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ geom: unknown; id: string; kode: string; nama: string } & StatistikWilayah>
  >(
    `SELECT wilayah.id, wilayah.kode, wilayah.nama,
            ST_AsGeoJSON(wilayah.area)::json AS geom,
            pelanggan."pelangganAktif", pelanggan."pelangganNonaktif",
            pelanggan."tutupSementara", pelanggan.disegel,
            pelanggan."tutupSpt", pelanggan."pelangganDihapus",
            potensi.jumlah AS potensi,
            pemutusan."eksPelanggan", pemutusan."riwayatPemutusan",
            pengaduan.jumlah AS pengaduan, pengaduan.aktif AS "pengaduanAktif",
            pengaduan.kebocoran
     FROM kecamatan wilayah
     LEFT JOIN LATERAL (
       SELECT
         count(*) FILTER (WHERE p.status = 'AKTIF' AND p."deletedAt" IS NULL)::int AS "pelangganAktif",
         count(*) FILTER (WHERE p.status <> 'AKTIF' OR p."deletedAt" IS NOT NULL)::int AS "pelangganNonaktif",
         count(*) FILTER (WHERE p.status = 'TUTUP_SEMENTARA')::int AS "tutupSementara",
         count(*) FILTER (WHERE p.status = 'DISEGEL')::int AS disegel,
         count(*) FILTER (WHERE p.status = 'TUTUP_SPT')::int AS "tutupSpt",
         count(*) FILTER (WHERE p."deletedAt" IS NOT NULL)::int AS "pelangganDihapus"
       FROM pelanggan p
       WHERE p."kecamatanId" = wilayah.id
          OR (p."kecamatanId" IS NULL AND p.koordinat IS NOT NULL
              AND ST_Contains(wilayah.area, p.koordinat))
     ) pelanggan ON TRUE
     LEFT JOIN LATERAL (
       SELECT count(*)::int AS jumlah
       FROM potensi_pelanggan p
       WHERE p."kelurahanId" IN (
         SELECT k.id FROM kelurahan k WHERE k."kecamatanId" = wilayah.id
       )
          OR (p."kelurahanId" IS NULL AND p.koordinat IS NOT NULL
              AND ST_Contains(wilayah.area, p.koordinat))
     ) potensi ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         count(*) FILTER (WHERE p."sumberData" = 'SURVEI_GEOJSON')::int AS "eksPelanggan",
         count(*)::int AS "riwayatPemutusan"
       FROM pemutusan p
       WHERE p."kecamatanId" = wilayah.id
          OR (p."kecamatanId" IS NULL AND p."koordinatVerifikasi" IS NOT NULL
              AND ST_Contains(wilayah.area, p."koordinatVerifikasi"))
     ) pemutusan ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         count(*)::int AS jumlah,
         count(*) FILTER (WHERE p.status NOT IN ('SELESAI', 'DITOLAK', 'DITUTUP'))::int AS aktif,
         count(*) FILTER (WHERE p.jenis = 'BOCOR_PIPA_DINAS')::int AS kebocoran
       FROM pengaduan p
       WHERE p."kecamatanId" = wilayah.id
          OR (p."kecamatanId" IS NULL AND p.koordinat IS NOT NULL
              AND ST_Contains(wilayah.area, p.koordinat))
     ) pengaduan ON TRUE
     WHERE wilayah.area IS NOT NULL`,
  );
  return keFC(rows);
}

/** Titik sambungan pelanggan berkoordinat, termasuk status nonaktif dan
 *  baris soft-delete agar data berlokasi tidak hilang dari peta. */
export async function titikPelangganFC(limit = 25000): Promise<FC> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      geom: unknown;
      id: string;
      nama: string;
      nomor: string;
      alamat: string;
      status: string;
      kodeRute: string | null;
      noUrutRute: number | null;
      dihapus: boolean;
    }>
  >(
    `SELECT p.id, p.nama, p.alamat, p."nomorLangganan" AS nomor,
            p.status::text AS status, r.kode AS "kodeRute",
            p."noUrutRute", (p."deletedAt" IS NOT NULL) AS dihapus,
            ST_AsGeoJSON(p.koordinat)::json AS geom
     FROM pelanggan p
     LEFT JOIN rute r ON r.id = p."ruteId"
     WHERE p.koordinat IS NOT NULL
     ORDER BY p."nomorLangganan"
     LIMIT $1`,
    limit,
  );
  return keFC(rows);
}

/** Ringkasan cakupan koordinat pelanggan untuk membantu menemukan data
 *  yang belum dapat ditempatkan di peta. */
export async function ringkasanKoordinatPelanggan() {
  const [row] = await prisma.$queryRawUnsafe<
    Array<{ total: number; berkoordinat: number }>
  >(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE koordinat IS NOT NULL)::int AS berkoordinat
     FROM pelanggan`,
  );
  return {
    total: row?.total ?? 0,
    berkoordinat: row?.berkoordinat ?? 0,
    tanpaKoordinat: (row?.total ?? 0) - (row?.berkoordinat ?? 0),
  };
}

/** Titik pelanggan potensial berkoordinat. */
export async function titikPotensiFC(): Promise<FC> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      geom: unknown;
      id: string;
      alamat: string;
      status: string;
      kategori: string | null;
      catatan: string | null;
      kodeRute: string | null;
      kodeSurvei: string | null;
    }>
  >(
    `SELECT p.id, p.alamat, p.status::text AS status, p.kategori, p.catatan,
            r.kode AS "kodeRute", p."kodeSurvei",
            ST_AsGeoJSON(p.koordinat)::json AS geom
     FROM potensi_pelanggan p
     LEFT JOIN rute r ON r.id = p."ruteId"
     WHERE p.koordinat IS NOT NULL
     ORDER BY p."createdAt" DESC`,
  );
  return keFC(rows);
}

/** Semua pengaduan yang memiliki titik kejadian, termasuk tiket selesai. */
export async function titikPengaduanFC(): Promise<FC> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      geom: unknown;
      id: string;
      tiket: string;
      jenis: string;
      judul: string;
      status: string;
      prioritas: string;
      alamat: string | null;
      kelurahan: string | null;
      kecamatan: string | null;
    }>
  >(
    `SELECT p.id, p."nomorTiket" AS tiket, p.jenis::text AS jenis, p.judul,
            p.status::text AS status, p.prioritas::text AS prioritas,
            p."alamatKejadian" AS alamat, k.nama AS kelurahan, kc.nama AS kecamatan,
            ST_AsGeoJSON(p.koordinat)::json AS geom
     FROM pengaduan p
     LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
     LEFT JOIN kecamatan kc ON kc.id = p."kecamatanId"
     WHERE p.koordinat IS NOT NULL
     ORDER BY p."createdAt" DESC`,
  );
  return keFC(rows);
}

/** Titik riwayat pencabutan yang memiliki koordinat verifikasi. */
export async function titikEksPelangganFC(): Promise<FC> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      geom: unknown;
      id: string;
      nomor: string | null;
      nama: string | null;
      periode: number;
      jenis: string;
      sumberData: string;
      catatan: string | null;
      kodeSurvei: string | null;
    }>
  >(
    `SELECT id, "nomorLangganan" AS nomor, "namaPelanggan" AS nama, periode,
            jenis::text AS jenis, "sumberData", "catatanSurveiAsli" AS catatan,
            "kodeSurvei",
            ST_AsGeoJSON("koordinatVerifikasi")::json AS geom
     FROM pemutusan
     WHERE "koordinatVerifikasi" IS NOT NULL
     ORDER BY periode DESC, id`,
  );
  return keFC(rows);
}

/** Geometri jalur/cakupan rute baca meter yang tersedia. */
export async function ruteFC(): Promise<FC> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ geom: unknown; id: string; kode: string; noUrut: number | null }>
  >(
    `SELECT id, kode, "noUrut", ST_AsGeoJSON(area)::json AS geom
     FROM rute
     WHERE area IS NOT NULL`,
  );
  return keFC(rows);
}
