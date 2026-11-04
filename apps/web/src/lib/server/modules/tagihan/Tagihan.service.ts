// server/modules/tagihan/tagihan.service.ts — pembentukan dan pengelolaan tagihan air.
//
// PRINSIP: nominal tagihan SELALU dihitung ulang di server dari TarifBlok
// yang berlaku pada periode ybs — client tidak pernah bisa mengirim
// jmlHargaAir/totalTagihan. Perhitungan air memakai tarif PROGRESIF: tiap
// blok konsumsi punya harga/m3 sendiri dan yang dikenakan adalah harga
// masing-masing blok untuk porsi pemakaian yang jatuh di blok itu (bukan
// satu harga flat untuk seluruh pemakaian).
//
// RUMUSNYA TIDAK LAGI DITULIS DI SINI. Versi lama file ini punya salinan
// sendiri, dan salinan itu memakai `batasAwalM3` sebagai batas EKSKLUSIF
// (blok 0-10, 10-20, ...) sementara tabel TarifBlok diisi dengan batas
// INKLUSIF (1-10, 11-20, ...). Selisihnya satu m3 per blok — tidak terlihat
// saat membaca kode, tapi langsung salah begitu tagihan pertama terbit.
// Sekarang semuanya lewat @/lib/domain/Tagihan, satu-satunya tempat
// rumus tagihan hidup, yang terbukti mereproduksi 22.516 dari 22.517
// tagihan periode 202605 (`pnpm db:verifikasi-tarif`).
import type { Prisma } from "@db"
import { prisma } from "@db"
import {
  hitungRincianHargaAir,
  hitungTotalTagihan,
  type RincianBlok,
} from "@/lib/domain/Tagihan"
import { periodeToDate, dateToPeriode } from "@/lib/domain/Periode"
import { NotFoundError, ConflictError, BadRequestError } from "../../lib/Galat"
import { recordAudit } from "../../lib/Audit"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import type {
  ListTagihanQuery,
  DrdQuery,
  DrdRekapQuery,
  SimulasiTagihanInput,
  PatchTagihanStatusInput,
} from "./Tagihan.schema"

export type { RincianBlok }

// BigInt (Tagihan.nominalTunggak) tidak bisa di-JSON.stringify -> ubah ke
// string di boundary API. Presisinya wajib dipertahankan (tunggakan bisa
// ratusan juta rupiah), jadi string, bukan Number.
export function serializeTagihan<T extends { nominalTunggak?: bigint | null }>(
  row: T
) {
  return {
    ...row,
    nominalTunggak:
      row.nominalTunggak == null ? null : row.nominalTunggak.toString(),
  }
}

/// Hitung biaya air progresif untuk `pemakaianM3` memakai blok tarif yang
/// berlaku pada `periode`. Tipis saja — seluruh rumusnya ada di domain.
export function hitungBiayaAir(
  pemakaianM3: number,
  blokTarif: {
    blok: number
    batasAwalM3: number
    batasAkhirM3: number | null
    hargaPerM3: number
  }[]
): { total: number; rincian: RincianBlok[] } {
  return hitungRincianHargaAir(pemakaianM3, blokTarif)
}

export async function getBlokBerlaku(
  tx: Prisma.TransactionClient,
  tarifGolonganId: string,
  periode: Date
) {
  return tx.tarifBlok.findMany({
    where: {
      tarifGolonganId,
      berlakuMulai: { lte: periode },
      OR: [{ berlakuSampai: null }, { berlakuSampai: { gte: periode } }],
    },
    orderBy: [{ blok: "asc" }, { berlakuMulai: "desc" }],
  })
}

export interface BiayaTetapBerlaku {
  beaBeban: number
  beaAdmin: number
  airKotor: number
}

/// Komponen tagihan di luar harga air, untuk periode & ukuran meter tertentu.
/// BEA_BEBAN dicari per ukuran meter; BEA_ADMIN & AIR_KOTOR berlaku flat
/// (baris dengan ukuranMeter NULL).
///
/// Sengaja TIDAK punya nilai cadangan berupa angka mati: kalau tabelnya
/// kosong, itu berarti tarif belum diseed dan tagihan TIDAK BOLEH terbit
/// dengan angka karangan. Lebih baik gagal keras di sini daripada menagih
/// ribuan pelanggan dengan bea yang salah diam-diam.
export async function getBiayaTetapBerlaku(
  tx: Prisma.TransactionClient,
  ukuranMeter: string,
  periode: Date
): Promise<BiayaTetapBerlaku> {
  const rows = await tx.biayaTetap.findMany({
    where: {
      berlakuMulai: { lte: periode },
      OR: [{ berlakuSampai: null }, { berlakuSampai: { gte: periode } }],
    },
    orderBy: { berlakuMulai: "desc" },
  })

  const ambil = (
    jenis: "BEA_BEBAN" | "BEA_ADMIN" | "AIR_KOTOR",
    perUkuran: boolean
  ): number => {
    const cocok = rows.find(
      (r) =>
        r.jenis === jenis &&
        (perUkuran ? r.ukuranMeter === ukuranMeter : r.ukuranMeter === null)
    )
    if (!cocok) {
      throw new BadRequestError(
        `Biaya tetap ${jenis}${perUkuran ? ` untuk ukuran meter ${ukuranMeter}` : ""} belum diatur untuk periode ${periode.toISOString().slice(0, 7)} — jalankan seed tarif atau isi lewat menu tarif dulu`
      )
    }
    return cocok.nominal
  }

  return {
    beaBeban: ambil("BEA_BEBAN", true),
    beaAdmin: ambil("BEA_ADMIN", false),
    airKotor: ambil("AIR_KOTOR", false),
  }
}

export interface GenerateTagihanInput {
  pembacaanId: string
  beaBeban?: number
  beaAdmin?: number
  airKotor?: number
  lainLain?: number
  denda?: number
  tanggalJatuhTempo: Date
}

export async function generateTagihan(input: GenerateTagihanInput) {
  return prisma.$transaction(async (tx) => {
    const pembacaan = await tx.pembacaanMeter.findUnique({
      where: { id: input.pembacaanId },
      include: { meter: { include: { pelanggan: true } }, tagihan: true },
    })
    if (!pembacaan) throw new NotFoundError("PembacaanMeter")
    if (pembacaan.tagihan)
      throw new ConflictError("Pembacaan ini sudah punya tagihan")

    const pelanggan = pembacaan.meter.pelanggan
    if (pelanggan.deletedAt)
      throw new BadRequestError("Pelanggan sudah dihapus")
    if (!pelanggan.tarifGolonganId) {
      throw new BadRequestError(
        "Pelanggan belum punya golongan tarif — tidak bisa menghitung tagihan"
      )
    }

    const blok = await getBlokBerlaku(
      tx,
      pelanggan.tarifGolonganId,
      pembacaan.periode
    )
    if (blok.length === 0) {
      throw new BadRequestError(
        `Tidak ada TarifBlok yang berlaku untuk golongan tarif pelanggan pada periode ${pembacaan.periode.toISOString().slice(0, 7)}`
      )
    }
    const batasTertinggi = blok.reduce(
      (maks, b) =>
        b.batasAkhirM3 === null
          ? Number.POSITIVE_INFINITY
          : Math.max(maks, b.batasAkhirM3),
      0
    )
    if (pembacaan.pemakaianM3 > batasTertinggi) {
      throw new BadRequestError(
        `Pemakaian ${pembacaan.pemakaianM3} m3 melampaui blok tertinggi yang diatur pada TarifBlok golongan ini`
      )
    }

    const { total: jmlHargaAir, rincian } = hitungBiayaAir(
      pembacaan.pemakaianM3,
      blok
    )

    // Biaya tetap diambil dari tabel BiayaTetap yang berlaku pada periode
    // ini, bukan dari angka mati di kode. Bea beban bergantung UKURAN METER
    // (terverifikasi dari data: 1/2"=7.000 s/d 4"=187.000) — versi lama file
    // ini memakai 7.000 untuk semua ukuran, yang berarti pelanggan bermeter
    // besar ditagih terlalu murah sampai ratusan ribu per bulan.
    const biaya = await getBiayaTetapBerlaku(
      tx,
      pembacaan.meter.ukuran,
      pembacaan.periode
    )
    const beaBeban = input.beaBeban ?? biaya.beaBeban
    const beaAdmin = input.beaAdmin ?? biaya.beaAdmin
    const airKotor = input.airKotor ?? biaya.airKotor
    const lainLain = input.lainLain ?? 0
    const denda = input.denda ?? 0
    const totalTagihan =
      hitungTotalTagihan({
        jmlHargaAir,
        beaBeban,
        beaAdmin,
        airKotor,
        lainLain,
      }) + denda

    const tagihan = await tx.tagihan.create({
      data: {
        pelangganId: pelanggan.id,
        pembacaanId: pembacaan.id,
        tarifGolonganId: pelanggan.tarifGolonganId,
        periode: pembacaan.periode,
        pemakaianM3: pembacaan.pemakaianM3,
        jmlHargaAir,
        beaBeban,
        beaAdmin,
        airKotor,
        lainLain,
        denda,
        totalTagihan,
        tanggalJatuhTempo: input.tanggalJatuhTempo,
      },
    })

    return { ...tagihan, rincianBlok: rincian }
  })
}

export async function listTagihan(query: ListTagihanQuery) {
  const { skip, take } = buildSkipTake(query)
  const where = {
    pelangganId: query.pelangganId,
    status: query.status,
    periode: query.periode ? periodeToDate(query.periode) : undefined,
  }
  const [rows, total] = await Promise.all([
    prisma.tagihan.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { periode: "desc" }),
      include: {
        pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
      },
    }),
    prisma.tagihan.count({ where }),
  ])
  return {
    data: rows.map(serializeTagihan),
    meta: buildMeta(total, query),
  }
}

/// Baris DRD = Tagihan + identitas pelanggan selengkap kebutuhan cetakan
/// DRD (nomor langganan, nama, alamat, golongan tarif, rute) — berbeda dari
/// GET / yang include-nya minimal untuk daftar umum.
export async function listDrd(query: DrdQuery) {
  const { skip, take } = buildSkipTake(query)
  const where = {
    status: query.status,
    periode: query.periode ? periodeToDate(query.periode) : undefined,
    ...(query.q
      ? {
          pelanggan: {
            OR: [
              { nomorLangganan: { contains: query.q } },
              { nama: { contains: query.q, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.tagihan.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, [{ periode: "desc" }, { createdAt: "asc" }]),
      include: {
        pelanggan: {
          select: {
            id: true,
            nomorLangganan: true,
            nama: true,
            alamat: true,
            tarifGolongan: { select: { kodeAsli: true, nama: true } },
            rute: { select: { kode: true } },
          },
        },
      },
    }),
    prisma.tagihan.count({ where }),
  ])
  return {
    data: rows.map(serializeTagihan),
    meta: buildMeta(total, query),
  }
}

export async function getDrdRekap(query: DrdRekapQuery) {
  const { periode } = query
  const where = periode ? { periode: periodeToDate(periode) } : {}
  const [totalAgg, perStatus, periodes] = await Promise.all([
    prisma.tagihan.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        pemakaianM3: true,
        jmlHargaAir: true,
        denda: true,
        totalTagihan: true,
      },
    }),
    prisma.tagihan.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { totalTagihan: true },
    }),
    prisma.tagihan.groupBy({
      by: ["periode"],
      orderBy: { periode: "desc" },
      take: 24,
    }),
  ])
  return {
    totalRekening: totalAgg._count._all,
    totalPemakaianM3: totalAgg._sum.pemakaianM3 ?? 0,
    totalHargaAir: totalAgg._sum.jmlHargaAir ?? 0,
    totalDenda: totalAgg._sum.denda ?? 0,
    totalTagihan: totalAgg._sum.totalTagihan ?? 0,
    perStatus: perStatus.map((s) => ({
      status: s.status,
      jumlah: s._count._all,
      nominal: s._sum.totalTagihan ?? 0,
    })),
    periodes: periodes.map((p) => dateToPeriode(p.periode)),
  }
}

export async function getTagihanById(id: string) {
  const row = await prisma.tagihan.findUnique({
    where: { id },
    include: {
      pelanggan: {
        select: { id: true, nomorLangganan: true, nama: true, alamat: true },
      },
      pembacaan: true,
      riwayatPembayaran: { orderBy: { createdAt: "desc" } },
      validator: { select: { id: true, name: true } },
    },
  })
  if (!row) throw new NotFoundError("Tagihan")
  return serializeTagihan(row)
}

export async function simulasiTagihan(input: SimulasiTagihanInput) {
  const { tarifGolonganId, pemakaianM3, periode } = input
  const tanggal = periodeToDate(periode)
  const blok = await prisma.tarifBlok.findMany({
    where: {
      tarifGolonganId,
      berlakuMulai: { lte: tanggal },
      OR: [{ berlakuSampai: null }, { berlakuSampai: { gte: tanggal } }],
    },
  })
  if (blok.length === 0)
    throw new BadRequestError(
      "Tidak ada TarifBlok yang berlaku untuk golongan/periode tersebut"
    )
  const { total, rincian } = hitungBiayaAir(pemakaianM3, blok)
  return { pemakaianM3, jmlHargaAir: total, rincianBlok: rincian }
}

export async function updateTagihanStatus(
  id: string,
  input: PatchTagihanStatusInput,
  requesterId: string,
  auditMeta: { ipAddress: string | null; userAgent: string | null }
) {
  const { status, catatanValidasi } = input
  const { ipAddress, userAgent } = auditMeta

  const existing = await prisma.tagihan.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("Tagihan")
  if (existing.status === "SUDAH_BAYAR") {
    throw new BadRequestError(
      "Tagihan yang sudah dibayar tidak bisa diubah statusnya lewat endpoint ini"
    )
  }

  const row = await prisma.$transaction(async (tx) => {
    const row = await tx.tagihan.update({
      where: { id },
      data: {
        status,
        catatanValidasi,
        validatorId: requesterId,
        validasiAt: new Date(),
      },
    })
    await recordAudit(tx, {
      userId: requesterId,
      aksi: `TAGIHAN_STATUS_${status}`,
      entitas: "Tagihan",
      entitasId: id,
      perubahan: {
        before: { status: existing.status },
        after: { status },
        catatanValidasi,
      },
      ipAddress,
      userAgent,
    })
    return row
  })

  return serializeTagihan(row)
}
