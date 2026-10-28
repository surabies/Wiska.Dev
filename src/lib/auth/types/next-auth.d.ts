// Auth.js session and token fields used throughout this application.
import type { DefaultSession } from "next-auth"
import type { Role } from "@db"

declare module "next-auth" {
  interface Session {
    user: {
      // The session callback fills this from the verified token subject.
      id: string
      role: Role
      divisiKode: string | null
      subBagianKode: string | null
    } & DefaultSession["user"]
  }

  interface User {
    role: Role
    divisiKode: string | null
    subBagianKode: string | null
  }
}

// Augmentasi menyasar "next-auth/jwt" (module specifier yang benar-benar
// dipakai kode ini untuk mengimpor tipe JWT — lihat auth.ts). next-auth
// re-export tipe JWT dari @auth/core lewat `export * from "@auth/core/jwt"`
// di dalam next-auth/jwt.d.ts, tapi declaration merging TypeScript tidak
// ikut menyatu lintas specifier re-export seperti itu, jadi augmentasi di
// "@auth/core/jwt" tidak akan terlihat dari sisi "next-auth/jwt" (begitu
// juga sebaliknya).
declare module "next-auth/jwt" {
  interface JWT {
    role: Role
    divisiKode: string | null
    subBagianKode: string | null
  }
}
