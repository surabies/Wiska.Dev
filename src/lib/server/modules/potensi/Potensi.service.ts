// server/modules/potensi/Potensi.service.ts — logika bisnis prospek calon
// pelanggan hasil survei lapangan (titik rumah yang belum berlangganan).
import { prisma } from "@db"
import { NotFoundError } from "../../lib/Galat"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import {
  GEO,
  setPoint,
  clearPoint,
  getPointGeoJson,
  getPointGeoJsonMany,
  findNearby,
} from "../../lib/Spatial"
import type {
  ListPotensiQuery,
  NearPotensiQuery,
  CreatePotensiInput,
  UpdatePotensiInput,
} from "./Potensi.schema"

export async function findPotensiNear({
  lat,
  lng,
  radius,
  limit,
}: NearPotensiQuery) {
  const nearby = await findNearby(prisma, GEO.potensiPelanggan, {
    lat,
    lng,
    radiusMeters: radius,
    limit,
  })
  if (nearby.length === 0) return []
  const rows = await prisma.potensiPelanggan.findMany({
    where: { id: { in: nearby.map((r) => r.id) } },
    select: { id: true, alamat: true, status: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  return nearby.flatMap((r) => {
    const row = byId.get(r.id)
    return row ? [{ ...row, jarakMeter: r.jarakMeter }] : []
  })
}

export async function listPotensi(query: ListPotensiQuery) {
  const { skip, take } = buildSkipTake(query)
  const where = {
    status: query.status,
    ruteId: query.ruteId,
    kelurahanId: query.kelurahanId,
    ...(query.q
      ? { alamat: { contains: query.q, mode: "insensitive" as const } }
      : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.potensiPelanggan.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { createdAt: "desc" }),
      include: { kelurahan: { select: { id: true, nama: true } } },
    }),
    prisma.potensiPelanggan.count({ where }),
  ])
  const koord = await getPointGeoJsonMany(
    prisma,
    GEO.potensiPelanggan,
    rows.map((r) => r.id)
  )
  return {
    data: rows.map((r) => ({ ...r, koordinat: koord.get(r.id) ?? null })),
    meta: buildMeta(total, query),
  }
}

export async function getPotensiById(id: string) {
  const row = await prisma.potensiPelanggan.findUnique({
    where: { id },
    include: { kelurahan: true, rute: true },
  })
  if (!row) throw new NotFoundError("PotensiPelanggan")
  return {
    ...row,
    koordinat: await getPointGeoJson(prisma, GEO.potensiPelanggan, id),
  }
}

export async function createPotensi(input: CreatePotensiInput) {
  const { koordinat, ...body } = input
  const row = await prisma.$transaction(async (tx) => {
    const row = await tx.potensiPelanggan.create({ data: body })
    if (koordinat)
      await setPoint(
        tx,
        GEO.potensiPelanggan,
        row.id,
        koordinat.lat,
        koordinat.lng
      )
    return row
  })
  return {
    ...row,
    koordinat: koordinat
      ? { type: "Point" as const, coordinates: [koordinat.lng, koordinat.lat] }
      : null,
  }
}

export async function updatePotensi(id: string, input: UpdatePotensiInput) {
  const existing = await prisma.potensiPelanggan.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("PotensiPelanggan")
  const { koordinat, ...body } = input
  const row = await prisma.$transaction(async (tx) => {
    const row = await tx.potensiPelanggan.update({
      where: { id },
      data: body,
    })
    if (koordinat !== undefined) {
      if (koordinat === null) await clearPoint(tx, GEO.potensiPelanggan, id)
      else
        await setPoint(
          tx,
          GEO.potensiPelanggan,
          id,
          koordinat.lat,
          koordinat.lng
        )
    }
    return row
  })
  const finalKoordinat =
    koordinat !== undefined
      ? koordinat
        ? {
            type: "Point" as const,
            coordinates: [koordinat.lng, koordinat.lat],
          }
        : null
      : await getPointGeoJson(prisma, GEO.potensiPelanggan, id)
  return { ...row, koordinat: finalKoordinat }
}
