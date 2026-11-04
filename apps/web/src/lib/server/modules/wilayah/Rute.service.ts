// server/modules/wilayah/Rute.service.ts — logika bisnis rute pencatatan meter
// dan pengaturan urutan kunjungan pelanggan dalam satu rute.
import { prisma } from "@db"
import { NotFoundError, BadRequestError } from "../../lib/Galat"
import { buildMeta, buildSkipTake } from "../../lib/Pagination"
import type {
  UrutanPelangganListQuery,
  UrutanPelangganInput,
} from "./Rute.schema"

// ── Daftar pelanggan terurut dalam satu rute ───────────────────────────
export async function listPelangganUrutanRute(
  ruteId: string,
  query: UrutanPelangganListQuery
) {
  const { skip, take } = buildSkipTake(query)
  const rute = await prisma.rute.findUnique({
    where: { id: ruteId },
    select: { id: true },
  })
  if (!rute) throw new NotFoundError("Rute")
  const where = {
    ruteId,
    deletedAt: null,
    ...(query.q
      ? {
          OR: [
            { nomorLangganan: { contains: query.q } },
            { nama: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.pelanggan.findMany({
      where,
      orderBy: [{ noUrutRute: "asc" }, { nomorLangganan: "asc" }],
      skip,
      take,
      select: {
        id: true,
        nomorLangganan: true,
        nama: true,
        noUrutRute: true,
      },
    }),
    prisma.pelanggan.count({ where }),
  ])
  return { data: rows, meta: buildMeta(total, query) }
}

// Urutan kunjungan pelanggan DALAM satu rute (Pelanggan.noUrutRute) — diatur
// dari halaman Pemetaan Rute dashboard. `pelangganIds` = urutan baru; tiap
// pelanggan diberi noUrutRute sesuai indeks (1-based). Dibaca mobile lewat
// pengurutan di rute-saya.
export async function updateUrutanPelangganRute(
  ruteId: string,
  { pelangganIds }: UrutanPelangganInput
) {
  const rute = await prisma.rute.findUnique({
    where: { id: ruteId },
    select: { id: true },
  })
  if (!rute) throw new NotFoundError("Rute")

  // Semua id harus milik rute ini — cegah menata ulang pelanggan rute lain.
  const milik = await prisma.pelanggan.findMany({
    where: { ruteId, deletedAt: null },
    select: { id: true },
  })
  const setMilik = new Set(milik.map((m) => m.id))
  if (
    pelangganIds.length !== setMilik.size ||
    new Set(pelangganIds).size !== pelangganIds.length ||
    !pelangganIds.every((id) => setMilik.has(id))
  ) {
    throw new BadRequestError(
      "Daftar pelanggan tidak cocok dengan pelanggan aktif pada rute ini"
    )
  }
  await prisma.$transaction(
    pelangganIds.map((id, i) =>
      prisma.pelanggan.update({ where: { id }, data: { noUrutRute: i + 1 } })
    )
  )
  return { ruteId, jumlah: pelangganIds.length }
}
