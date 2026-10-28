-- Revert 20260729100000_tagihan_harga_air_asli.
--
-- Kolom ini dibuat untuk menyimpan angka jmlhargaair APA ADANYA dari
-- ProgresCater sebagai jejak audit, dipasangkan dengan step 06 yang saat
-- itu menerbitkan Tagihan LANGSUNG dari CSV lewat seed. Keputusan itu
-- dibalik: Tagihan HANYA boleh terbit lewat alur resminya (impor
-- pencatatan -> verifikasi V1-V3 -> Closing periode, lihat
-- packages/server/modules/closing/closing.service.ts), bukan dari seed.
-- Tanpa jalur seed itu, kolom ini tidak pernah diisi siapa pun.
ALTER TABLE "tagihan" DROP COLUMN "jmlHargaAirAsli";
