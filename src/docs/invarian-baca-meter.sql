-- =============================================================================
-- Invarian pembacaan meter air — lampiran SQL untuk migration yang direview.
--
-- PENTING
-- 1. Nama tabel di bawah mengikuti @@map aktual, bukan nama model Prisma:
--      Meter                   -> meter
--      PembacaanMeter          -> pembacaan_meter
--      Tagihan                 -> tagihan
--      PeriodePenagihan        -> periode_penagihan
--      LaporanMandiri          -> laporan_mandiri
--      KirimanLaporanMandiri   -> kiriman_laporan_mandiri
--      AuditLog                -> audit_log
-- 2. File ini belum pernah dijalankan terhadap database proyek. Jalankan query
--    preflight, selesaikan hasilnya, lalu salin DDL ke migration Prisma baru.
--    Jangan menjalankan file ini langsung di produksi.
-- 3. PeriodeTagih, MeterTerpasang, PengirimanBacaan, dan PenyesuaianTagihan
--    tidak dibuat: konsep periode, meter, intake, dan tagihan sudah memiliki
--    model canonical di schema proyek atau belum masuk cakupan fase ini.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PREFLIGHT — hasil harus ditinjau sebelum DDL pada migration dibuat.
-- -----------------------------------------------------------------------------

-- Jika query ini mengembalikan baris, bersihkan/sahkan meter aktif terlebih
-- dahulu sebelum membuat partial unique index di bawah.
SELECT
  "pelangganId",
  count(*) AS "jumlahMeterAktif"
FROM "meter"
WHERE "isAktif" = true
GROUP BY "pelangganId"
HAVING count(*) > 1
ORDER BY "jumlahMeterAktif" DESC, "pelangganId";

-- Memeriksa kode periode di model periode yang sudah ada.
SELECT "id", "periode"
FROM "periode_penagihan"
WHERE "periode" NOT BETWEEN 200001 AND 210012
   OR ("periode" % 100) NOT BETWEEN 1 AND 12
ORDER BY "periode";

-- Membandingkan jumlah konsumsi tagihan dengan delta stand. Perbedaan tidak
-- otomatis salah; hasil harus direkonsiliasi dengan aturan tarif/estimasi lama.
SELECT
  count(*) AS "jumlahPembacaan",
  count(*) FILTER (
    WHERE "pemakaianRiil" IS NOT NULL
      AND "pemakaianM3" <> "pemakaianRiil"
  ) AS "pemakaianTagihBerbedaDariRiil"
FROM "pembacaan_meter";

-- -----------------------------------------------------------------------------
-- DDL yang dapat dimasukkan ke migration setelah preflight disetujui.
-- -----------------------------------------------------------------------------

BEGIN;

DO $blok$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "meter"
    WHERE "isAktif" = true
    GROUP BY "pelangganId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Masih ada lebih dari satu meter aktif pada sambungan; selesaikan preflight sebelum membuat index.';
  END IF;

  IF to_regclass('public.kiriman_laporan_mandiri') IS NULL THEN
    RAISE EXCEPTION
      'Tabel kiriman_laporan_mandiri belum ada; terapkan migration tabel kiriman terlebih dahulu.';
  END IF;
END;
$blok$;

-- Model Meter menyimpan riwayat perangkat sebagai baris terpisah. Nomor meter
-- fisik tidak unik di data lama, sehingga invariant memakai pelangganId + flag
-- aktif, bukan nomorMeter.
CREATE UNIQUE INDEX IF NOT EXISTS "meter_satu_aktif_per_pelanggan"
  ON "meter" ("pelangganId")
  WHERE "isAktif" = true;

CREATE OR REPLACE FUNCTION baca_meter_tolak_ubah_hapus()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION 'Tabel % bersifat append-only: % ditolak', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$fn$;

-- Nama tabel AuditLog aktual adalah audit_log, sesuai @@map pada schema.
DROP TRIGGER IF EXISTS "audit_log_append_only" ON "audit_log";
CREATE TRIGGER "audit_log_append_only"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW
  EXECUTE FUNCTION baca_meter_tolak_ubah_hapus();

DROP TRIGGER IF EXISTS "audit_log_tanpa_truncate" ON "audit_log";
CREATE TRIGGER "audit_log_tanpa_truncate"
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT
  EXECUTE FUNCTION baca_meter_tolak_ubah_hapus();

-- Setiap percobaan laporan mandiri disimpan terpisah; baris LaporanMandiri
-- hanya proyeksi antrean/status terbaru.
ALTER TABLE "kiriman_laporan_mandiri"
  DROP CONSTRAINT IF EXISTS "kiriman_laporan_mandiri_stand_valid";
ALTER TABLE "kiriman_laporan_mandiri"
  ADD CONSTRAINT "kiriman_laporan_mandiri_stand_valid"
  CHECK ("standDilaporkan" >= 0);

DROP TRIGGER IF EXISTS "kiriman_laporan_mandiri_append_only"
  ON "kiriman_laporan_mandiri";
CREATE TRIGGER "kiriman_laporan_mandiri_append_only"
  BEFORE UPDATE OR DELETE ON "kiriman_laporan_mandiri"
  FOR EACH ROW
  EXECUTE FUNCTION baca_meter_tolak_ubah_hapus();

DROP TRIGGER IF EXISTS "kiriman_laporan_mandiri_tanpa_truncate"
  ON "kiriman_laporan_mandiri";
CREATE TRIGGER "kiriman_laporan_mandiri_tanpa_truncate"
  BEFORE TRUNCATE ON "kiriman_laporan_mandiri"
  FOR EACH STATEMENT
  EXECUTE FUNCTION baca_meter_tolak_ubah_hapus();

COMMIT;

-- Koreksi setelah invoice terbit belum dimodelkan sebagai adjustment uang.
-- Jangan mengubah tagihan lama lewat trigger/SQL ini. Fase koreksi harus
-- menambahkan revision pembacaan yang ter-audit dan alur billing terpisah.
