// server/modules/tagihan/tagihan-lain.router.ts — pungutan non-air
// insidental (pasang baru, balik nama, ganti meter, denda, buka segel).
// Beda dari Tagihan: nominalnya memang ditentukan petugas (tidak ada tarif
// progresif yang bisa dihitung server), jadi `jumlah` diterima dari client
// — karena itu write-nya dibatasi SUPERVISOR ke atas dan tercatat di audit.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created, paginated } from "../../lib/Respons"
import { auditMetaFromRequest } from "../../lib/Audit"
import {
  listTagihanLainQuerySchema,
  createTagihanLainSchema,
  patchTagihanLainStatusSchema,
} from "./TagihanLain.schema"
import {
  listTagihanLain,
  getTagihanLainById,
  createTagihanLain,
  updateTagihanLainStatus,
} from "./TagihanLain.service"

export const tagihanLainRouter = new Hono()

tagihanLainRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listTagihanLainQuerySchema),
  async (c) => {
    const { data, meta } = await listTagihanLain(c.req.valid("query"))
    return paginated(c, data, meta)
  }
)

tagihanLainRouter.get(
  "/:id",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const row = await getTagihanLainById(c.req.param("id"))
    return ok(c, row)
  }
)

tagihanLainRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createTagihanLainSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    const row = await createTagihanLain(
      c.req.valid("json"),
      requester.id,
      auditMeta
    )
    return created(c, row)
  }
)

// Sama seperti Tagihan: pelunasan hanya lewat modul pembayaran.
tagihanLainRouter.patch(
  "/:id/status",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  validate("json", patchTagihanLainStatusSchema),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    const row = await updateTagihanLainStatus(
      id,
      c.req.valid("json"),
      requester.id,
      auditMeta
    )
    return ok(c, row)
  }
)
