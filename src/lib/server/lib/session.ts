// server/lib/session.ts — akses session user yang type-safe dari Hono
// Context. Sengaja TIDAK mengandalkan tipe `Session` bawaan
// `@hono/auth-js` (diimpor dari "@auth/core/types") karena augmentasi kita
// di types/next-auth.d.ts menyasar module specifier "next-auth" —
// declaration merging TypeScript tidak menyatu lintas re-export seperti
// itu (catatan yang sama seperti kenapa callback `session` di auth.ts
// butuh anotasi eksplisit). Di sini kita cast eksplisit ke bentuk yang kita
// tahu persis (session callback di auth.ts yang menuliskannya).
import type { Context } from "hono"
import { getAuthUser } from "@hono/auth-js"
import type { Role } from "@db"
import { UnauthorizedError } from "./errors"
import { sessionUserDariBearer } from "./mobile-token"

export interface SessionUser {
  id: string
  name: string | null
  email: string
  role: Role
  divisiKode: string | null
  subBagianKode: string | null
}

export function getSessionUser(c: Context): SessionUser {
  const authUser = c.get("authUser")
  const user = authUser?.session?.user as SessionUser | undefined
  if (!user?.id) throw new UnauthorizedError()
  return user
}

/// Sepupu getSessionUser() untuk endpoint PUBLIK (server/modules/publik):
/// null (bukan throw) saat tidak ada sesi — "tidak login" adalah jawaban
/// sah di sana, bukan kegagalan. Mengenali DUA bentuk identitas, cocok
/// dengan blanket /api/v1 (verifyAuthFleksibel): cookie sesi web (Auth.js)
/// ATAU header `Authorization: Bearer <token mobile>`.
///
/// Dipakai supaya warga yang kebetulan sedang login (browser ATAU app
/// mobile) otomatis tertaut ke aduan yang dia kirim lewat endpoint publik
/// — tanpa mewajibkan login untuk memakai endpoint itu sama sekali.
export async function getSessionUserOpsional(
  c: Context,
): Promise<SessionUser | null> {
  const viaBearer = await sessionUserDariBearer(c)
  if (viaBearer) return viaBearer

  const authUser = await getAuthUser(c)
  const user = authUser?.session?.user as SessionUser | undefined
  return user?.id ? user : null
}
