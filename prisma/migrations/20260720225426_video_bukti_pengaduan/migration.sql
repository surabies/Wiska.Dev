-- Video bukti pengaduan publik (opsional, maks 60 dtk). Aditif & non-
-- destruktif: dua kolom nullable, dipasangkan url + public_id Cloudinary
-- sama seperti fotoUrl/fotoPublicId.
ALTER TABLE "pengaduan" ADD COLUMN "videoPublicId" TEXT,
ADD COLUMN "videoUrl" TEXT;
