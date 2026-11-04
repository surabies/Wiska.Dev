import { Hono } from "hono"
import { auditMetaFromRequest } from "../../../lib/Audit"
import { created, ok } from "../../../lib/Respons"
import { getSessionUser } from "../../../lib/Sesi"
import { validate } from "../../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../../middleware/RBAC"
import {
  filterSchema,
  inputMassalSchema,
  inputSatuanSchema,
  queryOpsiSchema,
  queryPelangganSchema,
} from "./ManualTambah.schema"
import * as service from "./ManualTambah.service"

export const manualAddRouter = new Hono()

manualAddRouter.get(
  "/cari-pelanggan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", queryPelangganSchema),
  async (c) => {
    const data = await service.cariPelangganManualAdd(c.req.valid("query"))
    return ok(c, data)
  }
)

manualAddRouter.get(
  "/opsi",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", queryOpsiSchema),
  async (c) => {
    const data = await service.ambilOpsiManualAdd(c.req.valid("query"))
    return ok(c, data)
  }
)

manualAddRouter.get(
  "/daftar",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", filterSchema),
  async (c) => {
    const hasil = await service.daftarManualAdd(c.req.valid("query"))
    return ok(c, hasil)
  }
)

manualAddRouter.post(
  "/satuan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", inputSatuanSchema),
  async (c) => {
    const input = c.req.valid("json")
    const requester = getSessionUser(c)
    const metaAudit = auditMetaFromRequest(c.req.raw)
    const hasil = await service.tambahManualSatuan(input, requester, metaAudit)
    return created(c, hasil)
  }
)

manualAddRouter.post(
  "/massal",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", inputMassalSchema),
  async (c) => {
    const input = c.req.valid("json")
    const requester = getSessionUser(c)
    const metaAudit = auditMetaFromRequest(c.req.raw)
    const hasil = await service.tambahManualMassal(input, requester, metaAudit)
    return created(c, hasil)
  }
)
