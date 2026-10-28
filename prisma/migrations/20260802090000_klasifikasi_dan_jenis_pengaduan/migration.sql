-- Menggolongkan aduan pada DUA sumbu: `klasifikasi` (soal nilai tagihan atau
-- bukan) dan `jenis` (pokok persoalannya), menggantikan daftar jenis lama yang
-- tidak memakai istilah loket pengaduan perusahaan.

-- CreateEnum
CREATE TYPE "KlasifikasiPengaduan" AS ENUM ('NILAI_TAGIHAN_REKENING', 'BUKAN_NILAI_TAGIHAN_REKENING');

-- AlterTable
-- DEFAULT dipasang supaya penambahan kolom NOT NULL ini tidak memaksa backfill
-- manual, dan nilainya yang paling lazim supaya baris lama tidak salah tercap
-- sebagai sengketa tagihan.
ALTER TABLE "pengaduan"
  ADD COLUMN "klasifikasi" "KlasifikasiPengaduan" NOT NULL DEFAULT 'BUKAN_NILAI_TAGIHAN_REKENING';

-- Baris lama yang memang sengketa nilai rekening dipindahkan SEBELUM kolom
-- `jenis` dikonversi — setelah konversi, label TAGIHAN_TIDAK_SESUAI sudah tidak
-- ada lagi untuk dikenali.
UPDATE "pengaduan" SET "klasifikasi" = 'NILAI_TAGIHAN_REKENING'
WHERE "jenis"::text = 'TAGIHAN_TIDAK_SESUAI';

-- AlterEnum
-- Postgres tidak bisa MENGHAPUS label enum, jadi tipe baru dibuat lalu ditukar.
-- Pemetaan ditulis eksplisit (bukan cast teks polos) karena cast polos akan
-- menggagalkan seluruh migrasi begitu ada satu baris berlabel lama.
CREATE TYPE "JenisPengaduan_new" AS ENUM (
  'LAPOR_STAND_METER',
  'MUTASI_GOLONGAN_TARIF',
  'TIDAK_MAMPU_BAYAR',
  'PENCATATAN_METER_TIDAK_SESUAI',
  'LONJAKAN_PEMAKAIAN_AIR',
  'GANTI_STOP_KRAN',
  'BOCOR_PIPA_DINAS',
  'PASANGAN_LIAR',
  'TIDAK_ADA_AIR',
  'AIR_KERUH_BAU_BERWARNA',
  'PINDAH_JARINGAN',
  'LAINNYA'
);

-- Yang tidak punya padanan lugas (KUALITAS_LAYANAN, TAGIHAN_TIDAK_SESUAI)
-- jatuh ke LAINNYA alih-alih ditebak-tebak; untuk sengketa tagihan, keterangan
-- sebenarnya sudah terbawa oleh kolom `klasifikasi` di atas.
ALTER TABLE "pengaduan"
  ALTER COLUMN "jenis" TYPE "JenisPengaduan_new"
  USING (
    CASE "jenis"::text
      WHEN 'KEBOCORAN' THEN 'BOCOR_PIPA_DINAS'
      WHEN 'AIR_MATI' THEN 'TIDAK_ADA_AIR'
      WHEN 'AIR_KERUH' THEN 'AIR_KERUH_BAU_BERWARNA'
      WHEN 'METER_RUSAK' THEN 'PENCATATAN_METER_TIDAK_SESUAI'
      ELSE 'LAINNYA'
    END
  )::"JenisPengaduan_new";

ALTER TYPE "JenisPengaduan" RENAME TO "JenisPengaduan_old";
ALTER TYPE "JenisPengaduan_new" RENAME TO "JenisPengaduan";
DROP TYPE "JenisPengaduan_old";
