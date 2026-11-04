// server/modules/notifikasi/notifikasi.router.ts — token perangkat push +
// inbox notifikasi in-app. Dua router:
//   perangkatRouter  → /api/v1/perangkat   (daftar/hapus token FCM)
//   notifikasiRouter → /api/v1/notifikasi  (inbox: baca daftar & tandai baca)
// Notifikasi terikat akun token; tak ada requireRole di inbox (setiap query
// disaring userId sesi, pola sama dengan langganan-saya). Pendaftaran token
// dibatasi STAFF_UP — hanya akun petugas/staf yang menerima push kerja.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, paginated } from "../../lib/Respons"
import {
  daftarTokenSchema,
  hapusTokenSchema,
  listQuerySchema,
} from "./Notifikasi.schema"
import {
  daftarkanTokenPerangkat,
  hapusTokenPerangkat,
  listNotifikasi,
  tandaiNotifikasiDibaca,
  tandaiSemuaNotifikasiDibaca,
} from "./Notifikasi.service"

// ── Perangkat (token FCM) ──────────────────────────────────────────────
export const perangkatRouter = new Hono()

// Upsert by token: satu baris per perangkat fisik. Token bisa berpindah akun
// (perangkat dipakai bergantian) — upsert memindahkan kepemilikan ke user
// yang sedang login sekarang.
perangkatRouter.post(
  "/token",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", daftarTokenSchema),
  async (c) => {
    const user = getSessionUser(c)
    const row = await daftarkanTokenPerangkat(user.id, c.req.valid("json"))
    return ok(c, row)
  }
)

// Hanya token MILIK sendiri yang bisa dilepas (dipanggil saat logout).
perangkatRouter.delete(
  "/token",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", hapusTokenSchema),
  async (c) => {
    const user = getSessionUser(c)
    const hasil = await hapusTokenPerangkat(user.id, c.req.valid("json"))
    return ok(c, hasil)
  }
)

// ── Inbox notifikasi ────────────────────────────────────────────────────
export const notifikasiRouter = new Hono()

notifikasiRouter.get("/", validate("query", listQuerySchema), async (c) => {
  const user = getSessionUser(c)
  const query = c.req.valid("query")
  const { data, meta } = await listNotifikasi(user.id, query)
  return paginated(c, data, meta)
})

notifikasiRouter.patch("/:id/baca", async (c) => {
  const user = getSessionUser(c)
  const hasil = await tandaiNotifikasiDibaca(user.id, c.req.param("id"))
  return ok(c, hasil)
})

notifikasiRouter.post("/baca-semua", async (c) => {
  const user = getSessionUser(c)
  const hasil = await tandaiSemuaNotifikasiDibaca(user.id)
  return ok(c, hasil)
})
