CREATE TYPE "JenisInputLaporanHarian" AS ENUM ('PETUGAS', 'MANUAL_SATUAN', 'MANUAL_MASSAL');

ALTER TYPE "AlasanTaksir" ADD VALUE 'MANUAL_ADD';

ALTER TABLE "laporan_harian_petugas"
ADD COLUMN "jenisInput" "JenisInputLaporanHarian" NOT NULL DEFAULT 'PETUGAS',
ADD COLUMN "alasanManual" TEXT,
ADD COLUMN "manualProvenance" JSONB;
