-- AlterTable
ALTER TABLE "laporan_harian_petugas" ADD COLUMN     "blokTarifVerif" INTEGER,
ADD COLUMN     "meterVerifId" TEXT,
ADD COLUMN     "standAkhirRevisi" INTEGER,
ADD COLUMN     "verif1At" TIMESTAMP(3),
ADD COLUMN     "verif1ById" TEXT,
ADD COLUMN     "verif2At" TIMESTAMP(3),
ADD COLUMN     "verif2ById" TEXT,
ADD COLUMN     "verif3At" TIMESTAMP(3),
ADD COLUMN     "verif3ById" TEXT;

-- AddForeignKey
ALTER TABLE "laporan_harian_petugas" ADD CONSTRAINT "laporan_harian_petugas_verif1ById_fkey" FOREIGN KEY ("verif1ById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_harian_petugas" ADD CONSTRAINT "laporan_harian_petugas_verif2ById_fkey" FOREIGN KEY ("verif2ById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_harian_petugas" ADD CONSTRAINT "laporan_harian_petugas_verif3ById_fkey" FOREIGN KEY ("verif3ById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_harian_petugas" ADD CONSTRAINT "laporan_harian_petugas_meterVerifId_fkey" FOREIGN KEY ("meterVerifId") REFERENCES "meter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
