// server/modules/tarif/tarif.router.ts — TarifGolongan + TarifBlok
// (tarif progresif per blok konsumsi). Endpoint blok bukan CRUD generik:
// blok baru selalu INSERT (harga naik = baris baru dgn berlakuMulai baru),
// blok lama hanya boleh ditutup (`berlakuSampai`), tidak pernah diedit
// field lain — lihat komentar di TarifBlok (pelanggan.prisma).
import { Hono } from "hono"
import { validate } from "../../lib/validate"
import { z } from "zod"
import { prisma } from "@db"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { recordAudit, auditMetaFromRequest } from "../../lib/audit"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError } from "../../lib/errors"
import {
  createTarifGolonganSchema,
  updateTarifGolonganSchema,
  createTarifBlokSchema,
  closeTarifBlokSchema,
} from "./tarif.schema"

export const tarifRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["kode", "kodeAsli", "nama", "kategori", "isActive"]),
  q: z.string().trim().min(1).optional(),
  // hanyaAktif=true: hanya blok tarif yang BERLAKU saat ini (berlakuMulai
  // <= now && (berlakuSampai null || > now)). Dipakai aplikasi mobile untuk
  // estimasi progresif — tanpa ini, golongan yang pernah ganti tarif membawa
  // blok generasi lama (nomor blok ganda) dan estimasi salah hitung. Dashboard
  // web tetap default menerima seluruh histori (audit/penagihan ulang).
  hanyaAktif: z.coerce.boolean().optional(),
})

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
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = query.q
      ? {
          OR: [
            { nama: { contains: query.q, mode: "insensitive" as const } },
            { kodeAsli: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}
    const now = new Date()
    const blokWhere = query.hanyaAktif
      ? {
          berlakuMulai: { lte: now },
          OR: [{ berlakuSampai: null }, { berlakuSampai: { gt: now } }],
        }
      : undefined
    const [data, total] = await Promise.all([
      prisma.tarifGolongan.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { kode: "asc" }),
        include: { blokTarif: { where: blokWhere, orderBy: { blok: "asc" } } },
      }),
      prisma.tarifGolongan.count({ where }),
    ])
    return paginated(c, data, buildMeta(total, query))
  },
)

tarifRouter.get("/:id", requireRole(...ROLE_GROUPS.LAPANGAN), async (c) => {
  const row = await prisma.tarifGolongan.findUnique({
    where: { id: c.req.param("id") },
    include: { blokTarif: { orderBy: { blok: "asc" } } },
  })
  if (!row) throw new NotFoundError("TarifGolongan")
  return ok(c, row)
})

tarifRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", createTarifGolonganSchema),
  async (c) => {
    const row = await prisma.tarifGolongan.create({ data: c.req.valid("json") })
    return created(c, row)
  },
)

tarifRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", updateTarifGolonganSchema),
  async (c) => {
    const id = c.req.param("id")
    const existing = await prisma.tarifGolongan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("TarifGolongan")
    const row = await prisma.tarifGolongan.update({
      where: { id },
      data: c.req.valid("json"),
    })
    return ok(c, row)
  },
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
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const existing = await prisma.tarifGolongan.findUnique({
      where: { id: tarifGolonganId },
    })
    if (!existing) throw new NotFoundError("TarifGolongan")

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.tarifBlok.create({
        data: { ...body, tarifGolonganId },
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "TARIF_BLOK_BARU",
        entitas: "TarifBlok",
        entitasId: row.id,
        perubahan: { golongan: existing.kode, after: row },
        ipAddress,
        userAgent,
      })
      return row
    })
    return created(c, row)
  },
)

tarifRouter.patch(
  "/:id/blok/:blokId",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", closeTarifBlokSchema),
  async (c) => {
    const { id: tarifGolonganId, blokId } = c.req.param()
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const blok = await prisma.tarifBlok.findUnique({ where: { id: blokId } })
    if (!blok || blok.tarifGolonganId !== tarifGolonganId)
      throw new NotFoundError("TarifBlok")

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.tarifBlok.update({
        where: { id: blokId },
        data: c.req.valid("json"),
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "TARIF_BLOK_DITUTUP",
        entitas: "TarifBlok",
        entitasId: blokId,
        perubahan: {
          before: { berlakuSampai: blok.berlakuSampai },
          after: { berlakuSampai: row.berlakuSampai },
        },
        ipAddress,
        userAgent,
      })
      return row
    })
    return ok(c, row)
  },
)
