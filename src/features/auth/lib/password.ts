import "server-only"

// lib/password.ts — SATU-SATUNYA tempat password di-hash & diverifikasi.
// Dipakai lintas lapisan: auth.ts (login), features/auth (reset password),
// server/modules/user (admin membuat/mereset akun), prisma/seed (bootstrap
// admin). Jangan memanggil pustaka hashing langsung dari tempat lain —
// kalau parameternya perlu dinaikkan suatu hari, cukup ubah file ini.
//
// KENAPA argon2id, BUKAN bcrypt:
//  - Auth.js TIDAK menyediakan hashing password sama sekali (sudah
//    diperiksa: @auth/core & next-auth nol hasil untuk bcrypt/argon2/scrypt;
//    dependensinya hanya jose, oauth4webapi, hkdf, preact). Provider
//    Credentials menyerahkan verifikasi sepenuhnya ke aplikasi, jadi tidak
//    ada "standar Auth.js" yang harus diikuti — pilihan ini murni milik kita.
//  - argon2id memenangkan Password Hashing Competition dan jadi rekomendasi
//    utama OWASP. Berbeda dari bcrypt, ia juga mahal di MEMORI (bukan cuma
//    CPU), sehingga jauh lebih tahan terhadap serangan GPU/ASIC.
//  - bcrypt DIAM-DIAM MEMOTONG password di 72 byte. Sudah diverifikasi:
//    argon2 di sini tidak memotong (password 200 karakter tetap utuh dan
//    tidak cocok dengan 72 karakter pertamanya).
//
// Native binary: @node-rs/argon2 memuat .node prebuilt. Sudah diuji jalan di
// Windows (dev). PASTIKAN prebuilt untuk platform server produksi (umumnya
// linux-x64-gnu) ikut ter-install saat deploy — `pnpm install` di server
// akan mengambil yang cocok. Ini konsekuensi sadar dari memilih argon2:
// bcryptjs (pure JS) tidak punya kebutuhan ini.
import { hash, verify } from "@node-rs/argon2"

/// Parameter default @node-rs/argon2 = argon2id, m=19456 KiB (19 MiB), t=2,
/// p=1 — sudah PERSIS konfigurasi rekomendasi OWASP untuk Argon2id, jadi
/// sengaja tidak dioverride. Terverifikasi: hash yang dihasilkan berawalan
/// `$argon2id$v=19$m=19456,t=2,p=1$`. Parameter ikut tersimpan di dalam
/// string hash, sehingga menaikkannya kelak TIDAK merusak password lama —
/// verify() membaca parameter dari hash masing-masing.
export async function hashPassword(password: string): Promise<string> {
  return hash(password)
}

/// false (bukan throw) untuk hash yang rusak/berformat asing. Alasannya:
/// verify() melempar exception bila string hash tidak dikenali (mis. hash
/// bcrypt lama `$2b$...`). Membiarkannya naik akan membuat login 500 alih-alih
/// "password salah", dan pesan error-nya bisa membocorkan format hash yang
/// tersimpan. Baris seperti itu memang tidak bisa login — dan itu benar.
export async function verifyPassword(hashTersimpan: string, password: string): Promise<boolean> {
  try {
    return await verify(hashTersimpan, password)
  } catch {
    return false
  }
}

/// Pembanding tiruan saat user tidak ditemukan, supaya waktu respons "email
/// tidak terdaftar" sama dengan "password salah" — tanpa ini, selisih waktunya
/// membocorkan email mana yang terdaftar (user enumeration).
///
/// WAJIB hash argon2id ASLI berparameter sama, BUKAN string karangan. Sudah
/// diukur: verify() terhadap hash asli ~21-27 ms, sedangkan terhadap string
/// yang formatnya tidak valid hanya ~0,1 ms (389x lebih cepat) karena parser
/// menolaknya seketika — persis kebocoran waktu yang mau dihilangkan.
///
/// Aman meski nilainya publik: ini hash dari 32 byte acak yang langsung
/// dibuang dan tidak pernah menjadi password siapa pun. Yang dijaga di sini
/// adalah WAKTU KOMPUTASI-nya, bukan kerahasiaan hash-nya.
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$rDzPsqtrRnlTCrDeddbVHg$knXvahtnAQJsB1iqV936gqNI8i/ccKYLP2Ja9WY8g0Y"
