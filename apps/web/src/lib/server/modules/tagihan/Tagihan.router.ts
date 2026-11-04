// server/modules/tagihan/tagihan.router.ts — tagihan air periodik.
// Pembentukan nominal ada di tagihan.service.ts (dihitung server dari
// TarifBlok, tidak pernah dari client).
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created, paginated } from "../../lib/Respons"
import { auditMetaFromRequest } from "../../lib/Audit"
import {
  listTagihanQuerySchema,
  drdQuerySchema,
  drdRekapQuerySchema,
  generateTagihanSchema,
  simulasiTagihanSchema,
  patchTagihanStatusSchema,
} from "./Tagihan.schema"
import {
  serializeTagihan,
  generateTagihan,
  listTagihan,
  listDrd,
  getDrdRekap,
  getTagihanById,
  simulasiTagihan,
  updateTagihanStatus,
} from "./Tagihan.service"

export const tagihanRouter = new Hono()

tagihanRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listTagihanQuerySchema),
  async (c) => {
    const { data, meta } = await listTagihan(c.req.valid("query"))
    return paginated(c, data, meta)
  }
)

// ============================================================
// DRD — Daftar Rekening Ditagih (laporan penagihan per periode)
// ============================================================
// Terdaftar SEBELUM /:id supaya path statis "drd" tidak tertelan param id.

/// Baris DRD = Tagihan + identitas pelanggan selengkap kebutuhan cetakan
/// DRD (nomor langganan, nama, alamat, golongan tarif, rute) — berbeda dari
/// GET / yang include-nya minimal untuk daftar umum.
tagihanRouter.get(
  "/drd",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", drdQuerySchema),
  async (c) => {
    const { data, meta } = await listDrd(c.req.valid("query"))
    return paginated(c, data, meta)
  }
)

/// Rekap DRD: agregat per status + total keseluruhan + daftar periode yang
/// punya data (untuk dropdown). Agregasi di DB — tabel tagihan >22 ribu
/// baris per periode.
tagihanRouter.get(
  "/drd/rekap",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", drdRekapQuerySchema),
  async (c) => {
    const data = await getDrdRekap(c.req.valid("query"))
    return ok(c, data)
  }
)

tagihanRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await getTagihanById(c.req.param("id"))
  return ok(c, row)
})

tagihanRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", generateTagihanSchema),
  async (c) => {
    const row = await generateTagihan(c.req.valid("json"))
    return created(c, serializeTagihan(row))
  }
)

/// Simulasi tagihan tanpa menyimpan — untuk preview di UI sebelum closing.
tagihanRouter.post(
  "/simulasi",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", simulasiTagihanSchema),
  async (c) => {
    const data = await simulasiTagihan(c.req.valid("json"))
    return ok(c, data)
  }
)

/// Perubahan status manual. SUDAH_BAYAR sengaja TIDAK diizinkan di sini —
/// pelunasan hanya boleh lewat konfirmasi RiwayatPembayaran (modul
/// pembayaran) supaya setiap rupiah yang tercatat lunas selalu punya baris
/// ledger pendampingnya, tidak bisa "dilunaskan" tanpa jejak transaksi.
tagihanRouter.patch(
  "/:id/status",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  validate("json", patchTagihanStatusSchema),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    const row = await updateTagihanStatus(
      id,
      c.req.valid("json"),
      requester.id,
      auditMeta
    )
    return ok(c, row)
  }
)
