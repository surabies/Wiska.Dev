// server/modules/wilayah/rute.router.ts — rute pencatatan meter. Tidak
// punya field `nama` (beda dari model wilayah lain) -> orderBy/searchFields
// dioverride ke `kode`.
import { GEO } from "../../lib/Spatial"
import { createGeoCrudRouter } from "../../lib/GeoCrudFactory"
import { ROLE_GROUPS, requireRole } from "../../middleware/RBAC"
import { validate } from "../../lib/Validasi"
import { ok, paginated } from "../../lib/Respons"
import {
  createSchema,
  updateSchema,
  urutanPelangganListSchema,
  urutanPelangganSchema,
} from "./Rute.schema"
import * as service from "./Rute.service"

export const ruteRouter = createGeoCrudRouter({
  entitas: "Rute",
  model: "rute",
  geo: GEO.rute,
  createSchema,
  updateSchema,
  searchFields: ["kode"],
  orderBy: { kode: "asc" },
  include: { seksiCater: true },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})

// ── Daftar pelanggan terurut dalam satu rute ───────────────────────────
ruteRouter.get(
  "/:id/pelanggan-urutan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", urutanPelangganListSchema),
  async (c) => {
    const ruteId = c.req.param("id")
    const query = c.req.valid("query")
    const { data, meta } = await service.listPelangganUrutanRute(ruteId, query)
    return paginated(c, data, meta)
  }
)

// Urutan kunjungan pelanggan DALAM satu rute (Pelanggan.noUrutRute) — diatur
// dari halaman Pemetaan Rute dashboard. `pelangganIds` = urutan baru; tiap
// pelanggan diberi noUrutRute sesuai indeks (1-based). Dibaca mobile lewat
// pengurutan di rute-saya.
ruteRouter.patch(
  "/:id/urutan-pelanggan",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", urutanPelangganSchema),
  async (c) => {
    const ruteId = c.req.param("id")
    const result = await service.updateUrutanPelangganRute(
      ruteId,
      c.req.valid("json")
    )
    return ok(c, result)
  }
)
