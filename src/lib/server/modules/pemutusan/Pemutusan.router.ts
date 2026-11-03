// server/modules/pemutusan/pemutusan.router.ts — riwayat pemutusan
// sambungan (TSM/SPT dari closing resmi, LAINNYA dari survei lapangan).
//
// KEPUTUSAN PENTING (konsisten dengan seed, lihat prisma/docs/README.md):
// mencatat pemutusan TIDAK PERNAH mengubah `Pelanggan.status` sebagai efek
// samping. Pencatatan pemutusan dan perubahan status pelanggan adalah dua
// keputusan bisnis terpisah, supaya tidak ada perubahan tersembunyi di data
// billing.
//
// Perubahan status punya pintunya sendiri yang HARUS ditekan manusia:
// POST /pemutusan/terapkan-status di bawah (pratinjau dulu, lalu setujui),
// atau PATCH /pelanggan/:id untuk satu pelanggan. Yang dilarang adalah
// otomatisnya, bukan perubahannya.
//
// `pelangganId` opsional: 219 titik "Eks Pelanggan" dari survei geojson
// adalah histori cabut lama yang nolg-nya kerap tidak ada di tabel
// Pelanggan. Snapshot `nomorLangganan`/`namaPelanggan` tetap diisi supaya
// baris orphan tidak kehilangan identitas.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created, paginated } from "../../lib/Respons"
import { auditMetaFromRequest } from "../../lib/Audit"
import {
  listPemutusanQuerySchema,
  createPemutusanSchema,
  terapkanStatusPemutusanSchema,
} from "./Pemutusan.schema"
import {
  listPemutusan,
  getPemutusanById,
  createPemutusan,
  terapkanStatusPemutusan,
} from "./Pemutusan.service"

export const pemutusanRouter = new Hono()

pemutusanRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listPemutusanQuerySchema),
  async (c) => {
    const { data, meta } = await listPemutusan(c.req.valid("query"))
    return paginated(c, data, meta)
  }
)

pemutusanRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await getPemutusanById(c.req.param("id"))
  return ok(c, row)
})

pemutusanRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createPemutusanSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    const row = await createPemutusan(
      c.req.valid("json"),
      requester.id,
      auditMeta
    )
    return created(c, row)
  }
)

// ── Terapkan status pelanggan dari pemutusan ─────────────────────────────
pemutusanRouter.post(
  "/terapkan-status",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", terapkanStatusPemutusanSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    const result = await terapkanStatusPemutusan(
      c.req.valid("json"),
      requester.id,
      auditMeta
    )
    return ok(c, result)
  }
)
