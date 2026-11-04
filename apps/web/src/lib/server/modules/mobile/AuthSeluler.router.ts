// server/modules/mobile/auth-mobile.router.ts — pintu masuk aplikasi mobile
// (Flutter). Browser memakai /api/auth/* (Auth.js, cookie); aplikasi native
// tidak hidup di dunia cookie+CSRF itu, jadi di sini identitas ditukar
// menjadi Bearer token (server/lib/mobile-token.ts) yang diterima blanket
// verifyAuthFleksibel() di /api/v1.
//
// Aturan keamanan yang WAJIB dipertahankan (cermin alur web di auth.ts):
//   1. Pesan gagal SERAGAM untuk semua sebab (user tak ada / password salah
//      / akun nonaktif) — membedakannya = alat enumerasi akun.
//   2. verifyPassword selalu dijalankan meski user tidak ditemukan
//      (DUMMY_PASSWORD_HASH) — menutup kebocoran waktu respons.
//   3. Google: hanya email yang SUDAH terdaftar & ACTIVE (tidak ada
//      pendaftaran mandiri), sama seperti callbacks.signIn di auth.ts.
//   4. Rate limit per IP — endpoint ini tanpa login, satu-satunya rem
//      terhadap brute force (catatan x-forwarded-for di lib/rate-limit.ts
//      berlaku juga di sini).
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { ok } from "../../lib/Respons"
import { cekRateLimit, ipKlien } from "../../lib/PembatasLaju"
import { loginSchema, googleSchema } from "./AuthSeluler.schema"
import { loginDenganKredensial, loginDenganGoogle } from "./AuthSeluler.service"

export const authMobileRouter = new Hono()

authMobileRouter.post("/login", validate("json", loginSchema), async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "mobile-login",
    maks: 10,
    jendelaMs: 15 * 60 * 1000,
  })
  const hasil = await loginDenganKredensial(c.req.valid("json"))
  return ok(c, hasil)
})

/// Tukar idToken hasil google_sign_in (Flutter) menjadi Bearer token app
/// ini. Verifikasi diserahkan ke endpoint tokeninfo Google (signature,
/// expiry, issuer diperiksa di sana) — kita tinggal memeriksa `aud` agar
/// token untuk aplikasi lain tidak diterima, lalu memberlakukan aturan
/// akun yang sama dengan login web.
authMobileRouter.post("/google", validate("json", googleSchema), async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "mobile-login-google",
    maks: 20,
    jendelaMs: 15 * 60 * 1000,
  })
  const hasil = await loginDenganGoogle(c.req.valid("json"))
  return ok(c, hasil)
})
