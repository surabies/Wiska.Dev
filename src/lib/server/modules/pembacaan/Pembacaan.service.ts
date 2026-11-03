// server/modules/pembacaan/Pembacaan.service.ts — logika bisnis dan kueri
// database untuk PembacaanMeter resmi (hasil closing/verifikasi). Satu baris
// per meter per periode (@@unique([meterId, periode]) -> P2002 dipetakan jadi
// 409 oleh errorHandler).
import type { KondisiCatat } from "@db"
import { prisma } from "@db"
import { NotFoundError, BadRequestError } from "../../lib/Galat"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import { periodeToDate } from "@/lib/domain/Periode"
import type {
  ListPembacaanQuery,
  CreatePembacaanInput,
} from "./Pembacaan.schema"

/// Kondisi meter yang membuat stand mundur/tidak wajar itu SAH secara
/// lapangan (meter diganti, meter mundur, dst.) — untuk kondisi ini
/// validasi standAkhir >= standLalu sengaja dilewati.
const KONDISI_STAND_BOLEH_MUNDUR: readonly KondisiCatat[] = [
  "METER_RUSAK",
  "METER_MUNDUR",
  "METER_TERBALIK",
  "METER_MATI_ADA_AIR",
  "MUDA_KEMBALI",
  "LOS_METER",
  "DICABUT",
]

export async function listPembacaan(query: ListPembacaanQuery) {
  const { skip, take } = buildSkipTake(query)
  const where = {
    meterId: query.meterId,
    kondisi: query.kondisi,
    pencatatId: query.pencatatId,
    periode: query.periodeSebelum
      ? { lt: periodeToDate(query.periodeSebelum) }
      : query.periode
        ? periodeToDate(query.periode)
        : undefined,
    ...(query.pelangganId ? { meter: { pelangganId: query.pelangganId } } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.pembacaanMeter.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { periode: "desc" }),
      include: {
        meter: {
          select: {
            id: true,
            nomorMeter: true,
            pelanggan: {
              select: { id: true, nomorLangganan: true, nama: true },
            },
          },
        },
        pencatat: { select: { id: true, namaLapangan: true } },
      },
    }),
    prisma.pembacaanMeter.count({ where }),
  ])
  return {
    data,
    meta: buildMeta(total, query),
  }
}

export async function getPembacaanById(id: string) {
  const row = await prisma.pembacaanMeter.findUnique({
    where: { id },
    include: {
      meter: {
        include: {
          pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
        },
      },
      pencatat: true,
      tagihan: true,
    },
  })
  if (!row) throw new NotFoundError("PembacaanMeter")
  return row
}

export async function createPembacaan(input: CreatePembacaanInput) {
  const { periode, ...body } = input
  const meter = await prisma.meter.findUnique({ where: { id: body.meterId } })
  if (!meter) throw new NotFoundError("Meter")

  const kondisi = body.kondisi ?? "NORMAL"
  if (
    body.standAkhir < body.standLalu &&
    !KONDISI_STAND_BOLEH_MUNDUR.includes(kondisi)
  ) {
    throw new BadRequestError(
      `standAkhir (${body.standAkhir}) lebih kecil dari standLalu (${body.standLalu}) padahal kondisi ${kondisi}. ` +
        `Gunakan kondisi yang sesuai (mis. METER_RUSAK/METER_MUNDUR) bila memang meter bermasalah.`
    )
  }

  // pemakaianM3 dihitung SERVER, tidak diterima dari client — supaya angka
  // tagihan tidak pernah bergantung pada input yang bisa dimanipulasi.
  const pemakaianM3 = Math.max(0, body.standAkhir - body.standLalu)

  return prisma.pembacaanMeter.create({
    data: { ...body, kondisi, periode: periodeToDate(periode), pemakaianM3 },
  })
}
