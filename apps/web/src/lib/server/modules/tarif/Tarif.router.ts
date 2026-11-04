// server/modules/tarif/tarif.router.ts — TarifGolongan + TarifBlok
// (tarif progresif per blok konsumsi). Endpoint blok bukan CRUD generik:
// blok baru selalu INSERT (harga naik = baris baru dgn berlakuMulai baru),
// blok lama hanya boleh ditutup (`berlakuSampai`), tidak pernah diedit
// field lain — lihat komentar di TarifBlok (pelanggan.prisma).
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { auditMetaFromRequest } from "../../lib/Audit"
import { ok, created, paginated } from "../../lib/Respons"
import {
  listTarifQuerySchema,
  createTarifGolonganSchema,
  updateTarifGolonganSchema,
  createTarifBlokSchema,
  closeTarifBlokSchema,
} from "./Tarif.schema"
import {
  listTarifGolongan,
  getTarifGolonganById,
  createTarifGolongan,
  updateTarifGolongan,
  createTarifBlok,
  closeTarifBlok,
} from "./Tarif.service"

export const tarifRouter = new Hono()

// MEMBACA tarif = LAPANGAN, bukan STAFF_UP. PELAKSANA sengaja di luar
// STAFF_UP (lihat rbac.ts), tapi justru dialah yang butuh angka ini: aplikasi
// mobile memanggil endpoint ini untuk estimasi rupiah saat petugas mencatat
// meter. Jika akses dibatasi STAFF_UP, petugas akan menerima 403 sehingga
// estimasi tidak tampil untuk pengguna yang dituju fitur ini—gagal diam-diam
// karena pemanggil menelan ApiException dan jatuh ke cache kosong.
//
// Membukanya aman: tarif air adalah tarif publik yang diumumkan lewat Perdir,
// bukan rahasia internal. MENGUBAHNYA tetap ADMIN (lihat POST/PATCH di bawah).
tarifRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("query", listTarifQuerySchema),
  async (c) => {
    const { data, meta } = await listTarifGolongan(c.req.valid("query"))
    return paginated(c, data, meta)
  }
)

tarifRouter.get("/:id", requireRole(...ROLE_GROUPS.LAPANGAN), async (c) => {
  const row = await getTarifGolonganById(c.req.param("id"))
  return ok(c, row)
})

tarifRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", createTarifGolonganSchema),
  async (c) => {
    const row = await createTarifGolongan(c.req.valid("json"))
    return created(c, row)
  }
)

tarifRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", updateTarifGolonganSchema),
  async (c) => {
    const row = await updateTarifGolongan(
      c.req.param("id"),
      c.req.valid("json")
    )
    return ok(c, row)
  }
)

// Perubahan tarif = perubahan nominal yang ditagihkan ke seluruh pelanggan
// golongan ini -> tulisan paling berdampak finansial di sistem, wajib
// beraudit sama seperti mutasi Tagihan/Pembayaran.
tarifRouter.post(
  "/:id/blok",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", createTarifBlokSchema),
  async (c) => {
    const tarifGolonganId = c.req.param("id")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    const row = await createTarifBlok(
      tarifGolonganId,
      c.req.valid("json"),
      requester.id,
      auditMeta
    )
    return created(c, row)
  }
)

tarifRouter.patch(
  "/:id/blok/:blokId",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", closeTarifBlokSchema),
  async (c) => {
    const { id: tarifGolonganId, blokId } = c.req.param()
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    const row = await closeTarifBlok(
      tarifGolonganId,
      blokId,
      c.req.valid("json"),
      requester.id,
      auditMeta
    )
    return ok(c, row)
  }
)
