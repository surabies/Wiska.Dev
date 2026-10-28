// server/modules/organisasi/penugasan-rute.router.ts — pemetaan Rute↔Petugas
// (halaman Pemetaan Rute dashboard). Many-to-many BERURUT: satu pencatat
// banyak rute (urut `urutan`), satu rute boleh dibagi >1 pencatat (pengganti
// cuti). PERMANEN — berlaku tiap periode tanpa admin mengatur ulang; dibaca
// aplikasi mobile lewat GET /laporan-harian/rute-saya. Menggantikan kolom
// tunggal `Pencatat.ruteId` + dialog penugasan lama.
import { Hono } from "hono"
import { z } from "zod"
import { validate } from "../../lib/validate"
import { prisma } from "@db"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError, ConflictError, BadRequestError } from "../../lib/errors"
import { getNotifier } from "../notifikasi/notifier"
import {
  buildMeta,
  buildSkipTake,
  paginationQuerySchema,
} from "../../lib/pagination"

export const penugasanRuteRouter = new Hono()

// Jumlah pelanggan (target pencatatan) per rute — filter SAMA dengan
// rute-saya: hanya soft delete yang tidak dihitung. Tidak ada status yang
// mengeluarkan sambungan dari beban kerja (lihat catatan di rute-saya).
async function targetPerRute(ruteIds: string[]): Promise<Map<string, number>> {
  if (ruteIds.length === 0) return new Map()
  const grup = await prisma.pelanggan.groupBy({
    by: ["ruteId"],
    where: { ruteId: { in: ruteIds }, deletedAt: null },
    _count: { _all: true },
  })
  return new Map(grup.map((g) => [g.ruteId as string, g._count._all]))
}

// ── Daftar penugasan satu pencatat (panel kanan halaman) ────────────────
const listQuerySchema = z.object({ pencatatId: z.string().min(1) })

penugasanRuteRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const { pencatatId } = c.req.valid("query")
    const rows = await prisma.penugasanRute.findMany({
      where: { pencatatId },
      orderBy: { urutan: "asc" },
      include: {
        rute: {
          select: {
            id: true,
            kode: true,
            seksiCater: { select: { kode: true, nama: true } },
          },
        },
      },
    })
    const target = await targetPerRute(rows.map((r) => r.ruteId))
    return ok(
      c,
      rows.map((r) => ({
        id: r.id,
        ruteId: r.ruteId,
        urutan: r.urutan,
        rute: r.rute,
        target: target.get(r.ruteId) ?? 0,
      })),
    )
  },
)

// ── Ringkasan semua pencatat (panel kiri halaman) ───────────────────────
penugasanRuteRouter.get(
  "/ringkasan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const [pencatat, penugasan] = await Promise.all([
      prisma.pencatat.findMany({
        orderBy: { namaLapangan: "asc" },
        select: {
          id: true,
          namaLapangan: true,
          namaLengkap: true,
          isAktif: true,
          user: { select: { id: true, name: true } },
        },
      }),
      prisma.penugasanRute.findMany({
        select: { pencatatId: true, ruteId: true },
      }),
    ])
    const target = await targetPerRute([
      ...new Set(penugasan.map((p) => p.ruteId)),
    ])
    const perPencatat = new Map<
      string,
      { jumlahRute: number; totalTarget: number }
    >()
    for (const p of penugasan) {
      const agg = perPencatat.get(p.pencatatId) ?? {
        jumlahRute: 0,
        totalTarget: 0,
      }
      agg.jumlahRute += 1
      agg.totalTarget += target.get(p.ruteId) ?? 0
      perPencatat.set(p.pencatatId, agg)
    }
    return ok(
      c,
      pencatat.map((p) => ({
        ...p,
        jumlahRute: perPencatat.get(p.id)?.jumlahRute ?? 0,
        totalTarget: perPencatat.get(p.id)?.totalTarget ?? 0,
      })),
    )
  },
)

// ── Rute yang belum ditugaskan ke pencatat mana pun ────────────────────
const ruteTanpaPetugasSchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
})

penugasanRuteRouter.get(
  "/rute-tanpa-petugas",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", ruteTanpaPetugasSchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      penugasanRute: { none: {} },
      ...(query.q ? { kode: { contains: query.q, mode: "insensitive" as const } } : {}),
    }
    const [rute, total] = await Promise.all([
      prisma.rute.findMany({
        where,
        orderBy: { kode: "asc" },
        skip,
        take,
        select: {
          id: true,
          kode: true,
          seksiCater: { select: { nama: true } },
          _count: { select: { pelanggan: { where: { deletedAt: null } } } },
        },
      }),
      prisma.rute.count({ where }),
    ])
    return paginated(
      c,
      rute.map((r) => ({
        id: r.id,
        kode: r.kode,
        namaSeksi: r.seksiCater.nama,
        target: r._count.pelanggan,
      })),
      buildMeta(total, query),
    )
  },
)

// ── Tugaskan satu rute ke pencatat (append ke urutan terakhir) ──────────
const buatSchema = z.object({
  pencatatId: z.string().min(1),
  ruteId: z.string().min(1),
})

penugasanRuteRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", buatSchema),
  async (c) => {
    const { pencatatId, ruteId } = c.req.valid("json")
    const [pencatat, rute, sudahAda] = await Promise.all([
      prisma.pencatat.findUnique({
        where: { id: pencatatId },
        select: { id: true, userId: true },
      }),
      prisma.rute.findUnique({
        where: { id: ruteId },
        select: { id: true, kode: true },
      }),
      prisma.penugasanRute.findUnique({
        where: { pencatatId_ruteId: { pencatatId, ruteId } },
        select: { id: true },
      }),
    ])
    if (!pencatat) throw new NotFoundError("Pencatat")
    if (!rute) throw new NotFoundError("Rute")
    if (sudahAda)
      throw new ConflictError("Rute ini sudah ditugaskan ke pencatat tersebut")

    const terakhir = await prisma.penugasanRute.aggregate({
      where: { pencatatId },
      _max: { urutan: true },
    })
    const row = await prisma.penugasanRute.create({
      data: { pencatatId, ruteId, urutan: (terakhir._max.urutan ?? -1) + 1 },
    })
    // Beri tahu petugas pemilik akun (best-effort).
    if (pencatat.userId) {
      await getNotifier().kirim([pencatat.userId], {
        judul: "Rute baca meter baru ditugaskan",
        isi: `Anda ditugaskan ke rute ${rute.kode}. Buka Baca Meter untuk mengunduhnya.`,
        tipe: "rute",
        data: { tipe: "rute", ruteId },
      })
    }
    return created(c, row)
  },
)

// ── Lepas satu penugasan ────────────────────────────────────────────────
penugasanRuteRouter.delete(
  "/:id",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  async (c) => {
    const id = c.req.param("id")
    const existing = await prisma.penugasanRute.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) throw new NotFoundError("PenugasanRute")
    await prisma.penugasanRute.delete({ where: { id } })
    return ok(c, { id })
  },
)

// ── Urutkan rute dalam beban kerja satu pencatat ────────────────────────
const urutanSchema = z.object({
  pencatatId: z.string().min(1),
  ruteIds: z.array(z.string().min(1)).min(1),
})

penugasanRuteRouter.patch(
  "/urutan",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", urutanSchema),
  async (c) => {
    const { pencatatId, ruteIds } = c.req.valid("json")
    const milik = await prisma.penugasanRute.findMany({
      where: { pencatatId },
      select: { ruteId: true },
    })
    const setMilik = new Set(milik.map((m) => m.ruteId))
    if (
      ruteIds.length !== setMilik.size ||
      new Set(ruteIds).size !== ruteIds.length ||
      !ruteIds.every((r) => setMilik.has(r))
    ) {
      throw new BadRequestError(
        "Daftar rute tidak cocok dengan penugasan pencatat ini",
      )
    }
    await prisma.$transaction(
      ruteIds.map((ruteId, i) =>
        prisma.penugasanRute.update({
          where: { pencatatId_ruteId: { pencatatId, ruteId } },
          data: { urutan: i },
        }),
      ),
    )
    return ok(c, { pencatatId, jumlah: ruteIds.length })
  },
)
