// server/modules/konfigurasi/konfigurasi.router.ts — key-value store
// operasional (mis. AMBANG_ANOMALI_PERSEN). `isRahasia` menyamarkan
// `nilai` di response untuk siapapun selain SUPER_ADMIN — bukan enkripsi,
// murni supaya nilai sensitif tidak nongol begitu saja di UI admin biasa.
// Tidak ada endpoint DELETE (key konfigurasi bersifat tetap/sistem).
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, paginated } from "../../lib/Respons"
import {
  listQuerySchema,
  jendelaLaporMandiriSchema,
  upsertSchema,
} from "./Konfigurasi.schema"
import {
  listKonfigurasi,
  ambilJendelaLaporMandiri,
  perbaruiJendelaLaporMandiri,
  getKonfigurasiByKunci,
  upsertKonfigurasi,
} from "./Konfigurasi.service"

export const konfigurasiRouter = new Hono()

konfigurasiRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const canSeeSecret = getSessionUser(c).role === "SUPER_ADMIN"
    const { data, meta } = await listKonfigurasi(query, canSeeSecret)
    return paginated(c, data, meta)
  }
)

konfigurasiRouter.get(
  "/lapor-mandiri/jendela",
  requireRole(...ROLE_GROUPS.ADMIN),
  async (c) => {
    return ok(c, await ambilJendelaLaporMandiri())
  }
)

konfigurasiRouter.patch(
  "/lapor-mandiri/jendela",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", jendelaLaporMandiriSchema),
  async (c) => {
    const hasil = await perbaruiJendelaLaporMandiri(c.req.valid("json"))
    return ok(c, hasil)
  }
)

konfigurasiRouter.get(
  "/:kunci",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const canSeeSecret = getSessionUser(c).role === "SUPER_ADMIN"
    const row = await getKonfigurasiByKunci(c.req.param("kunci"), canSeeSecret)
    return ok(c, row)
  }
)

konfigurasiRouter.patch(
  "/:kunci",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", upsertSchema),
  async (c) => {
    const row = await upsertKonfigurasi(
      c.req.param("kunci"),
      c.req.valid("json")
    )
    return ok(c, row)
  }
)
