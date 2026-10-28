-- TarifBlok.catatan — dasar hukum / asal-usul angka tarif.
--
-- Sebagian blok tarif direkonstruksi dari tagihan Aurora yang sudah terbit,
-- bukan dari SK. Rekonstruksi itu terbukti tepat (135.197 pengamatan, nol
-- konflik) tapi BUKAN pengesahan — kolom ini yang membedakan keduanya, dan
-- membuat pertanyaan "dari mana angka ini?" bisa dijawab dari barisnya
-- sendiri, bukan dari git log.
ALTER TABLE "tarif_blok" ADD COLUMN "catatan" TEXT;
