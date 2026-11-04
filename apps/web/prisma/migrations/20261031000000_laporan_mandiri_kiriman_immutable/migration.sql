DO $blok$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "laporan_mandiri"
        GROUP BY "fotoPublicId"
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'fotoPublicId laporan lama tidak unik; rekonsiliasi storage sebelum membuat arsip kiriman.';
    END IF;
END;
$blok$;

CREATE TABLE "kiriman_laporan_mandiri" (
    "id" TEXT NOT NULL,
    "laporanMandiriId" TEXT NOT NULL,
    "pengirimId" TEXT,
    "standDilaporkan" INTEGER NOT NULL,
    "fotoUrl" TEXT NOT NULL,
    "fotoPublicId" TEXT NOT NULL,
    "nomorPelapor" TEXT NOT NULL,
    "namaPelapor" TEXT NOT NULL,
    "diterimaPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kiriman_laporan_mandiri_pkey" PRIMARY KEY ("id")
);

INSERT INTO "kiriman_laporan_mandiri" (
    "id",
    "laporanMandiriId",
    "standDilaporkan",
    "fotoUrl",
    "fotoPublicId",
    "nomorPelapor",
    "namaPelapor",
    "diterimaPada"
)
SELECT
    'legacy_' || md5(l."id"),
    l."id",
    l."standDilaporkan",
    l."fotoUrl",
    l."fotoPublicId",
    l."nomorPelapor",
    l."namaPelapor",
    l."createdAt"
FROM "laporan_mandiri" AS l;

CREATE UNIQUE INDEX "kiriman_laporan_mandiri_fotoPublicId_key"
    ON "kiriman_laporan_mandiri"("fotoPublicId");

CREATE INDEX "kiriman_laporan_mandiri_laporanMandiriId_diterimaPada_idx"
    ON "kiriman_laporan_mandiri"("laporanMandiriId", "diterimaPada");

CREATE INDEX "kiriman_laporan_mandiri_pengirimId_diterimaPada_idx"
    ON "kiriman_laporan_mandiri"("pengirimId", "diterimaPada");

ALTER TABLE "kiriman_laporan_mandiri"
    ADD CONSTRAINT "kiriman_laporan_mandiri_laporanMandiriId_fkey"
    FOREIGN KEY ("laporanMandiriId") REFERENCES "laporan_mandiri"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kiriman_laporan_mandiri"
    ADD CONSTRAINT "kiriman_laporan_mandiri_pengirimId_fkey"
    FOREIGN KEY ("pengirimId") REFERENCES "user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kiriman_laporan_mandiri"
    ADD CONSTRAINT "kiriman_laporan_mandiri_stand_valid"
    CHECK ("standDilaporkan" >= 0);

CREATE FUNCTION baca_meter_tolak_ubah_kiriman_mandiri()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
    RAISE EXCEPTION 'KirimanLaporanMandiri bersifat append-only: % ditolak', TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END;
$fn$;

CREATE TRIGGER "kiriman_laporan_mandiri_append_only"
    BEFORE UPDATE OR DELETE ON "kiriman_laporan_mandiri"
    FOR EACH ROW
    EXECUTE FUNCTION baca_meter_tolak_ubah_kiriman_mandiri();

CREATE TRIGGER "kiriman_laporan_mandiri_tanpa_truncate"
    BEFORE TRUNCATE ON "kiriman_laporan_mandiri"
    FOR EACH STATEMENT
    EXECUTE FUNCTION baca_meter_tolak_ubah_kiriman_mandiri();
