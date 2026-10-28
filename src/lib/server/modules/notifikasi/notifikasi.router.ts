// server/modules/notifikasi/notifikasi.router.ts — token perangkat push +
// inbox notifikasi in-app. Dua router:
//   perangkatRouter  → /api/v1/perangkat   (daftar/hapus token FCM)
//   notifikasiRouter → /api/v1/notifikasi  (inbox: baca daftar & tandai baca)
// Notifikasi terikat akun token; tak ada requireRole di inbox (setiap query
// disaring userId sesi, pola sama dengan langganan-saya). Pendaftaran token
// dibatasi STAFF_UP — hanya akun petugas/staf yang menerima push kerja.
import { Hono } from "hono"
import { z } from "zod"
import { validate } from "../../lib/validate"
import { prisma } from "@db"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
} from "../../lib/pagination"
import { ok, paginated } from "../../lib/response"
import { NotFoundError } from "../../lib/errors"

// ── Perangkat (token FCM) ──────────────────────────────────────────────
export const perangkatRouter = new Hono()

const daftarTokenSchema = z.object({
  token: z.string().trim().min(1).max(4096),
  platform: z.enum(["android", "ios", "web"]).optional(),
})

// Upsert by token: satu baris per perangkat fisik. Token bisa berpindah akun
// (perangkat dipakai bergantian) — upsert memindahkan kepemilikan ke user
// yang sedang login sekarang.
perangkatRouter.post(
  "/token",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", daftarTokenSchema),
  async (c) => {
    const user = getSessionUser(c)
    const { token, platform } = c.req.valid("json")
    const row = await prisma.perangkatNotif.upsert({
      where: { token },
      create: { token, userId: user.id, platform: platform ?? "android" },
      update: {
        userId: user.id,
        platform: platform ?? "android",
        lastSeenAt: new Date(),
      },
      select: { id: true, platform: true },
    })
    return ok(c, row)
  },
)

const hapusTokenSchema = z.object({ token: z.string().trim().min(1).max(4096) })

// Hanya token MILIK sendiri yang bisa dilepas (dipanggil saat logout).
perangkatRouter.delete(
  "/token",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", hapusTokenSchema),
  async (c) => {
    const user = getSessionUser(c)
    const { token } = c.req.valid("json")
    const hasil = await prisma.perangkatNotif.deleteMany({
      where: { token, userId: user.id },
    })
    return ok(c, { deleted: hasil.count })
  },
)

// ── Inbox notifikasi ────────────────────────────────────────────────────
export const notifikasiRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  belumDibaca: z.coerce.boolean().optional(),
})

notifikasiRouter.get("/", validate("query", listQuerySchema), async (c) => {
  const user = getSessionUser(c)
  const query = c.req.valid("query")
  const { skip, take } = buildSkipTake(query)
  const where = {
    userId: user.id,
    ...(query.belumDibaca ? { dibacaAt: null } : {}),
  }
  const [data, total, belumDibaca] = await Promise.all([
    prisma.notifikasi.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notifikasi.count({ where }),
    prisma.notifikasi.count({ where: { userId: user.id, dibacaAt: null } }),
  ])
  // belumDibaca lewat variabel (bukan literal langsung) agar tidak kena
  // excess-property check terhadap PaginationMeta; ikut di objek meta respons.
  const meta = { ...buildMeta(total, query), belumDibaca }
  return paginated(c, data, meta)
})

notifikasiRouter.patch("/:id/baca", async (c) => {
  const user = getSessionUser(c)
  // Batasi ke milik sendiri lewat updateMany (bukan update by id) supaya tak
  // bisa menandai notifikasi orang lain.
  const hasil = await prisma.notifikasi.updateMany({
    where: { id: c.req.param("id"), userId: user.id },
    data: { dibacaAt: new Date() },
  })
  if (hasil.count === 0) throw new NotFoundError("Notifikasi")
  return ok(c, { updated: hasil.count })
})

notifikasiRouter.post("/baca-semua", async (c) => {
  const user = getSessionUser(c)
  const hasil = await prisma.notifikasi.updateMany({
    where: { userId: user.id, dibacaAt: null },
    data: { dibacaAt: new Date() },
  })
  return ok(c, { updated: hasil.count })
})
