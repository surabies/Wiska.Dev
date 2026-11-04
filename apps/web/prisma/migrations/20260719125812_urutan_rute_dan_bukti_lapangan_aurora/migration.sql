-- AlterTable
ALTER TABLE "laporan_harian_petugas" ADD COLUMN     "isSegel" BOOLEAN,
ADD COLUMN     "jarakMeter" INTEGER,
ADD COLUMN     "latCatat" DOUBLE PRECISION,
ADD COLUMN     "longCatat" DOUBLE PRECISION,
ADD COLUMN     "usulanNoUrut" INTEGER,
ADD COLUMN     "usulanPerubahan" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "pelanggan" ADD COLUMN     "noUrutRute" INTEGER;

-- CreateIndex
CREATE INDEX "pelanggan_ruteId_noUrutRute_idx" ON "pelanggan"("ruteId", "noUrutRute");
