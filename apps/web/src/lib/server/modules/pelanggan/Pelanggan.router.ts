// server/modules/pelanggan/pelanggan.router.ts — endpoint HTTP tipis di
// atas pelanggan.service.ts. Route statis (/near) didaftarkan SEBELUM
// route param (/:id) supaya Hono tidak mencoba mencocokkan "near" sebagai
// :id lebih dulu.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created, paginated } from "../../lib/Respons"
import {
  createPelangganSchema,
  updatePelangganSchema,
  listPelangganQuerySchema,
  nearPelangganQuerySchema,
  perluRuteQuerySchema,
} from "./Pelanggan.schema"
import * as service from "./Pelanggan.service"

export const pelangganRouter = new Hono()

// ── Sambungan yang perlu dipetakan ke rute ──────────────────────────────
pelangganRouter.get(
  "/perlu-rute",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", perluRuteQuerySchema),
  async (c) => {
    const data = await service.getPelangganPerluRute(c.req.valid("query"))
    return ok(c, data)
  }
)

// ── PBPK (pasang baru / pasang kembali) ─────────────────────────────────
// Pola dua endpoint yang sama dengan master.
pelangganRouter.post(
  "/impor-pbpk/pratinjau",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  async (c) => {
    const requester = getSessionUser(c)
    return ok(c, await service.pratinjauImporPbpk(c.req.raw, requester))
  }
)

pelangganRouter.post(
  "/impor-pbpk",
  requireRole(...ROLE_GROUPS.SENIOR_UP),
  async (c) => {
    const requester = getSessionUser(c)
    return ok(c, await service.terapkanImporPbpk(c.req.raw, requester))
  }
)

// ── Master pelanggan STI (PEL{periode}-PW5.csv) ──────────────────────────
// SENGAJA DUA ENDPOINT, bukan satu dengan flag. Pratinjau tidak menulis dan
// boleh dijalankan manajemen untuk memeriksa berkas; penerapan menyentuh 22
// ribu baris pelanggan sekaligus dan disamakan kewenangannya dengan closing
// (SENIOR_UP). Memisahkannya membuat "siapa boleh melihat" dan "siapa boleh
// mengubah" tidak bergantung pada isi body request.
pelangganRouter.post(
  "/impor-master/pratinjau",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  async (c) => {
    const requester = getSessionUser(c)
    return ok(c, await service.pratinjauImporMaster(c.req.raw, requester))
  }
)

pelangganRouter.post(
  "/impor-master",
  requireRole(...ROLE_GROUPS.SENIOR_UP),
  async (c) => {
    const requester = getSessionUser(c)
    // `terapkanStatus` harus diminta EKSPLISIT. Perubahan status (tutupan /
    // pembukaan kembali) berkonsekuensi ke tagihan, jadi tidak ikut terbawa
    // hanya karena berkasnya diunggah.
    const terapkanStatus =
      new URL(c.req.url).searchParams.get("terapkanStatus") === "true"
    return ok(
      c,
      await service.terapkanImporMaster(c.req.raw, terapkanStatus, requester)
    )
  }
)

pelangganRouter.get(
  "/near",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", nearPelangganQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const data = await service.findPelangganNear(query)
    return ok(c, data)
  }
)

pelangganRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listPelangganQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const requester = getSessionUser(c)
    const { data, meta } = await service.listPelanggan(query, requester)
    return paginated(c, data, meta)
  }
)

pelangganRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const requester = getSessionUser(c)
  const row = await service.getPelangganById(c.req.param("id"), requester)
  return ok(c, row)
})

pelangganRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createPelangganSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.createPelanggan(
      c.req.valid("json"),
      requester,
      c.req.raw
    )
    return created(c, row)
  }
)

pelangganRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", updatePelangganSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.updatePelanggan(
      c.req.param("id"),
      c.req.valid("json"),
      requester,
      c.req.raw
    )
    return ok(c, row)
  }
)

pelangganRouter.delete(
  "/:id",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.softDeletePelanggan(
      c.req.param("id"),
      requester,
      c.req.raw
    )
    return ok(c, row)
  }
)

pelangganRouter.post(
  "/:id/restore",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.restorePelanggan(
      c.req.param("id"),
      requester,
      c.req.raw
    )
    return ok(c, row)
  }
)
