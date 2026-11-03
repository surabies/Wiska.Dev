// server/modules/pembayaran/pembayaran.router.ts — ledger pembayaran
// tunggal untuk Tagihan (air) DAN TagihanLain (non-air).
//
// Dua aturan yang WAJIB ditegakkan di sini karena database tidak bisa:
// 1. POLYMORPHIC XOR: tepat satu dari tagihanId/tagihanLainId harus terisi.
//    Prisma tidak punya relasi polymorphic native (lihat komentar model
//    RiwayatPembayaran), jadi divalidasi di zod + service ini.
// 2. IDEMPOTENSI: `kodeReferensi` unik = kunci idempoten untuk callback
//    PPOB/gateway yang bisa datang berkali-kali untuk transaksi yang sama.
//    P2002 -> 409 (bukan baris duplikat).
//
// Satu baris = satu PERCOBAAN bayar (termasuk PENDING/EXPIRED), bukan hanya
// yang berhasil. Status tagihan hanya berubah saat konfirmasi BERHASIL.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created, paginated } from "../../lib/Respons"
import { auditMetaFromRequest } from "../../lib/Audit"
import {
  listPembayaranQuerySchema,
  createPembayaranSchema,
  konfirmasiPembayaranSchema,
} from "./Pembayaran.schema"
import {
  listPembayaran,
  getPembayaranById,
  createPembayaran,
  konfirmasiPembayaran,
} from "./Pembayaran.service"

export const pembayaranRouter = new Hono()

pembayaranRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listPembayaranQuerySchema),
  async (c) => {
    const { data, meta } = await listPembayaran(c.req.valid("query"))
    return paginated(c, data, meta)
  }
)

pembayaranRouter.get(
  "/:id",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const row = await getPembayaranById(c.req.param("id"))
    return ok(c, row)
  }
)

pembayaranRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createPembayaranSchema),
  async (c) => {
    const row = await createPembayaran(c.req.valid("json"))
    return created(c, row)
  }
)

/// Finalisasi satu percobaan bayar. Kalau BERHASIL: dalam SATU transaksi,
/// tandai ledger BERHASIL + set Tagihan/TagihanLain jadi SUDAH_BAYAR beserta
/// cache tanggalBayar-nya. Baris yang sudah final tidak bisa dikonfirmasi
/// ulang (idempotensi terhadap callback ganda dari gateway).
pembayaranRouter.patch(
  "/:id/konfirmasi",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", konfirmasiPembayaranSchema),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    const row = await konfirmasiPembayaran(
      id,
      c.req.valid("json"),
      requester.id,
      auditMeta
    )
    return ok(c, row)
  }
)
