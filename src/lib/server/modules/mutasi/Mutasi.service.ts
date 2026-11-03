// server/modules/mutasi/Mutasi.service.ts — logika bisnis mutasi sambungan
// (PB = Pasang Baru, PK = Pindah Kontrak). @@unique([pelangganId, periode, jenis])
// -> P2002 jadi 409 lewat errorHandler.
import { prisma } from "@db"
import type { SessionUser } from "../../lib/Sesi"
import { NotFoundError } from "../../lib/Galat"
import { recordAudit, auditMetaFromRequest } from "../../lib/Audit"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import {
  GEO,
  setPoint,
  getPointGeoJson,
  getPointGeoJsonMany,
} from "../../lib/Spatial"
import type { ListMutasiQuery, CreateMutasiInput } from "./Mutasi.schema"

export async function listMutasi(query: ListMutasiQuery) {
  const { skip, take } = buildSkipTake(query)
  const where = {
    pelangganId: query.pelangganId,
    jenis: query.jenis,
    periode: query.periode,
  }
  const [rows, total] = await Promise.all([
    prisma.mutasiPelanggan.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { createdAt: "desc" }),
      include: {
        pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
      },
    }),
    prisma.mutasiPelanggan.count({ where }),
  ])
  const koord = await getPointGeoJsonMany(
    prisma,
    GEO.mutasiPelanggan,
    rows.map((r) => r.id)
  )
  return {
    data: rows.map((r) => ({ ...r, koordinatMutasi: koord.get(r.id) ?? null })),
    meta: buildMeta(total, query),
  }
}

export async function getMutasiById(id: string) {
  const row = await prisma.mutasiPelanggan.findUnique({
    where: { id },
    include: {
      pelanggan: true,
      prosesOleh: { select: { id: true, name: true } },
    },
  })
  if (!row) throw new NotFoundError("MutasiPelanggan")
  return {
    ...row,
    koordinatMutasi: await getPointGeoJson(prisma, GEO.mutasiPelanggan, id),
  }
}

export async function createMutasi(
  input: CreateMutasiInput,
  requester: SessionUser,
  req: Request
) {
  const { koordinatMutasi, ...body } = input
  const { ipAddress, userAgent } = auditMetaFromRequest(req)

  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: body.pelangganId },
  })
  if (!pelanggan || pelanggan.deletedAt) throw new NotFoundError("Pelanggan")

  const row = await prisma.$transaction(async (tx) => {
    const row = await tx.mutasiPelanggan.create({
      data: { ...body, prosesOlehId: requester.id },
    })
    if (koordinatMutasi)
      await setPoint(
        tx,
        GEO.mutasiPelanggan,
        row.id,
        koordinatMutasi.lat,
        koordinatMutasi.lng
      )
    await recordAudit(tx, {
      userId: requester.id,
      aksi: `MUTASI_${body.jenis}`,
      entitas: "MutasiPelanggan",
      entitasId: row.id,
      perubahan: { after: row },
      ipAddress,
      userAgent,
    })
    return row
  })

  return {
    ...row,
    koordinatMutasi: koordinatMutasi
      ? {
          type: "Point" as const,
          coordinates: [koordinatMutasi.lng, koordinatMutasi.lat],
        }
      : null,
  }
}
