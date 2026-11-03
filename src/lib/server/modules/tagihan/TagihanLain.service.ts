// server/modules/tagihan/TagihanLain.service.ts — logika bisnis dan kueri
// database untuk pungutan non-air insidental (TagihanLain).
import { prisma } from "@db"
import { NotFoundError, BadRequestError } from "../../lib/Galat"
import { recordAudit } from "../../lib/Audit"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import type {
  ListTagihanLainQuery,
  CreateTagihanLainInput,
  PatchTagihanLainStatusInput,
} from "./TagihanLain.schema"

export async function listTagihanLain(query: ListTagihanLainQuery) {
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
  return {
    data,
    meta: buildMeta(total, query),
  }
}

export async function getTagihanLainById(id: string) {
  const row = await prisma.tagihanLain.findUnique({
    where: { id },
    include: {
      pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
      riwayatPembayaran: true,
    },
  })
  if (!row) throw new NotFoundError("TagihanLain")
  return row
}

export async function createTagihanLain(
  body: CreateTagihanLainInput,
  requesterId: string,
  auditMeta: { ipAddress: string | null; userAgent: string | null }
) {
  const { ipAddress, userAgent } = auditMeta

  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: body.pelangganId },
  })
  if (!pelanggan || pelanggan.deletedAt) throw new NotFoundError("Pelanggan")

  return prisma.$transaction(async (tx) => {
    const row = await tx.tagihanLain.create({ data: body })
    await recordAudit(tx, {
      userId: requesterId,
      aksi: "CREATE",
      entitas: "TagihanLain",
      entitasId: row.id,
      perubahan: { after: row },
      ipAddress,
      userAgent,
    })
    return row
  })
}

export async function updateTagihanLainStatus(
  id: string,
  input: PatchTagihanLainStatusInput,
  requesterId: string,
  auditMeta: { ipAddress: string | null; userAgent: string | null }
) {
  const { status, catatan } = input
  const { ipAddress, userAgent } = auditMeta

  const existing = await prisma.tagihanLain.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("TagihanLain")
  if (existing.status === "SUDAH_BAYAR")
    throw new BadRequestError(
      "Tagihan yang sudah dibayar tidak bisa diubah statusnya lewat endpoint ini"
    )

  return prisma.$transaction(async (tx) => {
    const row = await tx.tagihanLain.update({
      where: { id },
      data: { status },
    })
    await recordAudit(tx, {
      userId: requesterId,
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
}
