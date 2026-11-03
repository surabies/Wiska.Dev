// src/lib/server/modules/laporan/LaporanHarian.router.ts — laporan harian petugas
// (pra-verifikasi), dengan alur verifikasi BERJENJANG V1→V2→V3
// (Supervisor → Manager → Senior Manager). Laporan BERMUARA ke
// PembacaanMeter resmi hanya di V3: satu transaksi membuat baris
// PembacaanMeter dari data laporan (memakai koreksi V1 bila ada) lalu
// menautkannya balik (`pembacaanId`) — itulah yang membuat laporan
// lapangan naik jadi angka resmi penagihan.
//
// Pola relasi + snapshot (pelangganId opsional + namaPelanggan/alamat teks)
// mengikuti keputusan schema: baris orphan (pelanggan belum ter-import)
// tetap punya identitas yang terbaca di UI, lihat prisma/docs/README.md.
import { Hono } from "hono"
import { validate } from "../../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../../middleware/RBAC"
import { getSessionUser } from "../../../lib/Sesi"
import { ok, created, paginated } from "../../../lib/Respons"
import { auditMetaFromRequest } from "../../../lib/Audit"
import {
  listQuerySchema,
  statsQuerySchema,
  progresQuerySchema,
  belumDibacaQuerySchema,
  ruteSayaQuerySchema,
  susunUrutSchema,
  createSchema,
  batchSchema,
  verif1Schema,
  catatanSchema,
  koreksiLaporanSchema,
  penilaianFotoSchema,
  verifMassalSchema,
  rejectSchema,
} from "./LaporanHarian.schema"
import {
  daftarLaporanHarian,
  statistikLaporanHarian,
  ambilLaporanHarianById,
} from "./LaporanHarianKueri.service"
import {
  progresPencatatLaporanHarian,
  daftarBelumDibaca,
  type JenisHari,
} from "./LaporanHarianPantau.service"
import { ambilRuteSaya, susunUrutRuteSaya } from "./LaporanHarianRute.service"
import {
  unggahFotoLaporanHarian,
  buatLaporanHarian,
  buatBatchLaporanHarian,
} from "./LaporanHarianSimpan.service"
import {
  imporFotoLaporanHarian,
  imporCatatanLaporanHarian,
} from "./LaporanHarianImpor.service"
import {
  verifikasiV1LaporanHarian,
  verifikasiV2LaporanHarian,
  verifikasiV3LaporanHarian,
  verifikasiLangsungLaporanHarian,
  verifikasiMassalLaporanHarian,
} from "./LaporanHarianVerifikasi.service"
import {
  koreksiLaporanHarian,
  nilaiKondisiFotoLaporanHarian,
  tolakLaporanHarian,
  batalkanVerifikasiLaporanHarian,
} from "./LaporanHarianKoreksi.service"

export type { JenisHari }

export const laporanHarianRouter = new Hono()

laporanHarianRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { data, meta } = await daftarLaporanHarian(query)
    return paginated(c, data, meta)
  }
)

laporanHarianRouter.get(
  "/stats",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", statsQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    return ok(c, await statistikLaporanHarian(query))
  }
)

laporanHarianRouter.get(
  "/progres-pencatat",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", progresQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    return ok(c, await progresPencatatLaporanHarian(query))
  }
)

laporanHarianRouter.get(
  "/belum-dibaca",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", belumDibacaQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { data, meta } = await daftarBelumDibaca(query)
    return paginated(c, data, meta)
  }
)

laporanHarianRouter.get(
  "/rute-saya",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("query", ruteSayaQuerySchema),
  async (c) => {
    const user = getSessionUser(c)
    const query = c.req.valid("query")
    return ok(c, await ambilRuteSaya(query, user))
  }
)

laporanHarianRouter.post(
  "/rute-saya/urutan",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("json", susunUrutSchema),
  async (c) => {
    const body = c.req.valid("json")
    const user = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    return ok(c, await susunUrutRuteSaya(body, user, auditMeta))
  }
)

laporanHarianRouter.post(
  "/foto",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  async (c) => {
    const form = await c.req.formData()
    return created(c, await unggahFotoLaporanHarian(form))
  }
)

laporanHarianRouter.get(
  "/:id",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    return ok(c, await ambilLaporanHarianById(c.req.param("id")))
  }
)

laporanHarianRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("json", createSchema),
  async (c) => {
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const row = await buatLaporanHarian(body, requester)
    return created(c, row)
  }
)

laporanHarianRouter.post(
  "/batch",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("json", batchSchema),
  async (c) => {
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    return ok(c, await buatBatchLaporanHarian(body, requester))
  }
)

laporanHarianRouter.post(
  "/impor/foto",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const form = await c.req.formData()
    return ok(c, await imporFotoLaporanHarian(form))
  }
)

laporanHarianRouter.post(
  "/impor/catatan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const form = await c.req.formData()
    const requester = getSessionUser(c)
    return ok(c, await imporCatatanLaporanHarian(form, requester))
  }
)

laporanHarianRouter.patch(
  "/:id/verif1",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", verif1Schema),
  async (c) => {
    const id = c.req.param("id")
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    return ok(
      c,
      await verifikasiV1LaporanHarian(id, body, requester, auditMeta)
    )
  }
)

laporanHarianRouter.patch(
  "/:id/verif2",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  validate("json", catatanSchema),
  async (c) => {
    const id = c.req.param("id")
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    return ok(
      c,
      await verifikasiV2LaporanHarian(id, body, requester, auditMeta)
    )
  }
)

laporanHarianRouter.patch(
  "/:id/verif3",
  requireRole(...ROLE_GROUPS.SENIOR_UP),
  validate("json", catatanSchema),
  async (c) => {
    const id = c.req.param("id")
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    return ok(
      c,
      await verifikasiV3LaporanHarian(id, body, requester, auditMeta)
    )
  }
)

laporanHarianRouter.patch(
  "/:id/verifikasi-langsung",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    return ok(
      c,
      await verifikasiLangsungLaporanHarian(id, requester, auditMeta)
    )
  }
)

laporanHarianRouter.patch(
  "/:id/koreksi",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", koreksiLaporanSchema),
  async (c) => {
    const id = c.req.param("id")
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    return ok(c, await koreksiLaporanHarian(id, body, requester, auditMeta))
  }
)

laporanHarianRouter.post(
  "/:id/kondisi-foto",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", penilaianFotoSchema),
  async (c) => {
    const id = c.req.param("id")
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    return created(
      c,
      await nilaiKondisiFotoLaporanHarian(id, body, requester, auditMeta)
    )
  }
)

laporanHarianRouter.post(
  "/verif-massal",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", verifMassalSchema),
  async (c) => {
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    return ok(
      c,
      await verifikasiMassalLaporanHarian(body, requester, auditMeta)
    )
  }
)

laporanHarianRouter.patch(
  "/:id/reject",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", rejectSchema),
  async (c) => {
    const id = c.req.param("id")
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    return ok(c, await tolakLaporanHarian(id, body, requester, auditMeta))
  }
)

laporanHarianRouter.patch(
  "/:id/unverify",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const auditMeta = auditMetaFromRequest(c.req.raw)
    return ok(
      c,
      await batalkanVerifikasiLaporanHarian(id, requester, auditMeta)
    )
  }
)
