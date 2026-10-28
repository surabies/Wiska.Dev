// Node-only Auth.js configuration: Prisma-backed credentials and Google OAuth.
import type {} from "./types/next-auth"
// Include the augmentation in this TypeScript program for typed role claims.
import NextAuth, { type NextAuthConfig, type NextAuthResult } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import type { Adapter, AdapterAccount } from "next-auth/adapters"
import type { Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import { authConfig } from "./auth.config"
import { prisma } from "@db"
import { verifyPassword, DUMMY_PASSWORD_HASH } from "./password"

export { prisma }

/// Kolom yang ada di model Account (prisma/schema/auth.prisma).
/// Dipakai menyaring objek account dari Auth.js sebelum masuk Prisma.
const KOLOM_ACCOUNT = [
  "userId",
  "type",
  "provider",
  "providerAccountId",
  "refresh_token",
  "access_token",
  "expires_at",
  "token_type",
  "scope",
  "id_token",
  "session_state",
] as const

/// PrismaAdapter dengan linkAccount yang disaring.
///
/// KENAPA PERLU (diuji langsung, bukan dugaan): @auth/core membangun
/// `account` sebagai `{ ...tokens, provider, type, providerAccountId }` di
/// mana `tokens` adalah respons token mentah dari provider — untuk Google
/// itu MASIH memuat `expires_in`, dan Auth.js tidak pernah membuangnya
/// (lihat lib/actions/callback/oauth/callback.js: cuma menambah expires_at,
/// tanpa delete expires_in). @auth/prisma-adapter lalu meneruskannya apa
/// adanya: `linkAccount: (data) => p.account.create({ data })`.
/// Hasilnya Prisma menolak dengan `Unknown argument 'expires_in'` dan LOGIN
/// GOOGLE GAGAL TOTAL saat pertama kali menautkan akun — sudah direproduksi
/// persis dengan bentuk payload Google yang sebenarnya.
///
/// Menyaring di sini (bukan menambah kolom `expires_in` ke schema) karena
/// `expires_at` sudah menyimpan informasi yang sama dalam bentuk absolut —
/// menambah kolom hanya untuk menampung sampah dari provider justru
/// mengotori skema. Whitelist, bukan blacklist: field asing baru dari
/// provider manapun ikut tersaring tanpa perlu diketahui lebih dulu.
function buatAdapter(): Adapter {
  const dasar = PrismaAdapter(prisma)
  return {
    ...dasar,
    linkAccount: (account) => {
      const bersih = Object.fromEntries(
        Object.entries(account).filter(([kunci]) => (KOLOM_ACCOUNT as readonly string[]).includes(kunci))
      ) as AdapterAccount
      return dasar.linkAccount!(bersih)
    },
  }
}

export const fullAuthConfig: NextAuthConfig = {
  ...authConfig,
  adapter: buatAdapter(),
  providers: [
    ...authConfig.providers.filter(
      (p) => (p as { id?: string }).id !== "credentials"
    ),
    Credentials({
      name: "Credentials",
      credentials: {
        // `identifier`, bukan `username`: akun bisa dibuat tanpa username
        // (mis. hasil `pnpm db:bootstrap-admin` yang berbasis email untuk
        // login Google). Kalau hanya menerima username, akun-akun itu
        // MUSTAHIL login lewat password meski sudah punya passwordHash.
        identifier: { label: "Email atau username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = (credentials?.identifier as string | undefined)?.trim()
        const password = credentials?.password as string | undefined
        if (!identifier || !password) return null

        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier.toLowerCase() }, { username: identifier }],
          },
        })

        // Selalu jalankan verifikasi, bahkan saat user/hash tidak ada.
        // Kalau langsung `return null`, respons untuk "email tidak terdaftar"
        // jauh lebih cepat daripada "password salah" — selisih waktu itu
        // membocorkan email mana yang terdaftar (user enumeration).
        // DUMMY_PASSWORD_HASH membuat kedua jalur memakan waktu setara
        // (terukur: ~21ms vs ~27ms; lihat lib/password.ts).
        const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH
        const cocok = await verifyPassword(hash, password)

        if (!user || !user.passwordHash || !cocok) return null

        // Akun nonaktif/suspended TIDAK boleh masuk. Tanpa cek ini,
        // menonaktifkan user lewat PATCH /api/v1/users/:id/status tidak ada
        // efeknya sama sekali terhadap login — pintu tetap terbuka.
        if (user.status !== "ACTIVE") return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          divisiKode: user.divisiKode,
          subBagianKode: user.subBagianKode,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role
        token.divisiKode = user.divisiKode
        token.subBagianKode = user.subBagianKode
      }
      if (trigger === "update" && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.divisiKode = dbUser.divisiKode
          token.subBagianKode = dbUser.subBagianKode
        }
      }
      return token
    },
    // Anotasi eksplisit wajib ada — lihat catatan di types/next-auth.d.ts:
    // tanpanya, inferensi kontekstual TypeScript untuk `token` di sini
    // mengambil signature asli @auth/core (bukan hasil augmentasi kita),
    // dan role/divisiKode/subBagianKode diam-diam jadi `unknown`.
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role
        session.user.divisiKode = token.divisiKode
        session.user.subBagianKode = token.subBagianKode
      }
      return session
    },
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })
        // Tidak terdaftar -> tolak. Sistem ini tidak punya pendaftaran
        // mandiri; akun dibuat administrator lewat POST /api/v1/users.
        if (!existingUser) return false
        // Cek status WAJIB ada di sini juga, bukan cuma di authorize():
        // kalau hanya credentials yang dicek, menonaktifkan seorang user
        // tidak menutup pintu Google-nya dan dia tetap bisa masuk.
        if (existingUser.status !== "ACTIVE") return false
      }
      return true
    },
  },
}

// Anotasi tipe eksplisit WAJIB di sini (bukan destructuring polos). Dengan
// node_modules ter-symlink pnpm + moduleResolution "bundler", tipe inferensi
// hasil NextAuth() cuma bisa dinamai lewat path .pnpm/... yang tidak portabel
// → tsc gagal dengan TS2742. Memaku tiap export ke slice NextAuthResult
// (tipe publik next-auth) memutus ketergantungan pada path symlink itu.
const nextAuth = NextAuth(fullAuthConfig)

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers
export const auth: NextAuthResult["auth"] = nextAuth.auth
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut
