// server/modules/pengaduan/Pengaduan.router.ts — endpoint HTTP tipis di atas
// Pengaduan.service.ts untuk sisi PETUGAS alur pengaduan. Sisi warga ada di
// server/modules/publik/Publik.router.ts.
//
// Route statis (/near, /statistik, /petugas, /saya) WAJIB didaftarkan
// SEBELUM /:id supaya Hono tidak mencocokkannya sebagai parameter :id.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created, paginated } from "../../lib/Respons"
import { BadRequestError } from "../../lib/Galat"
import {
  listPengaduanQuerySchema,
  nearPengaduanQuerySchema,
  sayaPengaduanQuerySchema,
  createPengaduanSchema,
  tugaskanPengaduanSchema,
  ubahStatusPengaduanSchema,
  tambahCatatanPengaduanSchema,
  kirimChatPengaduanSchema,
  unggahFotoPengaduanSchema,
  eskalasiPengaduanSchema,
} from "./Pengaduan.schema"
import * as service from "./Pengaduan.service"

export const pengaduanRouter = new Hono()

pengaduanRouter.get(
  "/near",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", nearPengaduanQuerySchema),
  async (c) => {
    const data = await service.findPengaduanNear(c.req.valid("query"))
    return ok(c, data)
  }
)

pengaduanRouter.get(
  "/statistik",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const data = await service.getStatistikPengaduan()
    return ok(c, data)
  }
)

pengaduanRouter.get(
  "/petugas",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  async (c) => {
    const rows = await service.listPetugasPengaduan()
    return ok(c, rows)
  }
)

pengaduanRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listPengaduanQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const requester = getSessionUser(c)
    const { data, meta } = await service.listPengaduan(query, requester)
    return paginated(c, data, meta)
  }
)

/// WAJIB didaftarkan SEBELUM /:id — kalau tidak, "saya" akan tertelan
/// sebagai parameter :id, pola sama seperti /near, /statistik, /petugas.
pengaduanRouter.get(
  "/saya",
  validate("query", sayaPengaduanQuerySchema),
  async (c) => {
    const requester = getSessionUser(c)
    const query = c.req.valid("query")
    const { data, meta } = await service.listPengaduanSaya(query, requester)
    return paginated(c, data, meta)
  }
)

pengaduanRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const requester = getSessionUser(c)
  const data = await service.getPengaduanById(c.req.param("id"), requester)
  return ok(c, data)
})

// Sengaja TANPA requireRole: semua user terautentikasi (termasuk role USER)
// boleh mengirim aduan. Dipakai juga aplikasi Flutter petugas untuk mencatat
// aduan yang masuk lewat telepon/loket.
pengaduanRouter.post(
  "/",
  validate("json", createPengaduanSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const data = await service.createPengaduan(c.req.valid("json"), requester)
    return created(c, data)
  }
)

pengaduanRouter.patch(
  "/:id/tugaskan",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", tugaskanPengaduanSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.tugaskanPengaduan(
      c.req.param("id"),
      c.req.valid("json"),
      requester
    )
    return ok(c, row)
  }
)

pengaduanRouter.patch(
  "/:id/status",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", ubahStatusPengaduanSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.ubahStatusPengaduan(
      c.req.param("id"),
      c.req.valid("json"),
      requester
    )
    return ok(c, row)
  }
)

pengaduanRouter.post(
  "/:id/catatan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", tambahCatatanPengaduanSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.tambahCatatanPengaduan(
      c.req.param("id"),
      c.req.valid("json"),
      requester
    )
    return created(c, row)
  }
)

pengaduanRouter.post(
  "/:id/chat",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", kirimChatPengaduanSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.kirimChatPetugas(
      c.req.param("id"),
      c.req.valid("json"),
      requester
    )
    return created(c, row)
  }
)

pengaduanRouter.post(
  "/foto",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const form = await c.req.formData()
    const parsed = unggahFotoPengaduanSchema.parse({
      nomorTiket: form.get("nomorTiket"),
    })

    const foto = form.get("foto")
    if (!(foto instanceof File))
      throw new BadRequestError("Foto wajib dilampirkan sebagai field `foto`.")

    const data = await service.unggahFotoPenyelesaian(parsed.nomorTiket, foto)
    return created(c, data)
  }
)

pengaduanRouter.post(
  "/tutup-otomatis",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  async (c) => {
    const data = await service.tutupOtomatisPengaduan()
    return ok(c, data)
  }
)

pengaduanRouter.patch(
  "/:id/eskalasi",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", eskalasiPengaduanSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.eskalasiPengaduan(
      c.req.param("id"),
      c.req.valid("json"),
      requester
    )
    return ok(c, row)
  }
)
