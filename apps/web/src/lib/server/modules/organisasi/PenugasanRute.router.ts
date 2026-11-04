// server/modules/organisasi/penugasan-rute.router.ts — pemetaan Rute↔Petugas
// (halaman Pemetaan Rute dashboard). Many-to-many BERURUT: satu pencatat
// banyak rute (urut `urutan`), satu rute boleh dibagi >1 pencatat (pengganti
// cuti). PERMANEN — berlaku tiap periode tanpa admin mengatur ulang; dibaca
// aplikasi mobile lewat GET /laporan-harian/rute-saya. Menggantikan kolom
// tunggal `Pencatat.ruteId` + dialog penugasan lama.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { ok, created, paginated } from "../../lib/Respons"
import {
  listQuerySchema,
  opsiFilterQuerySchema,
  ruteTanpaPetugasSchema,
  buatSchema,
  urutanSchema,
} from "./PenugasanRute.schema"
import * as service from "./PenugasanRute.service"

export * from "./PenugasanRute.service"

export const penugasanRuteRouter = new Hono()

// ── Daftar penugasan satu pencatat (panel kanan halaman) ────────────────
penugasanRuteRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const { pencatatId } = c.req.valid("query")
    const data = await service.listPenugasanRute(pencatatId)
    return ok(c, data)
  }
)

// ── Ringkasan semua pencatat (panel kiri halaman) ───────────────────────
penugasanRuteRouter.get(
  "/ringkasan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const data = await service.getRingkasanPenugasanRute()
    return ok(c, data)
  }
)

penugasanRuteRouter.get(
  "/opsi-filter",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", opsiFilterQuerySchema),
  async (c) => {
    const { periode } = c.req.valid("query")
    const rows = await service.getOpsiFilterPenugasanRute(periode)
    return ok(c, rows)
  }
)

// ── Rute yang belum ditugaskan ke pencatat mana pun ────────────────────
penugasanRuteRouter.get(
  "/rute-tanpa-petugas",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", ruteTanpaPetugasSchema),
  async (c) => {
    const query = c.req.valid("query")
    const { data, meta } = await service.listRuteTanpaPetugas(query)
    return paginated(c, data, meta)
  }
)

// ── Tugaskan satu rute ke pencatat (append ke urutan terakhir) ──────────
penugasanRuteRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", buatSchema),
  async (c) => {
    const row = await service.buatPenugasanRute(c.req.valid("json"))
    return created(c, row)
  }
)

// ── Lepas satu penugasan ────────────────────────────────────────────────
penugasanRuteRouter.delete(
  "/:id",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  async (c) => {
    const result = await service.hapusPenugasanRute(c.req.param("id"))
    return ok(c, result)
  }
)

// ── Urutkan rute dalam beban kerja satu pencatat ────────────────────────
penugasanRuteRouter.patch(
  "/urutan",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", urutanSchema),
  async (c) => {
    const result = await service.urutkanPenugasanRute(c.req.valid("json"))
    return ok(c, result)
  }
)
