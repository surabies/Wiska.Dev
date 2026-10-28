// server/lib/mobile-token.ts — token akses untuk klien non-browser
// (aplikasi mobile Flutter). Formatnya JWE Auth.js (encode/decode dari
// next-auth/jwt, secret = AUTH_SECRET) supaya tidak menambah pustaka
// ataupun format token kedua — tapi dengan SALT BERBEDA dari cookie sesi
// web ("authjs.session-token"), sehingga:
//   1. Token mobile tidak bisa dipakai sebagai cookie sesi web (dan
//      sebaliknya) — dua permukaan itu bisa dirotasi/dicabut terpisah.
//   2. verifyAuth() @hono/auth-js tetap tidak mengenalinya — jalur Bearer
//      hanya lewat middleware verifyAuthFleksibel() di bawah.
//
// Sama seperti sesi web (JWT strategy), token ini TIDAK bisa dicabut
// server-side sebelum kedaluwarsa — menonaktifkan user menutup login
// BERIKUTNYA, bukan token yang masih hidup. Karena itu umurnya dibuat
// lebih pendek dari default sesi web 30 hari.
import type { Context, MiddlewareHandler } from "hono"
import { encode, decode } from "next-auth/jwt"
import type { JWT } from "next-auth/jwt"
import { verifyAuth } from "@hono/auth-js"
import type { Role } from "@db"
import { UnauthorizedError } from "./errors"
import type { SessionUser } from "./session"

const SALT_TOKEN_MOBILE = "authjs.mobile-token"

/// 7 hari. Cukup panjang agar petugas lapangan tidak login tiap hari, cukup
/// pendek agar token yang bocor/di perangkat hilang mati sendiri dalam
/// hitungan hari (ingat: tidak ada revocation server-side).
export const UMUR_TOKEN_MOBILE_DETIK = 7 * 24 * 60 * 60

function authSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET belum diset")
  return secret
}

export async function buatTokenMobile(
  user: SessionUser,
): Promise<{ token: string; kedaluwarsa: Date }> {
  const kedaluwarsa = new Date(Date.now() + UMUR_TOKEN_MOBILE_DETIK * 1000)
  const token = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      divisiKode: user.divisiKode,
      subBagianKode: user.subBagianKode,
    },
    secret: authSecret(),
    salt: SALT_TOKEN_MOBILE,
    maxAge: UMUR_TOKEN_MOBILE_DETIK,
  })
  return { token, kedaluwarsa }
}

/// Membaca header `Authorization: Bearer <token mobile>` dan mengembalikan
/// SessionUser-nya, atau null bila header tidak ada/tidak valid/kedaluwarsa.
/// TIDAK PERNAH throw — dipakai baik oleh verifyAuthFleksibel() (yang
/// men-throw sendiri saat hasilnya null) maupun getSessionUserOpsional()
/// (server/lib/session.ts) yang justru butuh null sebagai jawaban sah
/// ("tidak login" itu valid, bukan error) di endpoint publik.
export async function sessionUserDariBearer(
  c: Context,
): Promise<SessionUser | null> {
  const otorisasi = c.req.header("authorization")
  if (!otorisasi?.startsWith("Bearer ")) return null

  let payload
  try {
    // decode() = jwtDecrypt jose: gagal dekripsi ATAU exp lewat -> throw.
    payload = await decode({
      token: otorisasi.slice(7),
      secret: authSecret(),
      salt: SALT_TOKEN_MOBILE,
    })
  } catch {
    payload = null
  }
  if (!payload?.sub) return null

  return {
    id: payload.sub,
    name: (payload.name as string | null) ?? null,
    email: (payload.email as string) ?? "",
    role: payload.role as Role,
    divisiKode: payload.divisiKode as string | null,
    subBagianKode: payload.subBagianKode as string | null,
  }
}

/// Pengganti blanket verifyAuth() di /api/v1: terima cookie sesi web ATAU
/// header `Authorization: Bearer <token mobile>`. Default-nya tetap 401 —
/// jaring pengaman "semua /api/v1 wajib auth" TIDAK berlubang, hanya
/// bertambah satu cara membuktikan identitas.
export function verifyAuthFleksibel(): MiddlewareHandler {
  const viaCookie = verifyAuth()
  return async (c, next) => {
    const otorisasi = c.req.header("authorization")
    if (!otorisasi?.startsWith("Bearer ")) return viaCookie(c, next)

    const user = await sessionUserDariBearer(c)
    if (!user)
      throw new UnauthorizedError("Token tidak valid atau sudah kedaluwarsa")

    // Bentuk persis seperti yang dipasang verifyAuth() (@hono/auth-js):
    // getSessionUser() membaca c.get("authUser").session.user. `token` di
    // sini cuma perlu "terlihat seperti" JWT bagi TypeScript — tidak ada
    // pemanggil yang membaca field JWT mentah dari jalur Bearer ini.
    c.set("authUser", {
      token: user as unknown as JWT,
      session: { user, expires: new Date().toISOString() },
    })
    await next()
  }
}
