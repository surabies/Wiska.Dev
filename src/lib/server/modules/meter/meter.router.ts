// server/modules/meter/meter.router.ts — aset meter fisik.
//
// Aturan inti: "hanya SATU meter aktif per pelanggan" TIDAK bisa ditegakkan
// di database (Prisma tidak punya sintaks partial unique index
// `WHERE isAktif = true`, lihat komentar model Meter di tagihan.prisma) —
// jadi ditegakkan DI SINI: pemasangan meter baru = satu transaksi yang
// menonaktifkan semua meter lama pelanggan lalu meng-insert baris baru.
// Baris lama TIDAK PERNAH ditimpa/dihapus (histori penggantian meter wajib
// utuh untuk audit).
import { Hono } from "hono"
import { z } from "zod"
import { UkuranMeter } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError } from "../../lib/errors"
import { recordAudit, auditMetaFromRequest } from "../../lib/audit"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"

export const meterRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "nomorMeter",
    "merkKode",
    "ukuran",
    "tanggalPasang",
    "isAktif",
    "createdAt",
  ]),
  q: z.string().trim().min(1).optional(),
  pelangganId: z.string().optional(),
  isAktif: z.coerce.boolean().optional(),
})

meterRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      pelangganId: query.pelangganId,
      isAktif: query.isAktif,
      ...(query.q
        ? { nomorMeter: { contains: query.q, mode: "insensitive" as const } }
        : {}),
    }
    const [data, total] = await Promise.all([
      prisma.meter.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, [
          { isAktif: "desc" },
          { createdAt: "desc" },
        ]),
        include: {
          pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
        },
      }),
      prisma.meter.count({ where }),
    ])
    return paginated(c, data, buildMeta(total, query))
  },
)

meterRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await prisma.meter.findUnique({
    where: { id: c.req.param("id") },
    include: {
      pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
    },
  })
  if (!row) throw new NotFoundError("Meter")
  return ok(c, row)
})

const createMeterSchema = z.object({
  pelangganId: z.string().min(1),
  nomorMeter: z.string().trim().min(1).max(50),
  nomorSegel: z.string().trim().max(50).nullable().optional(),
  merkKode: z.string().trim().max(50).nullable().optional(),
  ukuran: z.enum(UkuranMeter).optional(),
  tanggalPasang: z.coerce.date().nullable().optional(),
  catatan: z.string().max(500).nullable().optional(),
})

// Pemasangan/penggantian meter. Meter lama otomatis jadi histori
// (isAktif=false) dalam transaksi yang sama.
meterRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createMeterSchema),
  async (c) => {
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: body.pelangganId },
    })
    if (!pelanggan || pelanggan.deletedAt) throw new NotFoundError("Pelanggan")

    const row = await prisma.$transaction(async (tx) => {
      const digantikan = await tx.meter.updateMany({
        where: { pelangganId: body.pelangganId, isAktif: true },
        data: { isAktif: false },
      })
      const row = await tx.meter.create({ data: { ...body, isAktif: true } })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: digantikan.count > 0 ? "GANTI_METER" : "PASANG_METER",
        entitas: "Meter",
        entitasId: row.id,
        perubahan: { meterLamaDinonaktifkan: digantikan.count, after: row },
        ipAddress,
        userAgent,
      })
      return row
    })

    return created(c, row)
  },
)

// Hanya field administratif yang boleh diubah. nomorMeter/ukuran/pelangganId
// TIDAK bisa di-PATCH — mengganti meter fisik harus lewat POST (supaya
// menghasilkan baris histori baru, bukan menimpa yang lama).
const updateMeterSchema = z.object({
  nomorSegel: z.string().trim().max(50).nullable().optional(),
  catatan: z.string().max(500).nullable().optional(),
})

meterRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", updateMeterSchema),
  async (c) => {
    const id = c.req.param("id")
    const existing = await prisma.meter.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("Meter")
    const row = await prisma.meter.update({
      where: { id },
      data: c.req.valid("json"),
    })
    return ok(c, row)
  },
)
