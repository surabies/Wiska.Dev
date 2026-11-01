import type { Prisma } from "@db"
import { prisma } from "@db"
import { dateToPeriode, periodeToDate } from "../../lib/periode"
import { ConflictError } from "../../lib/errors"
import { recordAudit } from "../../lib/audit"
import { pilihPemakaianLalu } from "@/lib/domain/pemakaian-lalu"

function periodeSebelumnya(periode: number) {
  const date = periodeToDate(periode)
  date.setUTCMonth(date.getUTCMonth() - 1)
  return dateToPeriode(date)
}

export async function ambilPemakaianPeriodeSebelumnya(
  baris: { pelangganId: string | null; periode: number }[],
) {
  const periodePelanggan = new Map<number, Set<string>>()
  for (const row of baris) {
    if (!row.pelangganId) continue
    const pelanggan = periodePelanggan.get(row.periode) ?? new Set<string>()
    pelanggan.add(row.pelangganId)
    periodePelanggan.set(row.periode, pelanggan)
  }

  const hasil = new Map<string, number>()
  const queries = [...periodePelanggan].flatMap(([periode, pelangganIds]) => {
    const ids = [...pelangganIds]
    const sebelumnya = periodeSebelumnya(periode)
    const kunciPeriode = `${periode}:`
    return Array.from({ length: Math.ceil(ids.length / 500) }, (_, index) =>
      prisma.pembacaanMeter
        .findMany({
          where: {
            periode: periodeToDate(sebelumnya),
            meter: { pelangganId: { in: ids.slice(index * 500, (index + 1) * 500) } },
          },
          orderBy: { createdAt: "desc" },
          select: {
            pemakaianM3: true,
            meter: { select: { pelangganId: true } },
          },
        })
        .then((rows) => {
          for (const row of rows) {
            const key = `${kunciPeriode}${row.meter.pelangganId}`
            if (!hasil.has(key)) hasil.set(key, row.pemakaianM3)
          }
        }),
    )
  })
  await Promise.all(queries)
  return hasil
}

type SumberPembacaan = "PETUGAS" | "KONSUMEN"

type InputPembacaanResmi = {
  pelangganId: string | null
  nomorLangganan: string
  meterId: string
  periode: number
  sumber: SumberPembacaan
  laporanId: string
  aktor: {
    userId: string
    ipAddress: string | null
    userAgent: string | null
  }
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
      standLalu: true,
      standAkhir: true,
      pemakaianM3: true,
      pemakaianRiil: true,
      alasanTaksir: true,
      blokTarif: true,
      pemakaianLalu: true,
      blokTarifLalu: true,
      kondisi: true,
      kategori: true,
      pencatatId: true,
      tanggalCatat: true,
      fotoBukti: true,
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
  const alasanPenggantian = `Pembacaan resmi digantikan oleh laporan ${
    input.sumber === "KONSUMEN" ? "Mandiri" : "Petugas"
  } terbaru.`

  if (reusable) {
    await recordAudit(tx, {
      userId: input.aktor.userId,
      aksi: "PEMBACAAN_RESMI_DIGANTI",
      entitas: "PembacaanMeter",
      entitasId: reusable.id,
      perubahan: {
        alasan: alasanPenggantian,
        sumberBaru: input.sumber,
        laporanBaruId: input.laporanId,
        sebelum: {
          ...reusable,
          tanggalCatat: reusable.tanggalCatat?.toISOString() ?? null,
        },
        sesudah: {
          id: pembacaan.id,
          meterId: input.meterId,
          periode: periode.toISOString(),
          ...input.data,
        },
      },
      ipAddress: input.aktor.ipAddress,
      userAgent: input.aktor.userAgent,
    })
  }

  if (input.nomorLangganan) {
    const cocokPetugas = input.pelangganId
      ? {
          OR: [
            { pelangganId: input.pelangganId },
            { pelangganId: null, nomorLangganan: input.nomorLangganan },
          ],
        }
      : { nomorLangganan: input.nomorLangganan }
    const cocokMandiri = input.pelangganId
      ? { pelangganId: input.pelangganId }
      : { nomorLangganan: input.nomorLangganan }
    const [laporanPetugasLama, laporanMandiriLama] = await Promise.all([
      tx.laporanHarianPetugas.findMany({
        where: {
          periode: input.periode,
          id: { not: input.laporanId },
          AND: [
            cocokPetugas,
            {
              OR: [
                { isVerified: true },
                { verif3At: { not: null } },
                { pembacaanId: { not: null } },
              ],
            },
          ],
        },
        select: {
          id: true,
          pelangganId: true,
          nomorLangganan: true,
          isVerified: true,
          verifiedAt: true,
          verifiedById: true,
          verif1At: true,
          verif1ById: true,
          verif2At: true,
          verif2ById: true,
          verif3At: true,
          verif3ById: true,
          pembacaanId: true,
          catatanVerif: true,
          pemakaianTagihVerif: true,
          blokTarifVerif: true,
          meterVerifId: true,
          standAkhirRevisi: true,
          standAwalRevisi: true,
          kondisiRevisi: true,
          standAngkatLama: true,
          standAwalMeterBaru: true,
        },
      }),
      tx.laporanMandiri.findMany({
        where: {
          periode: input.periode,
          id: { not: input.laporanId },
          AND: [
            cocokMandiri,
            {
              OR: [
                { status: { in: ["DIVERIFIKASI", "DIGUNAKAN"] } },
                { pembacaanId: { not: null } },
              ],
            },
          ],
        },
        select: {
          id: true,
          status: true,
          verifiedAt: true,
          verifiedById: true,
          pembacaanId: true,
        },
      }),
    ])

    if (laporanPetugasLama.length > 0) {
      await tx.laporanHarianPetugas.updateMany({
        where: { id: { in: laporanPetugasLama.map((row) => row.id) } },
        data: {
          ...(input.pelangganId
            ? {
                pelangganId: input.pelangganId,
              }
            : {}),
          isVerified: false,
          verifiedAt: null,
          verifiedById: null,
          verif1At: null,
          verif1ById: null,
          verif2At: null,
          verif2ById: null,
          verif3At: null,
          verif3ById: null,
          pembacaanId: null,
          catatanVerif: null,
          pemakaianTagihVerif: null,
          blokTarifVerif: null,
          meterVerifId: null,
          standAkhirRevisi: null,
          standAwalRevisi: null,
          kondisiRevisi: null,
          standAngkatLama: null,
          standAwalMeterBaru: null,
        },
      })
      for (const row of laporanPetugasLama) {
        await recordAudit(tx, {
          userId: input.aktor.userId,
          aksi: "HASIL_RESMI_DIGANTI_KEMBALI_ANTREAN",
          entitas: "LaporanHarianPetugas",
          entitasId: row.id,
          perubahan: {
            alasan: alasanPenggantian,
            sebelum: {
              ...row,
              verifiedAt: row.verifiedAt?.toISOString() ?? null,
              verif1At: row.verif1At?.toISOString() ?? null,
              verif2At: row.verif2At?.toISOString() ?? null,
              verif3At: row.verif3At?.toISOString() ?? null,
            },
            sesudah: {
              isVerified: false,
              verifiedAt: null,
              verifiedById: null,
              verif1At: null,
              verif1ById: null,
              verif2At: null,
              verif2ById: null,
              verif3At: null,
              verif3ById: null,
              pembacaanId: null,
              catatanVerif: null,
              pemakaianTagihVerif: null,
              blokTarifVerif: null,
              meterVerifId: null,
              standAkhirRevisi: null,
              standAwalRevisi: null,
              kondisiRevisi: null,
              standAngkatLama: null,
              standAwalMeterBaru: null,
            },
          },
          ipAddress: input.aktor.ipAddress,
          userAgent: input.aktor.userAgent,
        })
      }
    }

    if (laporanMandiriLama.length > 0) {
      await tx.laporanMandiri.updateMany({
        where: { id: { in: laporanMandiriLama.map((row) => row.id) } },
        data: {
          status: "MENUNGGU",
          verifiedAt: null,
          verifiedById: null,
          alasanDitolak: null,
          pembacaanId: null,
        },
      })
      for (const row of laporanMandiriLama) {
        await recordAudit(tx, {
          userId: input.aktor.userId,
          aksi: "HASIL_RESMI_DIGANTI_KEMBALI_ANTREAN",
          entitas: "LaporanMandiri",
          entitasId: row.id,
          perubahan: {
            alasan: alasanPenggantian,
            sebelum: {
              ...row,
              verifiedAt: row.verifiedAt?.toISOString() ?? null,
            },
            sesudah: {
              status: "MENUNGGU",
              verifiedAt: null,
              verifiedById: null,
              alasanDitolak: null,
              pembacaanId: null,
            },
          },
          ipAddress: input.aktor.ipAddress,
          userAgent: input.aktor.userAgent,
        })
      }
    }
  }

  const obsoleteIds = existing
    .filter((row) => row.id !== pembacaan.id)
    .map((row) => row.id)
  if (obsoleteIds.length > 0) {
    for (const row of existing.filter((item) => obsoleteIds.includes(item.id))) {
      await recordAudit(tx, {
        userId: input.aktor.userId,
        aksi: "PEMBACAAN_RESMI_DIHAPUS_SAAT_PENGGANTIAN",
        entitas: "PembacaanMeter",
        entitasId: row.id,
        perubahan: {
          alasan: alasanPenggantian,
          sumberBaru: input.sumber,
          laporanBaruId: input.laporanId,
          sebelum: {
            ...row,
            tanggalCatat: row.tanggalCatat?.toISOString() ?? null,
          },
        },
        ipAddress: input.aktor.ipAddress,
        userAgent: input.aktor.userAgent,
      })
    }
    await tx.pembacaanMeter.deleteMany({
      where: { id: { in: obsoleteIds } },
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
