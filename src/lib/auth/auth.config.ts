// auth.config.ts
import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Allows Google to link to an account provisioned by an administrator
      // before its first OAuth login. Google verifies email ownership, and
      // auth.ts rejects users who do not already exist in the database.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email atau username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // authorize() diimplementasi di auth.ts (butuh Prisma), bukan di sini
      authorize: async () => null,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // In production, set AUTH_URL to the canonical origin and ensure the
  // reverse proxy normalizes Host and X-Forwarded-Host headers.
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = request.nextUrl
      // /akun = portal warga (role USER, akun mandiri via /daftar) — beda
      // dari /dashboard (staf), tapi butuh gerbang sesi yang sama persis:
      // pengunjung tanpa sesi tidak boleh sampai ke halaman yang menampilkan
      // riwayat pengaduan pribadi.
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/akun")) return isLoggedIn
      return true
    },
  },
  session: { strategy: "jwt" },
}