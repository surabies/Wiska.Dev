// proxy.ts — proteksi route di edge runtime (Next.js 16 "proxy", dulu
// "middleware"). Sengaja memakai authConfig EDGE-SAFE dari
// @/lib/auth/auth.config (tanpa Prisma/argon2) — proxy hanya perlu cek
// "ada session valid atau tidak" lewat callbacks.authorized, tidak perlu
// query database. JANGAN import dari "@workspace/auth" (barrel Node) di sini:
// itu menyeret Prisma & @node-rs/argon2 ke edge dan akan gagal build.
//
// PENTING: JANGAN tulis `export const { auth: proxy } = NextAuth(authConfig)`.
// Next.js 16 melakukan pengecekan statis "apakah file ini meng-export
// function" sebelum module benar-benar dievaluasi, dan pengecekan itu
// gagal mengenali binding hasil destructuring-export meski nilainya
// memang function saat runtime (dikonfirmasi lewat instrumentasi manual:
// typeof proxy tetap "function", tapi Next.js tetap melempar
// ProxyMissingExportError). Assignment biasa dari member access aman.
import NextAuth, { type NextAuthResult } from "next-auth"
import { authConfig } from "@/lib/auth/auth.config"

const nextAuth = NextAuth(authConfig)
// Anotasi eksplisit: tanpa ini tipe inferensi `proxy` cuma bisa dinamai
// lewat path node_modules non-portabel (TS2742) di bawah symlink pnpm.
export const proxy: NextAuthResult["auth"] = nextAuth.auth

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
