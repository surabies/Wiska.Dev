// PrismaClient untuk skrip seed menggunakan adapter PostgreSQL yang sama
// dengan aplikasi.
//
// CATATAN PENTING: import PrismaClient dari alias "@generated",
// yaitu output hasil generate (folder `generated/client` memang nama
// foldernya — di dalamnya ada package.json sendiri), BUKAN dari subpath
// "/client"-nya. Sudah diverifikasi: import lewat subpath "/client"
// (re-export "export * from
// './index'") membuat TypeScript GAGAL meng-infer generic ClientOptions
// dengan benar — 33 dari 37 getter model (semua KECUALI user/account/
// session/spatial_ref_sys) hilang dari tipe hasil ("Property 'x' does not
// exist on type PrismaClient<never, ...>"), walau constructor dipanggil
// benar dengan `{ adapter }`. Import dari root package tidak kena masalah
// ini sama sekali.
// Dijalankan lewat `tsx` langsung (pnpm db:seed), bukan lewat `prisma`
// CLI — tsx TIDAK auto-load .env seperti prisma.config.ts, jadi tanpa
// baris ini DATABASE_URL bakal undefined dan error koneksi menjadi
// menyesatkan alih-alih "env var tidak ada".
//
// Seed bisa dijalankan dari direktori mana pun, jadi .env root dimuat
// berdasarkan lokasi file ini, bukan cwd.
import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"
import { PrismaClient } from "@generated"
import { PrismaPg } from "@prisma/adapter-pg"

loadEnv({ path: resolve(__dirname, "../../../.env") })
loadEnv()

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL tidak ditemukan di environment — cek file .env di root project.",
  )
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

export const prisma = new PrismaClient({ adapter })

export type PrismaClientLike = typeof prisma
