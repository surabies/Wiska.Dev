-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AksiPengaduan" ADD VALUE 'DIVERIFIKASI';
ALTER TYPE "AksiPengaduan" ADD VALUE 'CHAT';
ALTER TYPE "AksiPengaduan" ADD VALUE 'DITUTUP_OTOMATIS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusPengaduan" ADD VALUE 'TERVERIFIKASI';
ALTER TYPE "StatusPengaduan" ADD VALUE 'MENUJU_LOKASI';

-- AlterTable
ALTER TABLE "pengaduan" ADD COLUMN     "fotoPenyelesaianPublicId" TEXT,
ADD COLUMN     "fotoPenyelesaianUrl" TEXT,
ADD COLUMN     "kecamatanId" TEXT,
ADD COLUMN     "kelurahanId" TEXT,
ADD COLUMN     "konfirmasiBatasAt" TIMESTAMP(3),
ADD COLUMN     "verifikasiAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "langganan_warga" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "isUtama" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "langganan_warga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "langganan_warga_pelangganId_idx" ON "langganan_warga"("pelangganId");

-- CreateIndex
CREATE UNIQUE INDEX "langganan_warga_userId_pelangganId_key" ON "langganan_warga"("userId", "pelangganId");

-- CreateIndex
CREATE INDEX "pengaduan_kelurahanId_idx" ON "pengaduan"("kelurahanId");

-- CreateIndex
CREATE INDEX "pengaduan_kecamatanId_idx" ON "pengaduan"("kecamatanId");

-- CreateIndex
CREATE INDEX "pengaduan_status_konfirmasiBatasAt_idx" ON "pengaduan"("status", "konfirmasiBatasAt");

-- AddForeignKey
ALTER TABLE "pengaduan" ADD CONSTRAINT "pengaduan_kecamatanId_fkey" FOREIGN KEY ("kecamatanId") REFERENCES "kecamatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengaduan" ADD CONSTRAINT "pengaduan_kelurahanId_fkey" FOREIGN KEY ("kelurahanId") REFERENCES "kelurahan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "langganan_warga" ADD CONSTRAINT "langganan_warga_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "langganan_warga" ADD CONSTRAINT "langganan_warga_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

