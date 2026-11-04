import "dotenv/config"
import { prisma } from "../index"

async function main() {
  console.log("Menjalankan penyesuaian skema kolom identitas user...")

  // 1. Buat enum JenisAkun jika belum ada
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JenisAkun') THEN
        CREATE TYPE "JenisAkun" AS ENUM ('PETUGAS', 'PELANGGAN');
      END IF;
    END$$;
  `)
  console.log("✓ Enum JenisAkun siap")

  // 2. Tambah kolom ke tabel user jika belum ada
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "user" 
    ADD COLUMN IF NOT EXISTS "jenisAkun" "JenisAkun" NOT NULL DEFAULT 'PETUGAS',
    ADD COLUMN IF NOT EXISTS "nik" TEXT,
    ADD COLUMN IF NOT EXISTS "nip" TEXT,
    ADD COLUMN IF NOT EXISTS "nomorPelanggan" TEXT,
    ADD COLUMN IF NOT EXISTS "jabatan" TEXT,
    ADD COLUMN IF NOT EXISTS "telepon" TEXT;
  `)
  console.log("✓ Kolom identitas ditambahkan ke tabel user")

  // 3. Buat indeks unik
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_nik_key" ON "user"("nik");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_nip_key" ON "user"("nip");
  `)
  console.log("✓ Indeks unik nik & nip siap")

  console.log("Semua perubahan skema database berhasil diterapkan!")
}

main()
  .catch((e) => {
    console.error("Gagal menjalankan migrasi:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
