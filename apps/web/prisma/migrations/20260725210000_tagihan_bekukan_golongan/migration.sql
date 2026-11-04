-- Tagihan.tarifGolonganId — membekukan golongan tarif yang DIPAKAI saat
-- tagihan diterbitkan.
--
-- Pelanggan.tarifGolonganId adalah nilai BERJALAN; tagihan adalah dokumen
-- SEJARAH. Tanpa pembekuan ini, menghitung ulang tagihan periode lama
-- memakai golongan hari ini akan meleset setiap kali pelanggan berpindah
-- golongan — terbukti nyata pada tiga pelanggan yang pindah golongan antara
-- April dan Juni 2026.
--
-- Nullable: baris warisan impor Aurora tidak membawanya, dan diisi belakangan
-- lewat backfill yang menurunkannya dari angka tagihan itu sendiri.
ALTER TABLE "tagihan" ADD COLUMN "tarifGolonganId" TEXT;

ALTER TABLE "tagihan" ADD CONSTRAINT "tagihan_tarifGolonganId_fkey"
  FOREIGN KEY ("tarifGolonganId") REFERENCES "tarif_golongan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tagihan_tarifGolonganId_idx" ON "tagihan"("tarifGolonganId");
