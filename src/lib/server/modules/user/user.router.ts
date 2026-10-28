// server/modules/user/user.router.ts — manajemen akun internal.
//
// Dua aturan keamanan yang ditegakkan di sini:
// 1. passwordHash TIDAK PERNAH ikut di response manapun (pakai USER_SELECT).
// 2. User tidak boleh mengubah role/status DIRINYA SENDIRI — mencegah
//    SUPER_ADMIN terakhir mengunci dirinya keluar, sekaligus mencegah
//    eskalasi diam-diam. Perubahan role/status selalu tercatat di AuditLog.
//
// divisiKode/subBagianKode di User adalah DENORMALISASI dari divisiId/
// subBagianId dan dibaca langsung di JWT/session (auth.ts) — jadi setiap
// perubahan penempatan WAJIB menyinkronkan keduanya, kalau tidak session
// akan membawa kode organisasi yang basi. Sinkronisasi itu dilakukan di
// syncOrgKode() di bawah, bukan diserahkan ke pemanggil.
import { Hono } from "hono"
import { z } from "zod"
import { Role, UserStatus } from "@db"
import type { Prisma } from "@db"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../lib/errors"
import { recordAudit, auditMetaFromRequest } from "../../lib/audit"
import { lupakanSesi } from "../../middleware/sesi-hidup"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"

export const userRouter = new Hono()

/// Whitelist eksplisit — JANGAN diganti jadi `include`/spread model, supaya
/// passwordHash tidak pernah bocor ke response.
const USER_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  image: true,
  role: true,
  status: true,
  twoFactorEnabled: true,
  divisiId: true,
  bagianId: true,
  subBagianId: true,
  divisiKode: true,
  subBagianKode: true,
  lastLoginAt: true,
  loginCount: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

/// Ambil kode divisi/subBagian dari relasi id-nya, supaya field denormal
/// selalu konsisten dengan FK-nya.
async function syncOrgKode(input: {
  divisiId?: string | null
  subBagianId?: string | null
}) {
  const patch: { divisiKode?: string | null; subBagianKode?: string | null } =
    {}
  if (input.divisiId !== undefined) {
    if (input.divisiId === null) patch.divisiKode = null
    else {
      const divisi = await prisma.divisi.findUnique({
        where: { id: input.divisiId },
      })
      if (!divisi) throw new NotFoundError("Divisi")
      patch.divisiKode = divisi.kode
    }
  }
  if (input.subBagianId !== undefined) {
    if (input.subBagianId === null) patch.subBagianKode = null
    else {
      const sub = await prisma.subBagian.findUnique({
        where: { id: input.subBagianId },
      })
      if (!sub) throw new NotFoundError("SubBagian")
      patch.subBagianKode = sub.kode
    }
  }
  return patch
}

userRouter.get("/me", async (c) => {
  const requester = getSessionUser(c)
  const row = await prisma.user.findUnique({
    where: { id: requester.id },
    select: { ...USER_SELECT, divisi: true, bagian: true, subBagian: true },
  })
  if (!row) throw new NotFoundError("User")
  return ok(c, row)
})

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "name",
    "username",
    "email",
    "role",
    "status",
    "divisiKode",
    "lastLoginAt",
  ]),
  q: z.string().trim().min(1).optional(),
  role: z.enum(Role).optional(),
  status: z.enum(UserStatus).optional(),
  divisiId: z.string().optional(),
})

userRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      role: query.role,
      status: query.status,
      divisiId: query.divisiId,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { email: { contains: query.q, mode: "insensitive" as const } },
              { username: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { createdAt: "desc" }),
        select: USER_SELECT,
      }),
      prisma.user.count({ where }),
    ])
    return paginated(c, data, buildMeta(total, query))
  },
)

userRouter.get("/:id", requireRole(...ROLE_GROUPS.MANAGEMENT_UP), async (c) => {
  const row = await prisma.user.findUnique({
    where: { id: c.req.param("id") },
    select: { ...USER_SELECT, divisi: true, bagian: true, subBagian: true },
  })
  if (!row) throw new NotFoundError("User")
  return ok(c, row)
})

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.email(),
  username: z.string().trim().min(3).max(50).nullable().optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(Role).optional(),
  status: z.enum(UserStatus).optional(),
  divisiId: z.string().min(1).nullable().optional(),
  bagianId: z.string().min(1).nullable().optional(),
  subBagianId: z.string().min(1).nullable().optional(),
})

userRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", createSchema),
  async (c) => {
    const { password, ...body } = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    // Login Credentials butuh username + passwordHash; akun Google-only boleh
    // tanpa keduanya (lihat auth.ts).
    if (password && !body.username)
      throw new BadRequestError("username wajib diisi bila password diberikan")

    const orgKode = await syncOrgKode(body)
    const passwordHash = password ? await hashPassword(password) : undefined

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.user.create({
        data: { ...body, ...orgKode, passwordHash },
        select: USER_SELECT,
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "CREATE",
        entitas: "User",
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

// role & status TIDAK ada di sini — keduanya punya endpoint sendiri supaya
// selalu lewat pengecekan self-modification + audit khusus.
const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  email: z.email().optional(),
  username: z.string().trim().min(3).max(50).nullable().optional(),
  image: z.url().nullable().optional(),
  divisiId: z.string().min(1).nullable().optional(),
  bagianId: z.string().min(1).nullable().optional(),
  subBagianId: z.string().min(1).nullable().optional(),
})

userRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", updateSchema),
  async (c) => {
    const id = c.req.param("id")
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("User")

    const orgKode = await syncOrgKode(body)

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: { ...body, ...orgKode },
        select: USER_SELECT,
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "UPDATE",
        entitas: "User",
        entitasId: id,
        perubahan: { after: row },
        ipAddress,
        userAgent,
      })
      return row
    })
    return ok(c, row)
  },
)

userRouter.patch(
  "/:id/role",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", z.object({ role: z.enum(Role) })),
  async (c) => {
    const id = c.req.param("id")
    const { role } = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    if (id === requester.id)
      throw new ForbiddenError(
        "Anda tidak bisa mengubah role akun Anda sendiri",
      )

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("User")

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: { role },
        select: USER_SELECT,
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "UBAH_ROLE",
        entitas: "User",
        entitasId: id,
        perubahan: { before: { role: existing.role }, after: { role } },
        ipAddress,
        userAgent,
      })
      return row
    })
    return ok(c, row)
  },
)

userRouter.patch(
  "/:id/status",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", z.object({ status: z.enum(UserStatus) })),
  async (c) => {
    const id = c.req.param("id")
    const { status } = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    if (id === requester.id)
      throw new ForbiddenError(
        "Anda tidak bisa mengubah status akun Anda sendiri",
      )

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("User")

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: { status },
        select: USER_SELECT,
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "UBAH_STATUS",
        entitas: "User",
        entitasId: id,
        perubahan: { before: { status: existing.status }, after: { status } },
        ipAddress,
        userAgent,
      })
      return row
    })
    // Tanpa ini, penonaktifan baru terasa setelah TTL cache sesi-hidup habis.
    // Statusnya sudah tercatat; yang dilupakan hanya keputusan lama di memori.
    lupakanSesi(id)
    return ok(c, row)
  },
)

const passwordSchema = z.object({
  /// Wajib untuk ganti password sendiri. SUPER_ADMIN yang me-reset password
  /// orang lain tidak perlu tahu password lama.
  passwordLama: z.string().min(1).optional(),
  passwordBaru: z.string().min(8).max(100),
})

userRouter.patch(
  "/:id/password",
  validate("json", passwordSchema),
  async (c) => {
    const id = c.req.param("id")
    const { passwordLama, passwordBaru } = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const isSelf = id === requester.id
    if (!isSelf && requester.role !== "SUPER_ADMIN") {
      throw new ForbiddenError(
        "Hanya SUPER_ADMIN yang bisa mereset password akun lain",
      )
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("User")

    if (isSelf) {
      if (!existing.passwordHash)
        throw new BadRequestError(
          "Akun ini tidak memakai login password (OAuth-only)",
        )
      if (!passwordLama)
        throw new BadRequestError(
          "passwordLama wajib diisi saat mengubah password sendiri",
        )
      const cocok = await verifyPassword(existing.passwordHash, passwordLama)
      if (!cocok) throw new BadRequestError("Password lama tidak cocok")
    }

    const passwordHash = await hashPassword(passwordBaru)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash } })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: isSelf ? "GANTI_PASSWORD" : "RESET_PASSWORD",
        entitas: "User",
        entitasId: id,
        ipAddress,
        userAgent,
      })
    })

    return ok(c, { id, message: "Password berhasil diperbarui" })
  },
)
