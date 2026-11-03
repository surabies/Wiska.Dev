// server/modules/user/Pengguna.service.ts — logika bisnis manajemen akun internal.
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
import type { Prisma } from "@db"
import { prisma } from "@db"
import { hashPassword, verifyPassword } from "@/lib/auth/Sandi"
import type { SessionUser } from "../../lib/Sesi"
import { NotFoundError, BadRequestError, ForbiddenError } from "../../lib/Galat"
import { recordAudit, auditMetaFromRequest } from "../../lib/Audit"
import { lupakanSesi } from "../../middleware/SesiHidup"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import type {
  ListPenggunaQuery,
  CreatePenggunaInput,
  UpdatePenggunaInput,
  UpdateRoleInput,
  UpdateStatusInput,
  PasswordInput,
} from "./Pengguna.schema"

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

export async function getMe(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...USER_SELECT, divisi: true, bagian: true, subBagian: true },
  })
  if (!row) throw new NotFoundError("User")
  return row
}

export async function listPengguna(query: ListPenggunaQuery) {
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
  return { data, meta: buildMeta(total, query) }
}

export async function getPenggunaById(id: string) {
  const row = await prisma.user.findUnique({
    where: { id },
    select: { ...USER_SELECT, divisi: true, bagian: true, subBagian: true },
  })
  if (!row) throw new NotFoundError("User")
  return row
}

export async function createPengguna(
  input: CreatePenggunaInput,
  requester: SessionUser,
  req: Request
) {
  const { password, ...body } = input
  const { ipAddress, userAgent } = auditMetaFromRequest(req)

  // Login Credentials butuh username + passwordHash; akun Google-only boleh
  // tanpa keduanya (lihat auth.ts).
  if (password && !body.username)
    throw new BadRequestError("username wajib diisi bila password diberikan")

  const orgKode = await syncOrgKode(body)
  const passwordHash = password ? await hashPassword(password) : undefined

  return prisma.$transaction(async (tx) => {
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
}

export async function updatePengguna(
  id: string,
  body: UpdatePenggunaInput,
  requester: SessionUser,
  req: Request
) {
  const { ipAddress, userAgent } = auditMetaFromRequest(req)

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("User")

  const orgKode = await syncOrgKode(body)

  return prisma.$transaction(async (tx) => {
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
}

export async function updatePenggunaRole(
  id: string,
  { role }: UpdateRoleInput,
  requester: SessionUser,
  req: Request
) {
  const { ipAddress, userAgent } = auditMetaFromRequest(req)

  if (id === requester.id)
    throw new ForbiddenError("Anda tidak bisa mengubah role akun Anda sendiri")

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("User")

  return prisma.$transaction(async (tx) => {
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
}

export async function updatePenggunaStatus(
  id: string,
  { status }: UpdateStatusInput,
  requester: SessionUser,
  req: Request
) {
  const { ipAddress, userAgent } = auditMetaFromRequest(req)

  if (id === requester.id)
    throw new ForbiddenError(
      "Anda tidak bisa mengubah status akun Anda sendiri"
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
  return row
}

export async function updatePenggunaPassword(
  id: string,
  { passwordLama, passwordBaru }: PasswordInput,
  requester: SessionUser,
  req: Request
) {
  const { ipAddress, userAgent } = auditMetaFromRequest(req)

  const isSelf = id === requester.id
  if (!isSelf && requester.role !== "SUPER_ADMIN") {
    throw new ForbiddenError(
      "Hanya SUPER_ADMIN yang bisa mereset password akun lain"
    )
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("User")

  if (isSelf) {
    if (!existing.passwordHash)
      throw new BadRequestError(
        "Akun ini tidak memakai login password (OAuth-only)"
      )
    if (!passwordLama)
      throw new BadRequestError(
        "passwordLama wajib diisi saat mengubah password sendiri"
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

  return { id, message: "Password berhasil diperbarui" }
}
