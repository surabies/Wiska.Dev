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
import type { Context } from "hono"
import { z } from "zod"
import { prisma } from "@db"
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/password"
import { validate } from "../../lib/validate"
import { ok } from "../../lib/response"
import { UnauthorizedError } from "../../lib/errors"
import { cekRateLimit, ipKlien } from "../../lib/rate-limit"
import {
  buatTokenMobile,
  UMUR_TOKEN_MOBILE_DETIK,
} from "../../lib/mobile-token"
import type { SessionUser } from "../../lib/session"
import type { User } from "@db"

export const authMobileRouter = new Hono()

const PESAN_GAGAL = "Kombinasi identitas dan kredensial tidak dikenal"

async function balasDenganToken(c: Context, user: User) {
  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    divisiKode: user.divisiKode,
    subBagianKode: user.subBagianKode,
  }
  const { token, kedaluwarsa } = await buatTokenMobile(sessionUser)
  return ok(c, {
    tokenType: "Bearer",
    accessToken: token,
    expiresInSeconds: UMUR_TOKEN_MOBILE_DETIK,
    expiresAt: kedaluwarsa.toISOString(),
    user: sessionUser,
  })
}

const loginSchema = z.object({
  /// Email ATAU username — akun hasil bootstrap/provision Google punya
  /// username null, jadi keduanya harus diterima (alasan yang sama dengan
  /// field `identifier` pada Credentials provider di auth.ts).
  identifier: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
})

authMobileRouter.post("/login", validate("json", loginSchema), async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "mobile-login",
    maks: 10,
    jendelaMs: 15 * 60 * 1000,
  })
  const { identifier, password } = c.req.valid("json")

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier.toLowerCase() }, { username: identifier }],
    },
  })

  // Selalu verifikasi meski user/hash tidak ada — lihat catatan timing di
  // auth.ts authorize() dan lib/password.ts (DUMMY_PASSWORD_HASH).
  const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH
  const cocok = await verifyPassword(hash, password)

  if (!user || !user.passwordHash || !cocok || user.status !== "ACTIVE") {
    throw new UnauthorizedError(PESAN_GAGAL)
  }

  return balasDenganToken(c, user)
})

/// Client ID Google yang boleh menjadi `aud` idToken. Web client
/// (AUTH_GOOGLE_ID) selalu ikut; aplikasi Android/iOS punya client ID
/// SENDIRI di project Google Cloud yang sama — daftarkan lewat
/// AUTH_GOOGLE_MOBILE_IDS (dipisah koma) tanpa menyentuh kode.
function googleClientIds(): string[] {
  return [
    process.env.AUTH_GOOGLE_ID,
    ...(process.env.AUTH_GOOGLE_MOBILE_IDS ?? "").split(","),
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s)
}

const googleSchema = z.object({ idToken: z.string().min(1) })

interface GoogleTokenInfo {
  aud?: string
  email?: string
  email_verified?: string
}

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
  const { idToken } = c.req.valid("json")

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  )
  if (!res.ok) throw new UnauthorizedError(PESAN_GAGAL)
  const info = (await res.json()) as GoogleTokenInfo

  if (
    !info.email ||
    info.email_verified !== "true" ||
    !info.aud ||
    !googleClientIds().includes(info.aud)
  ) {
    throw new UnauthorizedError(PESAN_GAGAL)
  }

  // Sama seperti callbacks.signIn (auth.ts): email tak terdaftar / akun
  // non-ACTIVE ditolak dengan pesan yang tidak membedakan sebabnya.
  const user = await prisma.user.findUnique({
    where: { email: info.email.toLowerCase() },
  })
  if (!user || user.status !== "ACTIVE")
    throw new UnauthorizedError(PESAN_GAGAL)

  return balasDenganToken(c, user)
})
