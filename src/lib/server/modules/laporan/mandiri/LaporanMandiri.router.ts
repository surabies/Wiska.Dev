// server/modules/laporan/LaporanMandiri.router.ts — laporan stand meter
// mandiri oleh pelanggan (self-service, wajib foto bukti).
//
// Verifikasi memeriksa bukti dan mengoreksi stand laporan mandiri, tetapi
// tidak membuat PembacaanMeter resmi. Hasil resmi diterbitkan melalui alur
// verifikasi petugas. Setiap percobaan/bukti lama tetap tersimpan pada
// KirimanLaporanMandiri; baris utama adalah proyeksi status dan stand terbaru.
import { Hono } from "hono"
import { validate } from "../../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../../middleware/RBAC"
import { getSessionUser } from "../../../lib/Sesi"
import { ok, created, paginated } from "../../../lib/Respons"
import { auditMetaFromRequest } from "../../../lib/Audit"
import {
  createLaporanMandiriSchema,
  listLaporanMandiriQuerySchema,
  rejectLaporanMandiriSchema,
  statsLaporanMandiriQuerySchema,
  verifyLaporanMandiriSchema,
} from "./LaporanMandiri.schema"
import { kirimLaporanMandiriAkunWarga } from "./LaporanMandiri.service"
import {
  ambilStatistikLaporanMandiri,
  batalkanVerifikasiLaporanMandiri,
  getLaporanMandiriById,
  listLaporanMandiri,
  tolakLaporanMandiri,
  verifikasiLaporanMandiri,
} from "./LaporanMandiriVerifikasi.service"

export const laporanMandiriRouter = new Hono()

laporanMandiriRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listLaporanMandiriQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { data, meta } = await listLaporanMandiri(query)
    return paginated(c, data, meta)
  }
)

/// Ringkasan untuk halaman verifikasi: hitungan per status + daftar periode
/// yang punya data. Terdaftar SEBELUM /:id supaya "stats" tidak tertelan
/// param id.
laporanMandiriRouter.get(
  "/stats",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", statsLaporanMandiriQuerySchema),
  async (c) => {
    const data = await ambilStatistikLaporanMandiri(c.req.valid("query"))
    return ok(c, data)
  }
)

laporanMandiriRouter.get(
  "/:id",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const data = await getLaporanMandiriById(c.req.param("id"))
    return ok(c, data)
  }
)

// Jalur akun hanya menerima sambungan yang tertaut ke akun warga yang sedang
// login. Laporan ini adalah bukti; pembacaan resmi diterbitkan terpisah lewat
// verifikasi laporan petugas.
laporanMandiriRouter.post(
  "/",
  validate("json", createLaporanMandiriSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const body = c.req.valid("json")
    const row = await kirimLaporanMandiriAkunWarga(body, requester)
    return created(c, row)
  }
)

/// Verifikasi Mandiri menyinkronkan koreksi ke antrean Petugas dan mereset
/// tahap lama. PembacaanMeter tetap hanya diterbitkan melalui verifikasi V3.
laporanMandiriRouter.patch(
  "/:id/verify",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", verifyLaporanMandiriSchema),
  async (c) => {
    const id = c.req.param("id")
    const input = c.req.valid("json")
    const requester = getSessionUser(c)
    const metaAudit = auditMetaFromRequest(c.req.raw)
    const row = await verifikasiLaporanMandiri(id, input, requester, metaAudit)
    return ok(c, row)
  }
)

laporanMandiriRouter.patch(
  "/:id/reject",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", rejectLaporanMandiriSchema),
  async (c) => {
    const id = c.req.param("id")
    const input = c.req.valid("json")
    const requester = getSessionUser(c)
    const metaAudit = auditMetaFromRequest(c.req.raw)
    const row = await tolakLaporanMandiri(id, input, requester, metaAudit)
    return ok(c, row)
  }
)

/// "Unverifikasi": membatalkan hasil proses — DIGUNAKAN/DIVERIFIKASI maupun
/// DITOLAK kembali ke MENUNGGU. Pembatalan laporan yang sudah jadi
/// PembacaanMeter resmi ikut menghapus pembacaannya, dan ditolak bila
/// pembacaan itu sudah dipakai Tagihan (angka penagihan tidak boleh berubah
/// diam-diam).
laporanMandiriRouter.patch(
  "/:id/unverify",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const metaAudit = auditMetaFromRequest(c.req.raw)
    const row = await batalkanVerifikasiLaporanMandiri(id, requester, metaAudit)
    return ok(c, row)
  }
)
