-- Foto bukti kunjungan anomali: segel & rumah, plus kondisi segel.
--
-- Kunjungan anomali kini merekam TIGA foto seperti pencatatan rutin
-- (stand, segel, rumah). Kolom `fotoUrl` yang sudah ada tetap menjadi foto
-- STAND — tidak dinamai ulang supaya baris lama tidak perlu di-backfill.

ALTER TABLE "kunjungan_anomali"
  ADD COLUMN "fotoSegelUrl" TEXT,
  ADD COLUMN "fotoRumahUrl" TEXT,
  ADD COLUMN "isSegel"      BOOLEAN;
