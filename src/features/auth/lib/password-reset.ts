import "server-only"

// features/auth/lib/password-reset.ts — siklus hidup token reset password.
//
// KENAPA MEMAKAI MODEL VerificationToken (bukan model baru): bentuknya sudah
// persis yang dibutuhkan (identifier + token + expires + unique gabungan),
// dan tabel itu MENGANGGUR — tabel ini milik provider Email bawaan Auth.js
// yang tidak dipakai proyek ini (login lewat Google + Credentials saja).
// Menambah model baru berarti migrasi baru, sementara `prisma migrate` di
// repo ini sengaja dijadikan tindakan manusia yang disengaja (lihat
// prisma/README.md) — jadi menumpang tabel yang sudah ada adalah pilihan
// yang benar di sini, bukan jalan pintas.
//
// KEAMANAN — tiga hal yang ditegakkan di file ini:
//  1. Token DISIMPAN SEBAGAI HASH (SHA-256), bukan teks asli. Yang dikirim
//     ke email adalah token asli; database hanya menyimpan sidik jarinya.
//     Kalau isi tabel bocor, token di dalamnya tidak bisa dipakai mereset
//     password siapa pun.
//  2. SEKALI PAKAI. Token dihapus di transaksi yang sama dengan penggantian
//     password, jadi tautan yang sama tidak bisa dipakai dua kali.
//  3. KEDALUWARSA 1 jam, dan token lama pengguna yang sama dihapus setiap
//     kali permintaan baru dibuat (hanya tautan terakhir yang berlaku).
//
// SHA-256 (bukan bcrypt) sudah tepat untuk token: nilainya 256-bit acak
// murni dari CSPRNG, bukan password buatan manusia — tidak ada yang bisa
// ditebak lewat brute force/kamus, sehingga key-stretching bcrypt tidak
// memberi manfaat apa pun di sini dan hanya memperlambat verifikasi.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { prisma } from "@/lib/prisma"

// Di-re-export supaya modul auth cukup mengimpor dari satu tempat. Aturan
// hashing-nya sendiri (argon2id + parameternya) hanya ada di lib/password.ts.
export { hashPassword } from "./password"

const MASA_BERLAKU_MENIT = 60

/// Prefix pada `identifier` supaya token reset tidak pernah tertukar dengan
/// token verifikasi email seandainya provider Email diaktifkan kelak.
const PREFIX = "reset:"

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function identifierUntuk(email: string): string {
  return `${PREFIX}${email.toLowerCase()}`
}

/** Membuat token baru. Mengembalikan token ASLI (untuk dikirim via email) —
 *  yang tersimpan di database hanyalah hash-nya. */
export async function buatTokenReset(email: string): Promise<{ token: string; kedaluwarsa: Date }> {
  const identifier = identifierUntuk(email)
  const token = randomBytes(32).toString("hex")
  const kedaluwarsa = new Date(Date.now() + MASA_BERLAKU_MENIT * 60 * 1000)

  // Hanya tautan terakhir yang boleh berlaku.
  await prisma.verificationToken.deleteMany({ where: { identifier } })
  await prisma.verificationToken.create({
    data: { identifier, token: hashToken(token), expires: kedaluwarsa },
  })

  return { token, kedaluwarsa }
}

/** true bila token cocok, milik email tsb, dan belum kedaluwarsa. */
export async function tokenResetValid(email: string, token: string): Promise<boolean> {
  const identifier = identifierUntuk(email)
  const baris = await prisma.verificationToken.findFirst({ where: { identifier } })
  if (!baris) return false
  if (baris.expires.getTime() < Date.now()) return false

  // Perbandingan waktu-tetap. Perbandingan string biasa berhenti di byte
  // pertama yang beda, dan selisih waktunya bisa dipakai menebak token
  // karakter demi karakter.
  const a = Buffer.from(baris.token, "utf8")
  const b = Buffer.from(hashToken(token), "utf8")
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Menukar token dengan password baru. Token dihapus di transaksi yang sama
 *  supaya tidak mungkin dipakai ulang, bahkan pada dua permintaan bersamaan. */
export async function pakaiTokenReset(email: string, token: string, passwordHash: string): Promise<boolean> {
  if (!(await tokenResetValid(email, token))) return false

  const identifier = identifierUntuk(email)
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) return false

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } })
    await tx.verificationToken.deleteMany({ where: { identifier } })
  })

  return true
}
