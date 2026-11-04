-- Penugasan rute ke pencatat: kolom pencatat.ruteId (nullable FK ke rute).
-- Dasar endpoint mobile GET /api/v1/laporan-harian/rute-saya — petugas
-- pencatat mengunduh daftar pelanggan rute yang dipegangnya.
--
-- CATATAN UNTUK YANG MENJALANKAN:
--  * Migrasi ini ADITIF MURNI — satu kolom nullable + index + FK; tidak ada
--    kolom/tabel yang dihapus dan tidak ada data lama yang disentuh.
--  * SENGAJA bukan UNIQUE: satu rute boleh dipegang lebih dari satu
--    pencatat (pembagian beban / pengganti cuti).

-- AlterTable
ALTER TABLE "pencatat" ADD COLUMN "ruteId" TEXT;

-- CreateIndex
CREATE INDEX "pencatat_ruteId_idx" ON "pencatat"("ruteId");

-- AddForeignKey
ALTER TABLE "pencatat" ADD CONSTRAINT "pencatat_ruteId_fkey" FOREIGN KEY ("ruteId") REFERENCES "rute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
