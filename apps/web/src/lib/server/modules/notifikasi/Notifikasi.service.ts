// server/modules/notifikasi/Notifikasi.service.ts — logika bisnis pengelolaan
// token perangkat push (FCM) dan inbox notifikasi in-app.

import { prisma } from "@db"
import { buildSkipTake, buildMeta } from "../../lib/Pagination"
import { NotFoundError } from "../../lib/Galat"
import type {
  DaftarTokenInput,
  HapusTokenInput,
  ListNotifikasiQuery,
} from "./Notifikasi.schema"

// Upsert by token: satu baris per perangkat fisik. Token bisa berpindah akun
// (perangkat dipakai bergantian) — upsert memindahkan kepemilikan ke user
// yang sedang login sekarang.
export async function daftarkanTokenPerangkat(
  userId: string,
  { token, platform }: DaftarTokenInput
) {
  return prisma.perangkatNotif.upsert({
    where: { token },
    create: { token, userId, platform: platform ?? "android" },
    update: {
      userId,
      platform: platform ?? "android",
      lastSeenAt: new Date(),
    },
    select: { id: true, platform: true },
  })
}

// Hanya token MILIK sendiri yang bisa dilepas (dipanggil saat logout).
export async function hapusTokenPerangkat(
  userId: string,
  { token }: HapusTokenInput
) {
  const hasil = await prisma.perangkatNotif.deleteMany({
    where: { token, userId },
  })
  return { deleted: hasil.count }
}

export async function listNotifikasi(
  userId: string,
  query: ListNotifikasiQuery
) {
  const { skip, take } = buildSkipTake(query)
  const where = {
    userId,
    ...(query.belumDibaca ? { dibacaAt: null } : {}),
  }
  const [data, total, belumDibaca] = await Promise.all([
    prisma.notifikasi.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notifikasi.count({ where }),
    prisma.notifikasi.count({ where: { userId, dibacaAt: null } }),
  ])
  // belumDibaca lewat variabel (bukan literal langsung) agar tidak kena
  // excess-property check terhadap PaginationMeta; ikut di objek meta respons.
  const meta = { ...buildMeta(total, query), belumDibaca }
  return { data, meta }
}

// Batasi ke milik sendiri lewat updateMany (bukan update by id) supaya tak
// bisa menandai notifikasi orang lain.
export async function tandaiNotifikasiDibaca(userId: string, id: string) {
  const hasil = await prisma.notifikasi.updateMany({
    where: { id, userId },
    data: { dibacaAt: new Date() },
  })
  if (hasil.count === 0) throw new NotFoundError("Notifikasi")
  return { updated: hasil.count }
}

export async function tandaiSemuaNotifikasiDibaca(userId: string) {
  const hasil = await prisma.notifikasi.updateMany({
    where: { userId, dibacaAt: null },
    data: { dibacaAt: new Date() },
  })
  return { updated: hasil.count }
}
