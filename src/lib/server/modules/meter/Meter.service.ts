// server/modules/meter/Meter.service.ts — logika bisnis dan kueri database
// untuk aset meter fisik.
//
// Aturan inti: "hanya SATU meter aktif per pelanggan" TIDAK bisa ditegakkan
// di database (Prisma tidak punya sintaks partial unique index
// `WHERE isAktif = true`, lihat komentar model Meter di tagihan.prisma) —
// jadi ditegakkan DI SINI: pemasangan meter baru = satu transaksi yang
// menonaktifkan semua meter lama pelanggan lalu meng-insert baris baru.
// Baris lama TIDAK PERNAH ditimpa/dihapus (histori penggantian meter wajib
// utuh untuk audit).
import { prisma } from "@db"
import { NotFoundError } from "../../lib/Galat"
import { recordAudit } from "../../lib/Audit"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import type {
  ListMeterQuery,
  CreateMeterInput,
  UpdateMeterInput,
} from "./Meter.schema"

export async function listMeter(query: ListMeterQuery) {
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
  return {
    data,
    meta: buildMeta(total, query),
  }
}

export async function getMeterById(id: string) {
  const row = await prisma.meter.findUnique({
    where: { id },
    include: {
      pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
    },
  })
  if (!row) throw new NotFoundError("Meter")
  return row
}

// Pemasangan/penggantian meter. Meter lama otomatis jadi histori
// (isAktif=false) dalam transaksi yang sama.
export async function createMeter(
  body: CreateMeterInput,
  requesterId: string,
  auditMeta: { ipAddress: string | null; userAgent: string | null }
) {
  const { ipAddress, userAgent } = auditMeta

  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: body.pelangganId },
  })
  if (!pelanggan || pelanggan.deletedAt) throw new NotFoundError("Pelanggan")

  return prisma.$transaction(async (tx) => {
    const digantikan = await tx.meter.updateMany({
      where: { pelangganId: body.pelangganId, isAktif: true },
      data: { isAktif: false },
    })
    const row = await tx.meter.create({ data: { ...body, isAktif: true } })
    await recordAudit(tx, {
      userId: requesterId,
      aksi: digantikan.count > 0 ? "GANTI_METER" : "PASANG_METER",
      entitas: "Meter",
      entitasId: row.id,
      perubahan: { meterLamaDinonaktifkan: digantikan.count, after: row },
      ipAddress,
      userAgent,
    })
    return row
  })
}

export async function updateMeter(id: string, data: UpdateMeterInput) {
  const existing = await prisma.meter.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("Meter")
  return prisma.meter.update({
    where: { id },
    data,
  })
}
