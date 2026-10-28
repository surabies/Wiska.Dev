-- Modul anomali: jenis tugas pencatat + kunjungan anomali.
--
-- Kolom `koordinat` memakai tipe PostGIS yang tidak dimodelkan Prisma
-- (Unsupported), jadi migrasi ini ditulis tangan.

CREATE TYPE "JenisTugasPencatat" AS ENUM ('PENCATAT_METER', 'PENYELIA_ANOMALI');
CREATE TYPE "KategoriAnomali" AS ENUM ('TERKUNCI', 'DIDUGA_KOSONG', 'METER_RUSAK');
CREATE TYPE "HasilKunjunganAnomali" AS ENUM (
  'BERTEMU_TERBACA', 'BERTEMU_TIDAK_TERBACA', 'TETAP_TERKUNCI',
  'KOSONG_TERKONFIRMASI', 'METER_DIPINDAH', 'PERLU_GANTI_METER',
  'USUL_TUTUP_SEMENTARA', 'ALAMAT_TIDAK_DITEMUKAN'
);

ALTER TABLE "pencatat"
  ADD COLUMN "jenisTugas" "JenisTugasPencatat" NOT NULL DEFAULT 'PENCATAT_METER';
CREATE INDEX "pencatat_jenisTugas_idx" ON "pencatat"("jenisTugas");

CREATE TABLE "kunjungan_anomali" (
  "id"             TEXT NOT NULL,
  "pelangganId"    TEXT NOT NULL,
  "periode"        INTEGER NOT NULL,
  "kategori"       "KategoriAnomali" NOT NULL,
  "bulanBerturut"  INTEGER NOT NULL,
  "m3TanpaDasar"   INTEGER NOT NULL,
  "pencatatId"     TEXT,
  "hasil"          "HasilKunjunganAnomali" NOT NULL,
  "standDitemukan" INTEGER,
  "fotoUrl"        TEXT,
  "fotoPublicId"   TEXT,
  "koordinat"      geometry(Point, 4326),
  "catatan"        TEXT,
  "dikunjungiAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kunjungan_anomali_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kunjungan_anomali_pelangganId_periode_key"
  ON "kunjungan_anomali"("pelangganId", "periode");
CREATE INDEX "kunjungan_anomali_periode_hasil_idx" ON "kunjungan_anomali"("periode", "hasil");
CREATE INDEX "kunjungan_anomali_periode_kategori_idx" ON "kunjungan_anomali"("periode", "kategori");
CREATE INDEX "kunjungan_anomali_pencatatId_periode_idx" ON "kunjungan_anomali"("pencatatId", "periode");
-- Indeks spasial: dipakai untuk memeriksa sebaran kunjungan di peta.
CREATE INDEX "kunjungan_anomali_koordinat_idx" ON "kunjungan_anomali" USING GIST ("koordinat");

ALTER TABLE "kunjungan_anomali"
  ADD CONSTRAINT "kunjungan_anomali_pelangganId_fkey"
  FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kunjungan_anomali"
  ADD CONSTRAINT "kunjungan_anomali_pencatatId_fkey"
  FOREIGN KEY ("pencatatId") REFERENCES "pencatat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
