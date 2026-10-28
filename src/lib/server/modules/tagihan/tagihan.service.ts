// server/modules/tagihan/tagihan.service.ts — pembentukan tagihan air.
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
// Sekarang semuanya lewat @/lib/domain/tagihan, satu-satunya tempat
// rumus tagihan hidup, yang terbukti mereproduksi 22.516 dari 22.517
// tagihan periode 202605 (`pnpm db:verifikasi-tarif`).
import type { Prisma } from "@db"
import { prisma } from "@db"
import {
  hitungRincianHargaAir,
  hitungTotalTagihan,
  type RincianBlok,
} from "@/lib/domain/tagihan"
import { NotFoundError, ConflictError, BadRequestError } from "../../lib/errors"

export type { RincianBlok }

/// Hitung biaya air progresif untuk `pemakaianM3` memakai blok tarif yang
/// berlaku pada `periode`. Tipis saja — seluruh rumusnya ada di domain.
export function hitungBiayaAir(
  pemakaianM3: number,
  blokTarif: {
    blok: number
    batasAwalM3: number
    batasAkhirM3: number | null
    hargaPerM3: number
  }[],
): { total: number; rincian: RincianBlok[] } {
  return hitungRincianHargaAir(pemakaianM3, blokTarif)
}

export async function getBlokBerlaku(
  tx: Prisma.TransactionClient,
  tarifGolonganId: string,
  periode: Date,
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
  periode: Date,
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
    perUkuran: boolean,
  ): number => {
    const cocok = rows.find(
      (r) =>
        r.jenis === jenis &&
        (perUkuran ? r.ukuranMeter === ukuranMeter : r.ukuranMeter === null),
    )
    if (!cocok) {
      throw new BadRequestError(
        `Biaya tetap ${jenis}${perUkuran ? ` untuk ukuran meter ${ukuranMeter}` : ""} belum diatur untuk periode ${periode.toISOString().slice(0, 7)} — jalankan seed tarif atau isi lewat menu tarif dulu`,
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
        "Pelanggan belum punya golongan tarif — tidak bisa menghitung tagihan",
      )
    }

    const blok = await getBlokBerlaku(
      tx,
      pelanggan.tarifGolonganId,
      pembacaan.periode,
    )
    if (blok.length === 0) {
      throw new BadRequestError(
        `Tidak ada TarifBlok yang berlaku untuk golongan tarif pelanggan pada periode ${pembacaan.periode.toISOString().slice(0, 7)}`,
      )
    }

    const { total: jmlHargaAir, rincian } = hitungBiayaAir(
      pembacaan.pemakaianM3,
      blok,
    )

    // Biaya tetap diambil dari tabel BiayaTetap yang berlaku pada periode
    // ini, bukan dari angka mati di kode. Bea beban bergantung UKURAN METER
    // (terverifikasi dari data: 1/2"=7.000 s/d 4"=187.000) — versi lama file
    // ini memakai 7.000 untuk semua ukuran, yang berarti pelanggan bermeter
    // besar ditagih terlalu murah sampai ratusan ribu per bulan.
    const biaya = await getBiayaTetapBerlaku(
      tx,
      pembacaan.meter.ukuran,
      pembacaan.periode,
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
