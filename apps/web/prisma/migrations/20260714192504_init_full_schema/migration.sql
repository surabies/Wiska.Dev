-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'DIREKSI', 'SENIOR_MANAGER', 'MANAGER', 'SUPERVISOR', 'STAFF', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "JenisPengaduan" AS ENUM ('KEBOCORAN', 'AIR_MATI', 'AIR_KERUH', 'METER_RUSAK', 'TAGIHAN_TIDAK_SESUAI', 'KUALITAS_LAYANAN', 'LAINNYA');

-- CreateEnum
CREATE TYPE "PrioritasPengaduan" AS ENUM ('RENDAH', 'NORMAL', 'TINGGI', 'DARURAT');

-- CreateEnum
CREATE TYPE "StatusPengaduan" AS ENUM ('BARU', 'DITUGASKAN', 'DIPROSES', 'SELESAI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "StatusLaporanMandiri" AS ENUM ('MENUNGGU', 'DIVERIFIKASI', 'DITOLAK', 'DIGUNAKAN');

-- CreateEnum
CREATE TYPE "JenisMutasi" AS ENUM ('PB', 'PK');

-- CreateEnum
CREATE TYPE "JenisPemutusan" AS ENUM ('TSM', 'SPT', 'LAINNYA');

-- CreateEnum
CREATE TYPE "StatusPotensi" AS ENUM ('PROSPEK', 'DITOLAK', 'MENUNGGU_SURVEI', 'VALIDASI');

-- CreateEnum
CREATE TYPE "KodeDivisi" AS ENUM ('PELAYANAN', 'TEHNIK', 'UMUM', 'UTAMA');

-- CreateEnum
CREATE TYPE "GolonganTarif" AS ENUM ('GOL_1A', 'GOL_1B', 'GOL_2A1', 'GOL_2A2', 'GOL_2A3', 'GOL_2A4', 'GOL_2A5', 'GOL_2B', 'GOL_3A', 'GOL_3B', 'GOL_3C', 'GOL_4A', 'GOL_4B');

-- CreateEnum
CREATE TYPE "ObjekBayar" AS ENUM ('SIPIL', 'AUTODEBET', 'HANKAM');

-- CreateEnum
CREATE TYPE "StatusPelanggan" AS ENUM ('AKTIF', 'TUTUP_SEMENTARA', 'DISEGEL', 'TUTUP_SPT', 'CABUT_PERMANEN');

-- CreateEnum
CREATE TYPE "StatusPasokanAir" AS ENUM ('PENUH', 'BERGILIR');

-- CreateEnum
CREATE TYPE "UkuranMeter" AS ENUM ('INCH_HALF', 'INCH_1', 'INCH_1_HALF', 'INCH_2', 'INCH_3', 'INCH_4');

-- CreateEnum
CREATE TYPE "KondisiCatat" AS ENUM ('NORMAL', 'TIDAK_DIPAKAI', 'RUMAH_KOSONG', 'STAND_TEMPEL', 'STAND_KONSUMEN', 'METER_RUSAK', 'METER_MATI_ADA_AIR', 'METER_MUNDUR', 'METER_TERBALIK', 'METER_DALAM_AIR', 'LOS_METER', 'BMK_BMB', 'TTB', 'MTA', 'TERHALANG', 'TIDAK_ADA_AIR', 'ADA_ANJING', 'DK', 'MB', 'MUDA_KEMBALI', 'REV_PENCATAT', 'DICABUT');

-- CreateEnum
CREATE TYPE "KategoriPembacaan" AS ENUM ('ONSITE', 'OFFSITE');

-- CreateEnum
CREATE TYPE "StatusTagihan" AS ENUM ('BELUM_BAYAR', 'SUDAH_BAYAR', 'JATUH_TEMPO', 'DIHAPUSKAN');

-- CreateEnum
CREATE TYPE "JenisTagihanLain" AS ENUM ('PASANG_BARU', 'BALIK_NAMA', 'GANTI_METER', 'BUKA_SEGEL', 'DENDA_PELANGGARAN', 'LAINNYA');

-- CreateEnum
CREATE TYPE "KanalPembayaran" AS ENUM ('TELLER_KANTOR', 'PPOB_BANK', 'PPOB_MINIMARKET', 'VIRTUAL_ACCOUNT', 'QRIS', 'AUTODEBET');

-- CreateEnum
CREATE TYPE "StatusPembayaran" AS ENUM ('PENDING', 'BERHASIL', 'GAGAL', 'EXPIRED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "divisiId" TEXT,
    "bagianId" TEXT,
    "subBagianId" TEXT,
    "divisiKode" TEXT,
    "subBagianKode" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_token" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "two_factor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengaduan" (
    "id" TEXT NOT NULL,
    "nomorTiket" TEXT NOT NULL,
    "pelangganId" TEXT,
    "nomorLangganan" TEXT,
    "jenis" "JenisPengaduan" NOT NULL,
    "judul" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "koordinat" geometry(Point, 4326),
    "alamatKejadian" TEXT,
    "prioritas" "PrioritasPengaduan" NOT NULL DEFAULT 'NORMAL',
    "status" "StatusPengaduan" NOT NULL DEFAULT 'BARU',
    "pelapor" TEXT NOT NULL,
    "kontakPelapor" TEXT,
    "fotoUrl" TEXT,
    "ditugaskanKeId" TEXT,
    "ditanganiMulai" TIMESTAMP(3),
    "selesaiAt" TIMESTAMP(3),
    "catatanPenyelesaian" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pengaduan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laporan_harian_petugas" (
    "id" TEXT NOT NULL,
    "nomorLangganan" TEXT NOT NULL,
    "pelangganId" TEXT,
    "namaPelanggan" TEXT,
    "alamatPelanggan" TEXT,
    "periode" INTEGER NOT NULL,
    "standAwal" INTEGER NOT NULL,
    "standAkhir" INTEGER NOT NULL,
    "pemakaian" INTEGER NOT NULL,
    "pemakaianLalu" INTEGER,
    "persentase" INTEGER,
    "kondisi" "KondisiCatat" NOT NULL DEFAULT 'NORMAL',
    "kategori" "KategoriPembacaan" NOT NULL DEFAULT 'ONSITE',
    "nomorMeter" TEXT,
    "pencatatId" TEXT,
    "tanggalCatat" TIMESTAMP(3),
    "tanggalUpload" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "catatanVerif" TEXT,
    "pembacaanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laporan_harian_petugas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laporan_mandiri" (
    "id" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "nomorLangganan" TEXT NOT NULL,
    "periode" INTEGER NOT NULL,
    "standDilaporkan" INTEGER NOT NULL,
    "fotoUrl" TEXT NOT NULL,
    "fotoPublicId" TEXT NOT NULL,
    "nomorPelapor" TEXT NOT NULL,
    "namaPelapor" TEXT NOT NULL,
    "status" "StatusLaporanMandiri" NOT NULL DEFAULT 'MENUNGGU',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "alasanDitolak" TEXT,
    "pembacaanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laporan_mandiri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mutasi_pelanggan" (
    "id" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "jenis" "JenisMutasi" NOT NULL,
    "periode" INTEGER NOT NULL,
    "nomorMeterBaru" TEXT,
    "merkMeterBaru" TEXT,
    "ukuranMeterBaru" "UkuranMeter",
    "tarifBaru" "GolonganTarif",
    "koordinatMutasi" geometry(Point, 4326),
    "ruteBaru" TEXT,
    "kodeWilayahBaru" TEXT,
    "noUrut" INTEGER,
    "jumlahPenghuni" INTEGER,
    "tanggalAktif" TIMESTAMP(3),
    "statusAktif" INTEGER,
    "prosesOlehId" TEXT,
    "updaterKode" TEXT,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mutasi_pelanggan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pemutusan" (
    "id" TEXT NOT NULL,
    "pelangganId" TEXT,
    "kelurahanId" TEXT,
    "kecamatanId" TEXT,
    "nomorLangganan" TEXT,
    "namaPelanggan" TEXT,
    "jenis" "JenisPemutusan" NOT NULL,
    "periode" INTEGER NOT NULL,
    "nomorSurat" TEXT,
    "tanggalPermohonan" TIMESTAMP(3),
    "nomorSPT" TEXT,
    "tanggalSPT" TIMESTAMP(3),
    "tanggalTutup" TIMESTAMP(3),
    "tanggalCabut" TIMESTAMP(3),
    "sumberData" TEXT NOT NULL DEFAULT 'RNOMOR_CSV',
    "sumberKey" TEXT,
    "kodeSurvei" TEXT,
    "koordinatVerifikasi" geometry(Point, 4326),
    "catatanSurveiAsli" TEXT,
    "prosesOlehId" TEXT,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pemutusan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "potensi_pelanggan" (
    "id" TEXT NOT NULL,
    "alamat" TEXT NOT NULL,
    "koordinat" geometry(Point, 4326),
    "status" "StatusPotensi" NOT NULL DEFAULT 'PROSPEK',
    "catatan" TEXT,
    "petugasId" TEXT,
    "ruteId" TEXT,
    "kelurahanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "potensi_pelanggan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "entitasId" TEXT,
    "perubahan" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "konfigurasi" (
    "id" TEXT NOT NULL,
    "kunci" TEXT NOT NULL,
    "nilai" TEXT NOT NULL,
    "deskripsi" TEXT,
    "tipe" TEXT NOT NULL DEFAULT 'string',
    "isRahasia" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "konfigurasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "divisi" (
    "id" TEXT NOT NULL,
    "kode" "KodeDivisi" NOT NULL,
    "nama" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "divisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bagian" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "levelKepala" "Role" NOT NULL DEFAULT 'SENIOR_MANAGER',
    "divisiId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bagian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_bagian" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "bagianId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_bagian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pencatat" (
    "id" TEXT NOT NULL,
    "namaLapangan" TEXT NOT NULL,
    "namaLengkap" TEXT,
    "nip" TEXT,
    "aliasLain" TEXT,
    "userId" TEXT,
    "isAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pencatat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_kinerja" (
    "id" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER,
    "targetKubikasi" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "targetSambunganBaru" INTEGER NOT NULL DEFAULT 0,
    "seksiCaterId" TEXT,
    "wilayahDistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "target_kinerja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilayah_adm" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "area" geometry(MultiPolygon, 4326),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wilayah_adm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilayah_dist" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "area" geometry(MultiPolygon, 4326),
    "wilayahAdmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wilayah_dist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seksi_cater" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "area" geometry(MultiPolygon, 4326),
    "wilayahDistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seksi_cater_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilayah_seksi" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "area" geometry(MultiPolygon, 4326),
    "wilayahDistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wilayah_seksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zona" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "area" geometry(MultiPolygon, 4326),
    "wilayahSeksiId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rute" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "noUrut" INTEGER,
    "area" geometry(Geometry, 4326),
    "seksiCaterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dma" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kecamatan" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "area" geometry(MultiPolygon, 4326),

    CONSTRAINT "kecamatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kelurahan" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kecamatanId" TEXT NOT NULL,
    "area" geometry(MultiPolygon, 4326),

    CONSTRAINT "kelurahan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarif_golongan" (
    "id" TEXT NOT NULL,
    "kode" "GolonganTarif" NOT NULL,
    "kodeAsli" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarif_golongan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarif_blok" (
    "id" TEXT NOT NULL,
    "tarifGolonganId" TEXT NOT NULL,
    "blok" INTEGER NOT NULL,
    "batasAwalM3" INTEGER NOT NULL,
    "batasAkhirM3" INTEGER,
    "hargaPerM3" INTEGER NOT NULL,
    "berlakuMulai" TIMESTAMP(3) NOT NULL,
    "berlakuSampai" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarif_blok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "golongan_besar" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "golongan_besar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pelanggan" (
    "id" TEXT NOT NULL,
    "nomorLangganan" CHAR(11) NOT NULL,
    "nomorPersil" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "alamat" TEXT NOT NULL,
    "rt" VARCHAR(3),
    "rw" VARCHAR(3),
    "notelp" TEXT,
    "jumlahPenghuni" INTEGER,
    "geoLat" DOUBLE PRECISION,
    "geoLong" DOUBLE PRECISION,
    "koordinat" geometry(Point, 4326),
    "statusPasokanAir" "StatusPasokanAir",
    "jamGilirMulai" TIME,
    "jamGilirSelesai" TIME,
    "polaGilir" TEXT,
    "status" "StatusPelanggan" NOT NULL DEFAULT 'AKTIF',
    "isMBR" BOOLEAN NOT NULL DEFAULT false,
    "kodeMBR" TEXT,
    "objekBayar" "ObjekBayar",
    "golonganBesarId" TEXT,
    "dmaId" TEXT,
    "tarifGolonganId" TEXT,
    "seksiCaterId" TEXT,
    "ruteId" TEXT,
    "zonaId" TEXT,
    "kecamatanId" TEXT,
    "kelurahanId" TEXT,
    "authorId" TEXT,
    "lastEditorId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pelanggan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter" (
    "id" TEXT NOT NULL,
    "nomorMeter" TEXT NOT NULL,
    "nomorSegel" TEXT,
    "merkKode" TEXT,
    "ukuran" "UkuranMeter" NOT NULL DEFAULT 'INCH_HALF',
    "tanggalPasang" TIMESTAMP(3),
    "umurTahun" INTEGER,
    "umurBulan" INTEGER,
    "umurHari" INTEGER,
    "isAktif" BOOLEAN NOT NULL DEFAULT true,
    "catatan" TEXT,
    "pelangganId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pembacaan_meter" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "periode" TIMESTAMP(3) NOT NULL,
    "standLalu" INTEGER NOT NULL,
    "standAkhir" INTEGER NOT NULL,
    "pemakaianM3" INTEGER NOT NULL,
    "blokTarif" INTEGER NOT NULL,
    "pemakaianLalu" INTEGER,
    "blokTarifLalu" INTEGER,
    "kondisi" "KondisiCatat" NOT NULL DEFAULT 'NORMAL',
    "kategori" "KategoriPembacaan" NOT NULL DEFAULT 'ONSITE',
    "pencatatId" TEXT,
    "tanggalCatat" TIMESTAMP(3),
    "fotoBukti" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pembacaan_meter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tagihan" (
    "id" TEXT NOT NULL,
    "nomorTagihan" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "pembacaanId" TEXT,
    "periode" TIMESTAMP(3) NOT NULL,
    "pemakaianM3" INTEGER NOT NULL,
    "jmlHargaAir" INTEGER NOT NULL,
    "beaBeban" INTEGER NOT NULL DEFAULT 7000,
    "beaAdmin" INTEGER NOT NULL DEFAULT 10000,
    "airKotor" INTEGER NOT NULL DEFAULT 11100,
    "lainLain" INTEGER NOT NULL DEFAULT 0,
    "denda" INTEGER NOT NULL DEFAULT 0,
    "totalTagihan" INTEGER NOT NULL,
    "jumlahRekTunggak" INTEGER,
    "nominalTunggak" BIGINT,
    "status" "StatusTagihan" NOT NULL DEFAULT 'BELUM_BAYAR',
    "tanggalJatuhTempo" TIMESTAMP(3) NOT NULL,
    "tanggalBayar" TIMESTAMP(3),
    "validatorId" TEXT,
    "validasiAt" TIMESTAMP(3),
    "catatanValidasi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tagihan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tagihan_lain" (
    "id" TEXT NOT NULL,
    "nomorTagihan" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "jenis" "JenisTagihanLain" NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "status" "StatusTagihan" NOT NULL DEFAULT 'BELUM_BAYAR',
    "tanggalJatuhTempo" TIMESTAMP(3) NOT NULL,
    "tanggalBayar" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tagihan_lain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_pembayaran" (
    "id" TEXT NOT NULL,
    "tagihanId" TEXT,
    "tagihanLainId" TEXT,
    "jumlahBayar" INTEGER NOT NULL,
    "kanal" "KanalPembayaran" NOT NULL,
    "penyelenggara" TEXT,
    "kodeReferensi" TEXT NOT NULL,
    "status" "StatusPembayaran" NOT NULL DEFAULT 'PENDING',
    "waktuBayar" TIMESTAMP(3),
    "waktuKonfirmasi" TIMESTAMP(3),
    "payloadCallback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_pembayaran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_username_idx" ON "user"("username");

-- CreateIndex
CREATE INDEX "user_role_status_idx" ON "user"("role", "status");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_provider_providerAccountId_key" ON "account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "session_sessionToken_key" ON "session"("sessionToken");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_token_identifier_token_key" ON "verification_token"("identifier", "token");

-- CreateIndex
CREATE INDEX "two_factor_userId_idx" ON "two_factor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "pengaduan_nomorTiket_key" ON "pengaduan"("nomorTiket");

-- CreateIndex
CREATE INDEX "pengaduan_pelangganId_idx" ON "pengaduan"("pelangganId");

-- CreateIndex
CREATE INDEX "pengaduan_nomorLangganan_idx" ON "pengaduan"("nomorLangganan");

-- CreateIndex
CREATE INDEX "pengaduan_jenis_status_idx" ON "pengaduan"("jenis", "status");

-- CreateIndex
CREATE INDEX "pengaduan_status_prioritas_idx" ON "pengaduan"("status", "prioritas");

-- CreateIndex
CREATE INDEX "pengaduan_createdAt_idx" ON "pengaduan"("createdAt");

-- CreateIndex
CREATE INDEX "pengaduan_koordinat_gist_idx" ON "pengaduan" USING GIST ("koordinat");

-- CreateIndex
CREATE UNIQUE INDEX "laporan_harian_petugas_pembacaanId_key" ON "laporan_harian_petugas"("pembacaanId");

-- CreateIndex
CREATE INDEX "laporan_harian_petugas_nomorLangganan_idx" ON "laporan_harian_petugas"("nomorLangganan");

-- CreateIndex
CREATE INDEX "laporan_harian_petugas_pelangganId_idx" ON "laporan_harian_petugas"("pelangganId");

-- CreateIndex
CREATE INDEX "laporan_harian_petugas_pencatatId_idx" ON "laporan_harian_petugas"("pencatatId");

-- CreateIndex
CREATE INDEX "laporan_harian_petugas_periode_idx" ON "laporan_harian_petugas"("periode");

-- CreateIndex
CREATE INDEX "laporan_harian_petugas_isVerified_idx" ON "laporan_harian_petugas"("isVerified");

-- CreateIndex
CREATE INDEX "laporan_harian_petugas_tanggalCatat_idx" ON "laporan_harian_petugas"("tanggalCatat");

-- CreateIndex
CREATE UNIQUE INDEX "laporan_harian_petugas_nomorLangganan_periode_key" ON "laporan_harian_petugas"("nomorLangganan", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "laporan_mandiri_pembacaanId_key" ON "laporan_mandiri"("pembacaanId");

-- CreateIndex
CREATE INDEX "laporan_mandiri_pelangganId_idx" ON "laporan_mandiri"("pelangganId");

-- CreateIndex
CREATE INDEX "laporan_mandiri_nomorLangganan_idx" ON "laporan_mandiri"("nomorLangganan");

-- CreateIndex
CREATE INDEX "laporan_mandiri_periode_idx" ON "laporan_mandiri"("periode");

-- CreateIndex
CREATE INDEX "laporan_mandiri_status_idx" ON "laporan_mandiri"("status");

-- CreateIndex
CREATE UNIQUE INDEX "laporan_mandiri_pelangganId_periode_key" ON "laporan_mandiri"("pelangganId", "periode");

-- CreateIndex
CREATE INDEX "mutasi_pelanggan_pelangganId_idx" ON "mutasi_pelanggan"("pelangganId");

-- CreateIndex
CREATE INDEX "mutasi_pelanggan_jenis_periode_idx" ON "mutasi_pelanggan"("jenis", "periode");

-- CreateIndex
CREATE INDEX "mutasi_pelanggan_createdAt_idx" ON "mutasi_pelanggan"("createdAt");

-- CreateIndex
CREATE INDEX "mutasi_koordinat_gist_idx" ON "mutasi_pelanggan" USING GIST ("koordinatMutasi");

-- CreateIndex
CREATE UNIQUE INDEX "mutasi_pelanggan_pelangganId_periode_jenis_key" ON "mutasi_pelanggan"("pelangganId", "periode", "jenis");

-- CreateIndex
CREATE UNIQUE INDEX "pemutusan_sumberKey_key" ON "pemutusan"("sumberKey");

-- CreateIndex
CREATE UNIQUE INDEX "pemutusan_kodeSurvei_key" ON "pemutusan"("kodeSurvei");

-- CreateIndex
CREATE INDEX "pemutusan_pelangganId_idx" ON "pemutusan"("pelangganId");

-- CreateIndex
CREATE INDEX "pemutusan_kelurahanId_idx" ON "pemutusan"("kelurahanId");

-- CreateIndex
CREATE INDEX "pemutusan_kecamatanId_idx" ON "pemutusan"("kecamatanId");

-- CreateIndex
CREATE INDEX "pemutusan_nomorLangganan_idx" ON "pemutusan"("nomorLangganan");

-- CreateIndex
CREATE INDEX "pemutusan_jenis_periode_idx" ON "pemutusan"("jenis", "periode");

-- CreateIndex
CREATE INDEX "pemutusan_tanggalCabut_idx" ON "pemutusan"("tanggalCabut");

-- CreateIndex
CREATE INDEX "pemutusan_tanggalTutup_idx" ON "pemutusan"("tanggalTutup");

-- CreateIndex
CREATE INDEX "pemutusan_sumberData_idx" ON "pemutusan"("sumberData");

-- CreateIndex
CREATE INDEX "pemutusan_koordinat_gist_idx" ON "pemutusan" USING GIST ("koordinatVerifikasi");

-- CreateIndex
CREATE UNIQUE INDEX "pemutusan_pelangganId_periode_nomorSurat_key" ON "pemutusan"("pelangganId", "periode", "nomorSurat");

-- CreateIndex
CREATE INDEX "potensi_koordinat_gist_idx" ON "potensi_pelanggan" USING GIST ("koordinat");

-- CreateIndex
CREATE INDEX "potensi_pelanggan_ruteId_idx" ON "potensi_pelanggan"("ruteId");

-- CreateIndex
CREATE INDEX "potensi_pelanggan_kelurahanId_idx" ON "potensi_pelanggan"("kelurahanId");

-- CreateIndex
CREATE INDEX "potensi_pelanggan_status_idx" ON "potensi_pelanggan"("status");

-- CreateIndex
CREATE INDEX "audit_log_userId_idx" ON "audit_log"("userId");

-- CreateIndex
CREATE INDEX "audit_log_entitas_entitasId_idx" ON "audit_log"("entitas", "entitasId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "konfigurasi_kunci_key" ON "konfigurasi"("kunci");

-- CreateIndex
CREATE UNIQUE INDEX "divisi_kode_key" ON "divisi"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "divisi_nama_key" ON "divisi"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "bagian_kode_key" ON "bagian"("kode");

-- CreateIndex
CREATE INDEX "bagian_divisiId_idx" ON "bagian"("divisiId");

-- CreateIndex
CREATE UNIQUE INDEX "sub_bagian_kode_key" ON "sub_bagian"("kode");

-- CreateIndex
CREATE INDEX "sub_bagian_bagianId_idx" ON "sub_bagian"("bagianId");

-- CreateIndex
CREATE UNIQUE INDEX "pencatat_namaLapangan_key" ON "pencatat"("namaLapangan");

-- CreateIndex
CREATE UNIQUE INDEX "pencatat_userId_key" ON "pencatat"("userId");

-- CreateIndex
CREATE INDEX "pencatat_namaLapangan_idx" ON "pencatat"("namaLapangan");

-- CreateIndex
CREATE INDEX "target_kinerja_tahun_bulan_idx" ON "target_kinerja"("tahun", "bulan");

-- CreateIndex
CREATE INDEX "target_kinerja_seksiCaterId_idx" ON "target_kinerja"("seksiCaterId");

-- CreateIndex
CREATE INDEX "target_kinerja_wilayahDistId_idx" ON "target_kinerja"("wilayahDistId");

-- CreateIndex
CREATE UNIQUE INDEX "wilayah_adm_kode_key" ON "wilayah_adm"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "wilayah_adm_nama_key" ON "wilayah_adm"("nama");

-- CreateIndex
CREATE INDEX "wilayah_adm_area_gist_idx" ON "wilayah_adm" USING GIST ("area");

-- CreateIndex
CREATE UNIQUE INDEX "wilayah_dist_kode_key" ON "wilayah_dist"("kode");

-- CreateIndex
CREATE INDEX "wilayah_dist_wilayahAdmId_idx" ON "wilayah_dist"("wilayahAdmId");

-- CreateIndex
CREATE INDEX "wilayah_dist_area_gist_idx" ON "wilayah_dist" USING GIST ("area");

-- CreateIndex
CREATE UNIQUE INDEX "seksi_cater_kode_key" ON "seksi_cater"("kode");

-- CreateIndex
CREATE INDEX "seksi_cater_wilayahDistId_idx" ON "seksi_cater"("wilayahDistId");

-- CreateIndex
CREATE INDEX "seksi_cater_area_gist_idx" ON "seksi_cater" USING GIST ("area");

-- CreateIndex
CREATE UNIQUE INDEX "wilayah_seksi_kode_key" ON "wilayah_seksi"("kode");

-- CreateIndex
CREATE INDEX "wilayah_seksi_wilayahDistId_idx" ON "wilayah_seksi"("wilayahDistId");

-- CreateIndex
CREATE INDEX "wilayah_seksi_area_gist_idx" ON "wilayah_seksi" USING GIST ("area");

-- CreateIndex
CREATE UNIQUE INDEX "zona_kode_key" ON "zona"("kode");

-- CreateIndex
CREATE INDEX "zona_wilayahSeksiId_idx" ON "zona"("wilayahSeksiId");

-- CreateIndex
CREATE INDEX "zona_area_gist_idx" ON "zona" USING GIST ("area");

-- CreateIndex
CREATE UNIQUE INDEX "rute_kode_key" ON "rute"("kode");

-- CreateIndex
CREATE INDEX "rute_seksiCaterId_idx" ON "rute"("seksiCaterId");

-- CreateIndex
CREATE INDEX "rute_area_gist_idx" ON "rute" USING GIST ("area");

-- CreateIndex
CREATE UNIQUE INDEX "dma_kode_key" ON "dma"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "kecamatan_kode_key" ON "kecamatan"("kode");

-- CreateIndex
CREATE INDEX "kecamatan_area_gist_idx" ON "kecamatan" USING GIST ("area");

-- CreateIndex
CREATE UNIQUE INDEX "kelurahan_kode_key" ON "kelurahan"("kode");

-- CreateIndex
CREATE INDEX "kelurahan_kecamatanId_idx" ON "kelurahan"("kecamatanId");

-- CreateIndex
CREATE INDEX "kelurahan_area_gist_idx" ON "kelurahan" USING GIST ("area");

-- CreateIndex
CREATE UNIQUE INDEX "tarif_golongan_kode_key" ON "tarif_golongan"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "tarif_golongan_kodeAsli_key" ON "tarif_golongan"("kodeAsli");

-- CreateIndex
CREATE INDEX "tarif_blok_tarifGolonganId_idx" ON "tarif_blok"("tarifGolonganId");

-- CreateIndex
CREATE UNIQUE INDEX "tarif_blok_tarifGolonganId_blok_berlakuMulai_key" ON "tarif_blok"("tarifGolonganId", "blok", "berlakuMulai");

-- CreateIndex
CREATE UNIQUE INDEX "golongan_besar_kode_key" ON "golongan_besar"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "pelanggan_nomorLangganan_key" ON "pelanggan"("nomorLangganan");

-- CreateIndex
CREATE INDEX "pelanggan_koordinat_gist_idx" ON "pelanggan" USING GIST ("koordinat");

-- CreateIndex
CREATE INDEX "pelanggan_nama_idx" ON "pelanggan"("nama");

-- CreateIndex
CREATE INDEX "pelanggan_nomorPersil_idx" ON "pelanggan"("nomorPersil");

-- CreateIndex
CREATE INDEX "pelanggan_status_deletedAt_idx" ON "pelanggan"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "pelanggan_ruteId_deletedAt_idx" ON "pelanggan"("ruteId", "deletedAt");

-- CreateIndex
CREATE INDEX "pelanggan_seksiCaterId_deletedAt_idx" ON "pelanggan"("seksiCaterId", "deletedAt");

-- CreateIndex
CREATE INDEX "pelanggan_zonaId_deletedAt_idx" ON "pelanggan"("zonaId", "deletedAt");

-- CreateIndex
CREATE INDEX "pelanggan_tarifGolonganId_deletedAt_idx" ON "pelanggan"("tarifGolonganId", "deletedAt");

-- CreateIndex
CREATE INDEX "pelanggan_golonganBesarId_idx" ON "pelanggan"("golonganBesarId");

-- CreateIndex
CREATE INDEX "pelanggan_dmaId_idx" ON "pelanggan"("dmaId");

-- CreateIndex
CREATE INDEX "meter_nomorMeter_idx" ON "meter"("nomorMeter");

-- CreateIndex
CREATE INDEX "meter_pelangganId_isAktif_idx" ON "meter"("pelangganId", "isAktif");

-- CreateIndex
CREATE INDEX "meter_merkKode_idx" ON "meter"("merkKode");

-- CreateIndex
CREATE INDEX "pembacaan_meter_meterId_idx" ON "pembacaan_meter"("meterId");

-- CreateIndex
CREATE INDEX "pembacaan_meter_periode_idx" ON "pembacaan_meter"("periode");

-- CreateIndex
CREATE INDEX "pembacaan_meter_kondisi_idx" ON "pembacaan_meter"("kondisi");

-- CreateIndex
CREATE UNIQUE INDEX "pembacaan_meter_meterId_periode_key" ON "pembacaan_meter"("meterId", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "tagihan_nomorTagihan_key" ON "tagihan"("nomorTagihan");

-- CreateIndex
CREATE UNIQUE INDEX "tagihan_pembacaanId_key" ON "tagihan"("pembacaanId");

-- CreateIndex
CREATE INDEX "tagihan_pelangganId_periode_idx" ON "tagihan"("pelangganId", "periode");

-- CreateIndex
CREATE INDEX "tagihan_status_tanggalJatuhTempo_idx" ON "tagihan"("status", "tanggalJatuhTempo");

-- CreateIndex
CREATE INDEX "tagihan_periode_idx" ON "tagihan"("periode");

-- CreateIndex
CREATE INDEX "tagihan_nominalTunggak_idx" ON "tagihan"("nominalTunggak");

-- CreateIndex
CREATE UNIQUE INDEX "tagihan_lain_nomorTagihan_key" ON "tagihan_lain"("nomorTagihan");

-- CreateIndex
CREATE INDEX "tagihan_lain_pelangganId_status_idx" ON "tagihan_lain"("pelangganId", "status");

-- CreateIndex
CREATE INDEX "tagihan_lain_jenis_idx" ON "tagihan_lain"("jenis");

-- CreateIndex
CREATE UNIQUE INDEX "riwayat_pembayaran_kodeReferensi_key" ON "riwayat_pembayaran"("kodeReferensi");

-- CreateIndex
CREATE INDEX "riwayat_pembayaran_tagihanId_idx" ON "riwayat_pembayaran"("tagihanId");

-- CreateIndex
CREATE INDEX "riwayat_pembayaran_tagihanLainId_idx" ON "riwayat_pembayaran"("tagihanLainId");

-- CreateIndex
CREATE INDEX "riwayat_pembayaran_status_idx" ON "riwayat_pembayaran"("status");

-- CreateIndex
CREATE INDEX "riwayat_pembayaran_kanal_idx" ON "riwayat_pembayaran"("kanal");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_divisiId_fkey" FOREIGN KEY ("divisiId") REFERENCES "divisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_bagianId_fkey" FOREIGN KEY ("bagianId") REFERENCES "bagian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_subBagianId_fkey" FOREIGN KEY ("subBagianId") REFERENCES "sub_bagian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengaduan" ADD CONSTRAINT "pengaduan_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengaduan" ADD CONSTRAINT "pengaduan_ditugaskanKeId_fkey" FOREIGN KEY ("ditugaskanKeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_harian_petugas" ADD CONSTRAINT "laporan_harian_petugas_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_harian_petugas" ADD CONSTRAINT "laporan_harian_petugas_pembacaanId_fkey" FOREIGN KEY ("pembacaanId") REFERENCES "pembacaan_meter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_harian_petugas" ADD CONSTRAINT "laporan_harian_petugas_pencatatId_fkey" FOREIGN KEY ("pencatatId") REFERENCES "pencatat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_harian_petugas" ADD CONSTRAINT "laporan_harian_petugas_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_mandiri" ADD CONSTRAINT "laporan_mandiri_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_mandiri" ADD CONSTRAINT "laporan_mandiri_pembacaanId_fkey" FOREIGN KEY ("pembacaanId") REFERENCES "pembacaan_meter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_mandiri" ADD CONSTRAINT "laporan_mandiri_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutasi_pelanggan" ADD CONSTRAINT "mutasi_pelanggan_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutasi_pelanggan" ADD CONSTRAINT "mutasi_pelanggan_prosesOlehId_fkey" FOREIGN KEY ("prosesOlehId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pemutusan" ADD CONSTRAINT "pemutusan_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pemutusan" ADD CONSTRAINT "pemutusan_kelurahanId_fkey" FOREIGN KEY ("kelurahanId") REFERENCES "kelurahan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pemutusan" ADD CONSTRAINT "pemutusan_kecamatanId_fkey" FOREIGN KEY ("kecamatanId") REFERENCES "kecamatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pemutusan" ADD CONSTRAINT "pemutusan_prosesOlehId_fkey" FOREIGN KEY ("prosesOlehId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potensi_pelanggan" ADD CONSTRAINT "potensi_pelanggan_ruteId_fkey" FOREIGN KEY ("ruteId") REFERENCES "rute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potensi_pelanggan" ADD CONSTRAINT "potensi_pelanggan_kelurahanId_fkey" FOREIGN KEY ("kelurahanId") REFERENCES "kelurahan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bagian" ADD CONSTRAINT "bagian_divisiId_fkey" FOREIGN KEY ("divisiId") REFERENCES "divisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_bagian" ADD CONSTRAINT "sub_bagian_bagianId_fkey" FOREIGN KEY ("bagianId") REFERENCES "bagian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pencatat" ADD CONSTRAINT "pencatat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_kinerja" ADD CONSTRAINT "target_kinerja_seksiCaterId_fkey" FOREIGN KEY ("seksiCaterId") REFERENCES "seksi_cater"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_kinerja" ADD CONSTRAINT "target_kinerja_wilayahDistId_fkey" FOREIGN KEY ("wilayahDistId") REFERENCES "wilayah_dist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wilayah_dist" ADD CONSTRAINT "wilayah_dist_wilayahAdmId_fkey" FOREIGN KEY ("wilayahAdmId") REFERENCES "wilayah_adm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seksi_cater" ADD CONSTRAINT "seksi_cater_wilayahDistId_fkey" FOREIGN KEY ("wilayahDistId") REFERENCES "wilayah_dist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wilayah_seksi" ADD CONSTRAINT "wilayah_seksi_wilayahDistId_fkey" FOREIGN KEY ("wilayahDistId") REFERENCES "wilayah_dist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zona" ADD CONSTRAINT "zona_wilayahSeksiId_fkey" FOREIGN KEY ("wilayahSeksiId") REFERENCES "wilayah_seksi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rute" ADD CONSTRAINT "rute_seksiCaterId_fkey" FOREIGN KEY ("seksiCaterId") REFERENCES "seksi_cater"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kelurahan" ADD CONSTRAINT "kelurahan_kecamatanId_fkey" FOREIGN KEY ("kecamatanId") REFERENCES "kecamatan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarif_blok" ADD CONSTRAINT "tarif_blok_tarifGolonganId_fkey" FOREIGN KEY ("tarifGolonganId") REFERENCES "tarif_golongan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelanggan" ADD CONSTRAINT "pelanggan_tarifGolonganId_fkey" FOREIGN KEY ("tarifGolonganId") REFERENCES "tarif_golongan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelanggan" ADD CONSTRAINT "pelanggan_golonganBesarId_fkey" FOREIGN KEY ("golonganBesarId") REFERENCES "golongan_besar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelanggan" ADD CONSTRAINT "pelanggan_dmaId_fkey" FOREIGN KEY ("dmaId") REFERENCES "dma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelanggan" ADD CONSTRAINT "pelanggan_seksiCaterId_fkey" FOREIGN KEY ("seksiCaterId") REFERENCES "seksi_cater"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelanggan" ADD CONSTRAINT "pelanggan_ruteId_fkey" FOREIGN KEY ("ruteId") REFERENCES "rute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelanggan" ADD CONSTRAINT "pelanggan_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelanggan" ADD CONSTRAINT "pelanggan_kecamatanId_fkey" FOREIGN KEY ("kecamatanId") REFERENCES "kecamatan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelanggan" ADD CONSTRAINT "pelanggan_kelurahanId_fkey" FOREIGN KEY ("kelurahanId") REFERENCES "kelurahan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelanggan" ADD CONSTRAINT "pelanggan_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelanggan" ADD CONSTRAINT "pelanggan_lastEditorId_fkey" FOREIGN KEY ("lastEditorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter" ADD CONSTRAINT "meter_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembacaan_meter" ADD CONSTRAINT "pembacaan_meter_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembacaan_meter" ADD CONSTRAINT "pembacaan_meter_pencatatId_fkey" FOREIGN KEY ("pencatatId") REFERENCES "pencatat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tagihan" ADD CONSTRAINT "tagihan_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tagihan" ADD CONSTRAINT "tagihan_pembacaanId_fkey" FOREIGN KEY ("pembacaanId") REFERENCES "pembacaan_meter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tagihan" ADD CONSTRAINT "tagihan_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tagihan_lain" ADD CONSTRAINT "tagihan_lain_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_pembayaran" ADD CONSTRAINT "riwayat_pembayaran_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "tagihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_pembayaran" ADD CONSTRAINT "riwayat_pembayaran_tagihanLainId_fkey" FOREIGN KEY ("tagihanLainId") REFERENCES "tagihan_lain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
