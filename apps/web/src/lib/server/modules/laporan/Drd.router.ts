import { Hono } from "hono"
import { z } from "zod"
import { ok } from "../../lib/Respons"
import { validate } from "../../lib/Validasi"
import { requireModuleAccess } from "../../middleware/RBAC"
import { buildMeta } from "../../lib/Pagination"
import { paginated } from "../../lib/Respons"
import type {
  BarisDomestikDrd,
  BarisCakupanDrd,
  BarisKelurahanDrd,
  BarisPelangganDrd,
  BarisTaaKelurahanDrd,
  BarisTarifDrd,
} from "@/features/dashboard/drd/types/TipeDrd"
import {
  ambilDataDrd,
  ambilGrafikDrd,
  ambilPeriodeDrd,
  ambilRingkasanDrd,
} from "./Drd.service"

const periodeSchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912),
})

const dataQuerySchema = periodeSchema.extend({
  tab: z.enum([
    "kelurahan",
    "domestik",
    "tarif",
    "taa-kelurahan",
    "cakupan",
    "taa",
    "tagihan",
    "pelanggan",
  ]),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5000).default(50),
  q: z.string().trim().max(120).default(""),
})

const grafikQuerySchema = periodeSchema.extend({
  tab: z.enum([
    "ringkasan",
    "kelurahan",
    "domestik",
    "tarif",
    "taa-kelurahan",
    "cakupan",
    "taa",
    "tagihan",
    "pelanggan",
  ]),
})

export const drdRouter = new Hono()

drdRouter.get("/stats", requireModuleAccess("LAPORAN_DRD"), async (c) => {
  return ok(c, { periodes: await ambilPeriodeDrd() })
})

drdRouter.get(
  "/ringkasan",
  requireModuleAccess("LAPORAN_DRD"),
  validate("query", periodeSchema),
  async (c) => {
    const { periode } = c.req.valid("query")
    return ok(c, await ambilRingkasanDrd(periode))
  }
)

drdRouter.get(
  "/grafik",
  requireModuleAccess("LAPORAN_DRD"),
  validate("query", grafikQuerySchema),
  async (c) => {
    const { periode, tab } = c.req.valid("query")
    return ok(c, await ambilGrafikDrd(periode, tab))
  }
)

drdRouter.get(
  "/data",
  requireModuleAccess("LAPORAN_DRD"),
  validate("query", dataQuerySchema),
  async (c) => {
    const { periode, tab, page, pageSize, q } = c.req.valid("query")
    const hasil = await ambilDataDrd({
      periode,
      tab,
      halaman: page,
      ukuranHalaman: pageSize,
      pencarian: q,
    })
    const baris: (
      | BarisKelurahanDrd
      | BarisDomestikDrd
      | BarisTarifDrd
      | BarisTaaKelurahanDrd
      | BarisCakupanDrd
      | BarisPelangganDrd
    )[] = [...hasil.baris]
    return paginated(c, baris, buildMeta(hasil.total, { page, pageSize }))
  }
)
