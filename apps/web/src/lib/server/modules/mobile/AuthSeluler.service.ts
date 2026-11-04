// server/modules/mobile/AuthSeluler.service.ts — logika verifikasi kredensial,
// validasi idToken Google, dan penerbitan Bearer token untuk aplikasi seluler.
//
// Aturan keamanan yang WAJIB dipertahankan (cermin alur web di auth.ts):
//   1. Pesan gagal SERAGAM untuk semua sebab (user tak ada / password salah
//      / akun nonaktif) — membedakannya = alat enumerasi akun.
//   2. verifyPassword selalu dijalankan meski user tidak ditemukan
//      (DUMMY_PASSWORD_HASH) — menutup kebocoran waktu respons.
//   3. Google: hanya email yang SUDAH terdaftar & ACTIVE (tidak ada
//      pendaftaran mandiri), sama seperti callbacks.signIn di auth.ts.

import { prisma } from "@db"
import type { User } from "@db"
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/Sandi"
import { UnauthorizedError } from "../../lib/Galat"
import {
  buatTokenMobile,
  UMUR_TOKEN_MOBILE_DETIK,
} from "../../lib/SelulerToken"
import type { SessionUser } from "../../lib/Sesi"
import type { GoogleMobileInput, LoginMobileInput } from "./AuthSeluler.schema"

const PESAN_GAGAL = "Kombinasi identitas dan kredensial tidak dikenal"

async function buatResponsToken(user: User) {
  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    divisiKode: user.divisiKode,
    subBagianKode: user.subBagianKode,
    jenisAkun: user.jenisAkun,
    nik: user.nik,
    nip: user.nip,
    nomorPelanggan: user.nomorPelanggan,
    jabatan: user.jabatan,
    telepon: user.telepon,
  }
  const { token, kedaluwarsa } = await buatTokenMobile(sessionUser)
  return {
    tokenType: "Bearer",
    accessToken: token,
    expiresInSeconds: UMUR_TOKEN_MOBILE_DETIK,
    expiresAt: kedaluwarsa.toISOString(),
    user: sessionUser,
  }
}

export async function loginDenganKredensial({
  identifier,
  password,
}: LoginMobileInput) {
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

  return buatResponsToken(user)
}

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
export async function loginDenganGoogle({ idToken }: GoogleMobileInput) {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
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

  return buatResponsToken(user)
}
