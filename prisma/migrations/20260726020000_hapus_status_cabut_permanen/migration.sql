-- Hapus nilai "CABUT_PERMANEN" dari StatusPelanggan.
--
-- ALASAN: di PDAM tidak ada pencabutan yang selamanya — bekas pelanggan
-- kapan pun boleh memasang kembali, jadi status ini tidak pernah bisa
-- benar. Ia juga bertabrakan istilah dengan StatusDaftarCatat.DICABUT
-- ("dicabut pada periode ini, tetap masuk beban kerja bulan itu"), sehingga
-- kata "cabut" menunjuk dua hal berbeda di dua tabel.
--
-- AMAN: diperiksa sebelum migrasi ini ditulis — 0 baris memakainya
-- (AKTIF 22.502, TUTUP_SEMENTARA 61, TUTUP_SPT 56), dan hanya satu kolom
-- di seluruh basis data yang bertipe enum ini (pelanggan.status).
--
-- Postgres tidak punya "ALTER TYPE ... DROP VALUE", jadi tipenya dibangun
-- ulang. Guard di bawah membuat migrasi GAGAL alih-alih membuang data diam-
-- diam bila ternyata ada baris yang memakainya di lingkungan lain.
DO $$
DECLARE
  sisa integer;
BEGIN
  SELECT count(*) INTO sisa FROM "pelanggan" WHERE "status" = 'CABUT_PERMANEN';
  IF sisa > 0 THEN
    RAISE EXCEPTION
      'Migrasi dibatalkan: % baris pelanggan masih berstatus CABUT_PERMANEN. Tentukan status penggantinya (TUTUP_SPT bila karena tunggakan, TUTUP_SEMENTARA bila atas permintaan pelanggan) sebelum menjalankan migrasi ini.',
      sisa;
  END IF;
END $$;

ALTER TYPE "StatusPelanggan" RENAME TO "StatusPelanggan_lama";

CREATE TYPE "StatusPelanggan" AS ENUM ('AKTIF', 'TUTUP_SEMENTARA', 'DISEGEL', 'TUTUP_SPT');

ALTER TABLE "pelanggan"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "StatusPelanggan" USING ("status"::text::"StatusPelanggan"),
  ALTER COLUMN "status" SET DEFAULT 'AKTIF';

DROP TYPE "StatusPelanggan_lama";
