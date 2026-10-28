-- Idempotensi pengaduan publik: kunci client (UUID v4) untuk memulangkan
-- tiket yang SAMA saat retry/tap-ganda, alih-alih membuat tiket kembar.
-- Aditif & non-destruktif: kolom nullable (baris lama = NULL; Postgres
-- mengizinkan banyak NULL pada kolom unique).
ALTER TABLE "pengaduan" ADD COLUMN "clientRequestId" TEXT;

CREATE UNIQUE INDEX "pengaduan_clientRequestId_key" ON "pengaduan"("clientRequestId");
