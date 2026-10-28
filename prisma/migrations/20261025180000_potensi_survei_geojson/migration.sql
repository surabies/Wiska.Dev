ALTER TABLE "potensi_pelanggan"
  ADD COLUMN "kategori" TEXT,
  ADD COLUMN "kodeSurvei" TEXT;

CREATE UNIQUE INDEX "potensi_pelanggan_kodeSurvei_key"
  ON "potensi_pelanggan"("kodeSurvei");
