-- Alur pengaduan enterprise: nomor tiket custom, workflow status penuh,
-- linimasa tindak lanjut, SLA + eskalasi, dan rating kepuasan.
--
-- CATATAN UNTUK YANG MENJALANKAN:
--  * Migrasi ini ADITIF — tidak ada kolom/tabel yang dihapus dan tidak ada
--    data lama yang ditimpa. Baris `pengaduan` yang sudah ada tetap valid:
--    nomorTiket lamanya (cuid) dipertahankan apa adanya dan tetap bisa
--    dilacak, karena pencocokan di endpoint publik adalah exact match.
--  * Yang dihapus HANYA DEFAULT dari kolom nomorTiket (nilainya tidak
--    disentuh) — nomor tiket sekarang dibangkitkan aplikasi dengan format
--    TW-YYMM-XXXXXX; lihat server/modules/pengaduan/tiket.ts.
--  * `ALTER TYPE ... ADD VALUE` aman di dalam transaksi migrasi Prisma pada
--    PostgreSQL 12+ SELAMA nilai barunya tidak dipakai di DML pada migrasi
--    yang sama. Migrasi ini memang tidak memakainya — jangan tambahkan
--    UPDATE yang menyebut nilai-nilai baru itu ke file ini.

-- AlterEnum: tiga keadaan baru di alur kerja tiket.
ALTER TYPE "StatusPengaduan" ADD VALUE 'MENUNGGU_PELANGGAN';
ALTER TYPE "StatusPengaduan" ADD VALUE 'DITUTUP';
ALTER TYPE "StatusPengaduan" ADD VALUE 'DIBUKA_KEMBALI';

-- CreateEnum
CREATE TYPE "AksiPengaduan" AS ENUM ('DIBUAT', 'DITUGASKAN', 'STATUS_DIUBAH', 'CATATAN', 'ESKALASI', 'DIKONFIRMASI', 'DIBUKA_KEMBALI', 'DINILAI');

-- AlterTable
ALTER TABLE "pengaduan" ADD COLUMN     "fotoPublicId" TEXT,
ADD COLUMN     "targetResponsAt" TIMESTAMP(3),
ADD COLUMN     "targetSelesaiAt" TIMESTAMP(3),
ADD COLUMN     "responsAt" TIMESTAMP(3),
ADD COLUMN     "jedaMulaiAt" TIMESTAMP(3),
ADD COLUMN     "jedaTotalMenit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "eskalasiAt" TIMESTAMP(3),
ADD COLUMN     "eskalasiKeId" TEXT,
ADD COLUMN     "alasanEskalasi" TEXT,
ADD COLUMN     "ratingKepuasan" INTEGER,
ADD COLUMN     "komentarKepuasan" TEXT,
ADD COLUMN     "ratingAt" TIMESTAMP(3),
ADD COLUMN     "jumlahDibukaKembali" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: nomor tiket kini dibangkitkan aplikasi (format TW-YYMM-XXXXXX).
-- Hanya DEFAULT-nya yang dilepas; nilai baris lama tidak diubah.
ALTER TABLE "pengaduan" ALTER COLUMN "nomorTiket" DROP DEFAULT;

-- CreateTable
CREATE TABLE "riwayat_pengaduan" (
    "id" TEXT NOT NULL,
    "pengaduanId" TEXT NOT NULL,
    "aksi" "AksiPengaduan" NOT NULL,
    "statusDari" "StatusPengaduan",
    "statusKe" "StatusPengaduan",
    "catatan" TEXT,
    "fotoUrl" TEXT,
    "fotoPublicId" TEXT,
    "isPublik" BOOLEAN NOT NULL DEFAULT false,
    "olehId" TEXT,
    "olehNama" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_pengaduan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "riwayat_pengaduan_pengaduanId_createdAt_idx" ON "riwayat_pengaduan"("pengaduanId", "createdAt");

-- CreateIndex
CREATE INDEX "riwayat_pengaduan_olehId_idx" ON "riwayat_pengaduan"("olehId");

-- CreateIndex
CREATE INDEX "pengaduan_ditugaskanKeId_idx" ON "pengaduan"("ditugaskanKeId");

-- CreateIndex
CREATE INDEX "pengaduan_status_targetSelesaiAt_idx" ON "pengaduan"("status", "targetSelesaiAt");

-- AddForeignKey
ALTER TABLE "pengaduan" ADD CONSTRAINT "pengaduan_eskalasiKeId_fkey" FOREIGN KEY ("eskalasiKeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_pengaduan" ADD CONSTRAINT "riwayat_pengaduan_pengaduanId_fkey" FOREIGN KEY ("pengaduanId") REFERENCES "pengaduan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_pengaduan" ADD CONSTRAINT "riwayat_pengaduan_olehId_fkey" FOREIGN KEY ("olehId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
