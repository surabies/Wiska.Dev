-- CreateEnum
CREATE TYPE "SumberDaftarCatat" AS ENUM ('CARRY_OVER', 'PBPK', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusDaftarCatat" AS ENUM ('BELUM_DICATAT', 'DICATAT', 'TIDAK_TERCATAT', 'DICABUT');

-- CreateEnum
CREATE TYPE "JenisBiayaTetap" AS ENUM ('BEA_BEBAN', 'BEA_ADMIN', 'AIR_KOTOR');

-- CreateEnum
CREATE TYPE "AlasanTaksir" AS ENUM ('MINIMUM_5M3', 'TAKSIRAN_BULAN_LALU', 'NOL_TIDAK_ADA_AIR', 'OVERRIDE_MANUAL');

-- AlterTable
ALTER TABLE "pembacaan_meter" ADD COLUMN     "alasanTaksir" "AlasanTaksir",
ADD COLUMN     "pemakaianRiil" INTEGER;

-- CreateTable
CREATE TABLE "daftar_catat" (
    "id" TEXT NOT NULL,
    "periode" INTEGER NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "ruteId" TEXT,
    "pencatatId" TEXT,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "sumber" "SumberDaftarCatat" NOT NULL,
    "status" "StatusDaftarCatat" NOT NULL DEFAULT 'BELUM_DICATAT',
    "selesaiAt" TIMESTAMP(3),
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daftar_catat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biaya_tetap" (
    "id" TEXT NOT NULL,
    "jenis" "JenisBiayaTetap" NOT NULL,
    "ukuranMeter" "UkuranMeter",
    "nominal" INTEGER NOT NULL,
    "berlakuMulai" TIMESTAMP(3) NOT NULL,
    "berlakuSampai" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biaya_tetap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daftar_catat_periode_pencatatId_idx" ON "daftar_catat"("periode", "pencatatId");

-- CreateIndex
CREATE INDEX "daftar_catat_periode_ruteId_idx" ON "daftar_catat"("periode", "ruteId");

-- CreateIndex
CREATE INDEX "daftar_catat_periode_status_idx" ON "daftar_catat"("periode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "daftar_catat_periode_pelangganId_key" ON "daftar_catat"("periode", "pelangganId");

-- CreateIndex
CREATE INDEX "biaya_tetap_jenis_berlakuMulai_idx" ON "biaya_tetap"("jenis", "berlakuMulai");

-- AddForeignKey
ALTER TABLE "daftar_catat" ADD CONSTRAINT "daftar_catat_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daftar_catat" ADD CONSTRAINT "daftar_catat_ruteId_fkey" FOREIGN KEY ("ruteId") REFERENCES "rute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daftar_catat" ADD CONSTRAINT "daftar_catat_pencatatId_fkey" FOREIGN KEY ("pencatatId") REFERENCES "pencatat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

