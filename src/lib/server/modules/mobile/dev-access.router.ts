// server/modules/mobile/dev-access.router.ts — gerbang kode akses untuk
// layar pengaturan-api tersembunyi di mobile-petugas (ganti server
// produksi/lokal di app yang sudah ter-install).
//
// KENAPA VERIFIKASI DI SERVER, BUKAN PIN LOKAL DI APP?
// Rahasia apa pun yang tersimpan di dalam bundel JS mobile bisa dibongkar
// lewat reverse-engineering APK. Dengan memindahkan pembanding ke sini,
// TIDAK ADA rahasia yang pernah ikut ter-build ke app — kode bisa diputar
// kapan saja lewat env var Vercel tanpa build ulang. Pola timingSafeEqual +
// fail-closed (503 bila env kosong) SAMA PERSIS dengan cron.router.ts.
import { Hono } from "hono"
import { timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { ok } from "../../lib/response"
import { UnauthorizedError, AppError } from "../../lib/errors"
import { validate } from "../../lib/validate"
import { cekRateLimit, ipKlien } from "../../lib/rate-limit"

export const devAccessRouter = new Hono()

function rahasiaCocok(diberikan: string, benar: string): boolean {
  const a = Buffer.from(diberikan)
  const b = Buffer.from(benar)
  return a.length === b.length && timingSafeEqual(a, b)
}

const verifySchema = z.object({ kode: z.string().min(1).max(200) })

/// Rate limit lebih ketat dari /login (5 vs 10 per 15 menit) — gerbang ini
/// membuka kemampuan mengarahkan app ke server lain, jauh lebih sensitif
/// daripada sekadar login gagal.
devAccessRouter.post("/verify", validate("json", verifySchema), async (c) => {
  const rahasia = process.env.PETUGAS_DEV_ACCESS_CODE
  if (!rahasia) {
    throw new AppError(
      503,
      "DEV_ACCESS_TIDAK_DIKONFIGURASI",
      "Kode akses belum diatur di server.",
    )
  }
  cekRateLimit(ipKlien(c), {
    nama: "petugas-dev-access",
    maks: 5,
    jendelaMs: 15 * 60 * 1000,
  })

  const { kode } = c.req.valid("json")
  if (!rahasiaCocok(kode, rahasia)) {
    throw new UnauthorizedError("Kode akses tidak valid.")
  }
  return ok(c, { valid: true })
})
