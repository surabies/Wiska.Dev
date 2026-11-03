// server/modules/meter/meter.router.ts — aset meter fisik.
//
// Aturan inti: "hanya SATU meter aktif per pelanggan" TIDAK bisa ditegakkan
// di database (Prisma tidak punya sintaks partial unique index
// `WHERE isAktif = true`, lihat komentar model Meter di tagihan.prisma) —
// jadi ditegakkan DI SINI: pemasangan meter baru = satu transaksi yang
// menonaktifkan semua meter lama pelanggan lalu meng-insert baris baru.
// Baris lama TIDAK PERNAH ditimpa/dihapus (histori penggantian meter wajib
// utuh untuk audit).
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created, paginated } from "../../lib/Respons"
import { auditMetaFromRequest } from "../../lib/Audit"
import {
  listMeterQuerySchema,
  createMeterSchema,
  updateMeterSchema,
} from "./Meter.schema"
import {
  listMeter,
  getMeterById,
  createMeter,
  updateMeter,
} from "./Meter.service"

export const meterRouter = new Hono()

meterRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listMeterQuerySchema),
  async (c) => {
    const { data, meta } = await listMeter(c.req.valid("query"))
    return paginated(c, data, meta)
  }
)

meterRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await getMeterById(c.req.param("id"))
  return ok(c, row)
})

// Pemasangan/penggantian meter. Meter lama otomatis jadi histori
// (isAktif=false) dalam transaksi yang sama.
meterRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createMeterSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    const row = await createMeter(c.req.valid("json"), requester.id, auditMeta)
    return created(c, row)
  }
)

// Hanya field administratif yang boleh diubah. nomorMeter/ukuran/pelangganId
// TIDAK bisa di-PATCH — mengganti meter fisik harus lewat POST (supaya
// menghasilkan baris histori baru, bukan menimpa yang lama).
meterRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", updateMeterSchema),
  async (c) => {
    const row = await updateMeter(c.req.param("id"), c.req.valid("json"))
    return ok(c, row)
  }
)
