import type { Prisma } from "@db"
import { prisma } from "@db"
import { ConflictError } from "../../lib/errors"
import { periodeToDate } from "../../lib/periode"

type SumberPembacaan = "PETUGAS" | "KONSUMEN"

type InputPembacaanResmi = {
  pelangganId: string | null
  meterId: string
  periode: number
  sumber: SumberPembacaan
  laporanId: string
  data: Omit<Prisma.PembacaanMeterUncheckedCreateInput, "meterId" | "periode">
}

/// Satu pembacaan resmi per pelanggan/periode. Verifikasi terbaru menjadi
/// sumber yang menang; laporan dari jalur lain tetap tersimpan sebagai jejak.
export async function simpanPembacaanResmi(
  tx: Prisma.TransactionClient,
  input: InputPembacaanResmi,
) {
  const periode = periodeToDate(input.periode)
  const periodeTerkunci = await tx.periodePenagihan.findUnique({
    where: { periode: input.periode },
    select: { status: true },
  })
  if (periodeTerkunci?.status === "TERKUNCI") {
    throw new ConflictError("Periode sudah ditutup; pembacaan resmi tidak dapat diubah.")
  }

  const existing = await tx.pembacaanMeter.findMany({
    where: {
      periode,
      meter: input.pelangganId
        ? { pelangganId: input.pelangganId }
        : { id: input.meterId },
    },
    select: {
      id: true,
      meterId: true,
      tagihan: { select: { id: true } },
    },
  })
  if (existing.some((row) => row.tagihan)) {
    throw new ConflictError(
      "Pembacaan periode ini sudah digunakan tagihan dan tidak dapat diganti.",
    )
  }

  const target = existing.find((row) => row.meterId === input.meterId)
  const reusable = target ?? existing[0]
  const data = { ...input.data, meterId: input.meterId, periode }
  const pembacaan = reusable
    ? await tx.pembacaanMeter.update({
        where: { id: reusable.id },
        data,
      })
    : await tx.pembacaanMeter.create({ data })

  const obsoleteIds = existing
    .filter((row) => row.id !== pembacaan.id)
    .map((row) => row.id)
  if (obsoleteIds.length > 0) {
    await tx.laporanHarianPetugas.updateMany({
      where: { pembacaanId: { in: obsoleteIds } },
      data: { pembacaanId: null },
    })
    await tx.laporanMandiri.updateMany({
      where: { pembacaanId: { in: obsoleteIds }, status: "DIGUNAKAN" },
      data: { pembacaanId: null, status: "DIVERIFIKASI" },
    })
    await tx.pembacaanMeter.deleteMany({
      where: { id: { in: obsoleteIds } },
    })
  }

  if (input.sumber === "PETUGAS") {
    if (input.pelangganId) {
      await tx.laporanMandiri.updateMany({
        where: {
          pelangganId: input.pelangganId,
          periode: input.periode,
          pembacaanId: pembacaan.id,
          id: { not: input.laporanId },
          status: "DIGUNAKAN",
        },
        data: { pembacaanId: null, status: "DIVERIFIKASI" },
      })
    }
  } else if (input.pelangganId) {
    await tx.laporanHarianPetugas.updateMany({
      where: {
        pelangganId: input.pelangganId,
        periode: input.periode,
        pembacaanId: pembacaan.id,
        id: { not: input.laporanId },
      },
      data: { pembacaanId: null },
    })
  }

  return pembacaan
}

export async function ambilPembacaanResmi(
  baris: { pelangganId: string | null; periode: number }[],
) {
  const perPeriode = new Map<number, Set<string>>()
  for (const row of baris) {
    if (!row.pelangganId) continue
    const ids = perPeriode.get(row.periode) ?? new Set<string>()
    ids.add(row.pelangganId)
    perPeriode.set(row.periode, ids)
  }

  const queries = []
  for (const [thbl, ids] of perPeriode) {
    const daftarId = [...ids]
    for (let offset = 0; offset < daftarId.length; offset += 500) {
      queries.push(
        prisma.pembacaanMeter.findMany({
          where: {
            periode: periodeToDate(thbl),
            meter: { pelangganId: { in: daftarId.slice(offset, offset + 500) } },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            meterId: true,
            periode: true,
            standLalu: true,
            standAkhir: true,
            pemakaianRiil: true,
            pemakaianM3: true,
            pemakaianLalu: true,
            kondisi: true,
            meter: { select: { pelangganId: true } },
            laporanHarian: { select: { id: true } },
            laporanMandiri: { select: { id: true } },
          },
        }),
      )
    }
  }
  return (await Promise.all(queries)).flat()
}

export function denganSumberResmi<T extends object>(
  row: T | null | undefined,
) {
  if (!row) return row ?? null
  return {
    ...row,
    sumberLaporan:
      "laporanHarian" in row && row.laporanHarian
        ? "PETUGAS"
        : "laporanMandiri" in row && row.laporanMandiri
          ? "KONSUMEN"
          : null,
  } as const
}
