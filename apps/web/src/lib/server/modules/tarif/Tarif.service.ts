// server/modules/tarif/Tarif.service.ts — logika bisnis dan kueri database
// untuk TarifGolongan dan TarifBlok (tarif progresif per blok konsumsi).
// Endpoint blok bukan CRUD generik: blok baru selalu INSERT (harga naik =
// baris baru dgn berlakuMulai baru), blok lama hanya boleh ditutup
// (`berlakuSampai`), tidak pernah diedit field lain — lihat komentar di
// TarifBlok (pelanggan.prisma).
import { prisma } from "@db"
import { NotFoundError } from "../../lib/Galat"
import { recordAudit } from "../../lib/Audit"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import type {
  ListTarifQuery,
  CreateTarifGolonganInput,
  UpdateTarifGolonganInput,
  CreateTarifBlokInput,
  CloseTarifBlokInput,
} from "./Tarif.schema"

export async function listTarifGolongan(query: ListTarifQuery) {
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
  return {
    data,
    meta: buildMeta(total, query),
  }
}

export async function getTarifGolonganById(id: string) {
  const row = await prisma.tarifGolongan.findUnique({
    where: { id },
    include: { blokTarif: { orderBy: { blok: "asc" } } },
  })
  if (!row) throw new NotFoundError("TarifGolongan")
  return row
}

export async function createTarifGolongan(data: CreateTarifGolonganInput) {
  return prisma.tarifGolongan.create({ data })
}

export async function updateTarifGolongan(
  id: string,
  data: UpdateTarifGolonganInput
) {
  const existing = await prisma.tarifGolongan.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("TarifGolongan")
  return prisma.tarifGolongan.update({
    where: { id },
    data,
  })
}

// Perubahan tarif = perubahan nominal yang ditagihkan ke seluruh pelanggan
// golongan ini -> tulisan paling berdampak finansial di sistem, wajib
// beraudit sama seperti mutasi Tagihan/Pembayaran.
export async function createTarifBlok(
  tarifGolonganId: string,
  body: CreateTarifBlokInput,
  requesterId: string,
  auditMeta: { ipAddress: string | null; userAgent: string | null }
) {
  const { ipAddress, userAgent } = auditMeta

  const existing = await prisma.tarifGolongan.findUnique({
    where: { id: tarifGolonganId },
  })
  if (!existing) throw new NotFoundError("TarifGolongan")

  return prisma.$transaction(async (tx) => {
    const row = await tx.tarifBlok.create({
      data: { ...body, tarifGolonganId },
    })
    await recordAudit(tx, {
      userId: requesterId,
      aksi: "TARIF_BLOK_BARU",
      entitas: "TarifBlok",
      entitasId: row.id,
      perubahan: { golongan: existing.kode, after: row },
      ipAddress,
      userAgent,
    })
    return row
  })
}

export async function closeTarifBlok(
  tarifGolonganId: string,
  blokId: string,
  data: CloseTarifBlokInput,
  requesterId: string,
  auditMeta: { ipAddress: string | null; userAgent: string | null }
) {
  const { ipAddress, userAgent } = auditMeta

  const blok = await prisma.tarifBlok.findUnique({ where: { id: blokId } })
  if (!blok || blok.tarifGolonganId !== tarifGolonganId)
    throw new NotFoundError("TarifBlok")

  return prisma.$transaction(async (tx) => {
    const row = await tx.tarifBlok.update({
      where: { id: blokId },
      data,
    })
    await recordAudit(tx, {
      userId: requesterId,
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
}
