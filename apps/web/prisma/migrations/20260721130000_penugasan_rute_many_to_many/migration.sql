-- Pemetaan Rute↔Petugas many-to-many berurut, menggantikan kolom tunggal
-- `pencatat.ruteId`. URUTAN AMAN: buat tabel + FK dulu, SALIN data penugasan
-- lama, BARU hapus kolom lama — tanpa kehilangan penugasan yang sudah ada.

-- CreateTable
CREATE TABLE "penugasan_rute" (
    "id" TEXT NOT NULL,
    "pencatatId" TEXT NOT NULL,
    "ruteId" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penugasan_rute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "penugasan_rute_pencatatId_urutan_idx" ON "penugasan_rute"("pencatatId", "urutan");

-- CreateIndex
CREATE INDEX "penugasan_rute_ruteId_idx" ON "penugasan_rute"("ruteId");

-- CreateIndex
CREATE UNIQUE INDEX "penugasan_rute_pencatatId_ruteId_key" ON "penugasan_rute"("pencatatId", "ruteId");

-- AddForeignKey
ALTER TABLE "penugasan_rute" ADD CONSTRAINT "penugasan_rute_pencatatId_fkey" FOREIGN KEY ("pencatatId") REFERENCES "pencatat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_rute" ADD CONSTRAINT "penugasan_rute_ruteId_fkey" FOREIGN KEY ("ruteId") REFERENCES "rute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data-copy: penugasan lama (pencatat.ruteId tunggal) → baris PenugasanRute
-- (urutan 0). gen_random_uuid() tersedia native di Postgres 13+ (Neon).
INSERT INTO "penugasan_rute" ("id", "pencatatId", "ruteId", "urutan", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "ruteId", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "pencatat"
WHERE "ruteId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "pencatat" DROP CONSTRAINT "pencatat_ruteId_fkey";

-- DropIndex
DROP INDEX "pencatat_ruteId_idx";

-- AlterTable
ALTER TABLE "pencatat" DROP COLUMN "ruteId";
