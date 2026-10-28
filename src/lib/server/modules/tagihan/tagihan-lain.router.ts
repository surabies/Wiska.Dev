// server/modules/tagihan/tagihan-lain.router.ts — pungutan non-air
// insidental (pasang baru, balik nama, ganti meter, denda, buka segel).
// Beda dari Tagihan: nominalnya memang ditentukan petugas (tidak ada tarif
// progresif yang bisa dihitung server), jadi `jumlah` diterima dari client
// — karena itu write-nya dibatasi SUPERVISOR ke atas dan tercatat di audit.
import { Hono } from "hono"
import { z } from "zod"
import { JenisTagihanLain, StatusTagihan } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError, BadRequestError } from "../../lib/errors"
import { recordAudit, auditMetaFromRequest } from "../../lib/audit"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"

export const tagihanLainRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["createdAt", "jenis", "jumlah", "status", "tanggalJatuhTempo"]),
  pelangganId: z.string().optional(),
  status: z.enum(StatusTagihan).optional(),
  jenis: z.enum(JenisTagihanLain).optional(),
})

tagihanLainRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      pelangganId: query.pelangganId,
      status: query.status,
      jenis: query.jenis,
    }
    const [data, total] = await Promise.all([
      prisma.tagihanLain.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { createdAt: "desc" }),
        include: {
          pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
        },
      }),
      prisma.tagihanLain.count({ where }),
    ])
    return paginated(c, data, buildMeta(total, query))
  },
)

tagihanLainRouter.get(
  "/:id",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const row = await prisma.tagihanLain.findUnique({
      where: { id: c.req.param("id") },
      include: {
        pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
        riwayatPembayaran: true,
      },
    })
    if (!row) throw new NotFoundError("TagihanLain")
    return ok(c, row)
  },
)

const createSchema = z.object({
  pelangganId: z.string().min(1),
  jenis: z.enum(JenisTagihanLain),
  deskripsi: z.string().trim().min(1).max(500),
  jumlah: z.coerce.number().int().min(1),
  tanggalJatuhTempo: z.coerce.date(),
})

tagihanLainRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createSchema),
  async (c) => {
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: body.pelangganId },
    })
    if (!pelanggan || pelanggan.deletedAt) throw new NotFoundError("Pelanggan")

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.tagihanLain.create({ data: body })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "CREATE",
        entitas: "TagihanLain",
        entitasId: row.id,
        perubahan: { after: row },
        ipAddress,
        userAgent,
      })
      return row
    })
    return created(c, row)
  },
)

// Sama seperti Tagihan: pelunasan hanya lewat modul pembayaran.
const patchStatusSchema = z.object({
  status: z.enum(["DIHAPUSKAN", "JATUH_TEMPO", "BELUM_BAYAR"]),
  catatan: z.string().trim().min(1).max(500),
})

tagihanLainRouter.patch(
  "/:id/status",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  validate("json", patchStatusSchema),
  async (c) => {
    const id = c.req.param("id")
    const { status, catatan } = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const existing = await prisma.tagihanLain.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("TagihanLain")
    if (existing.status === "SUDAH_BAYAR")
      throw new BadRequestError(
        "Tagihan yang sudah dibayar tidak bisa diubah statusnya lewat endpoint ini",
      )

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.tagihanLain.update({
        where: { id },
        data: { status },
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: `TAGIHAN_LAIN_STATUS_${status}`,
        entitas: "TagihanLain",
        entitasId: id,
        perubahan: {
          before: { status: existing.status },
          after: { status },
          catatan,
        },
        ipAddress,
        userAgent,
      })
      return row
    })
    return ok(c, row)
  },
)
