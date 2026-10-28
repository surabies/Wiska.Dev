-- CreateEnum
CREATE TYPE "StatusPeriodePenagihan" AS ENUM ('BERJALAN', 'TERKUNCI');

-- AlterTable
ALTER TABLE "laporan_harian_petugas" ADD COLUMN     "pemakaianTagihVerif" INTEGER;

-- CreateTable
CREATE TABLE "periode_penagihan" (
    "id" TEXT NOT NULL,
    "periode" INTEGER NOT NULL,
    "status" "StatusPeriodePenagihan" NOT NULL DEFAULT 'BERJALAN',
    "tanggalJatuhTempo" TIMESTAMP(3),
    "ditutupAt" TIMESTAMP(3),
    "ditutupById" TEXT,
    "dibukaAt" TIMESTAMP(3),
    "dibukaById" TEXT,
    "alasanBuka" TEXT,
    "jumlahSL" INTEGER,
    "totalM3" INTEGER,
    "totalTagihan" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periode_penagihan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "periode_penagihan_periode_key" ON "periode_penagihan"("periode");

-- CreateIndex
CREATE INDEX "periode_penagihan_status_idx" ON "periode_penagihan"("status");

-- AddForeignKey
ALTER TABLE "periode_penagihan" ADD CONSTRAINT "periode_penagihan_ditutupById_fkey" FOREIGN KEY ("ditutupById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periode_penagihan" ADD CONSTRAINT "periode_penagihan_dibukaById_fkey" FOREIGN KEY ("dibukaById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

