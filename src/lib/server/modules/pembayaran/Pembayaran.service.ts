// server/modules/pembayaran/Pembayaran.service.ts — logika bisnis dan kueri
// database untuk ledger pembayaran tunggal Tagihan (air) dan TagihanLain (non-air).
//
// Dua aturan yang WAJIB ditegakkan di sini karena database tidak bisa:
// 1. POLYMORPHIC XOR: tepat satu dari tagihanId/tagihanLainId harus terisi.
//    Prisma tidak punya relasi polymorphic native (lihat komentar model
//    RiwayatPembayaran), jadi divalidasi di zod + service ini.
// 2. IDEMPOTENSI: `kodeReferensi` unik = kunci idempoten untuk callback
//    PPOB/gateway yang bisa datang berkali-kali untuk transaksi yang sama.
//    P2002 -> 409 (bukan baris duplikat).
//
// Satu baris = satu PERCOBAAN bayar (termasuk PENDING/EXPIRED), bukan hanya
// yang berhasil. Status tagihan hanya berubah saat konfirmasi BERHASIL.
import { prisma } from "@db"
import { NotFoundError, BadRequestError, ConflictError } from "../../lib/Galat"
import { recordAudit } from "../../lib/Audit"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import type {
  ListPembayaranQuery,
  CreatePembayaranInput,
  KonfirmasiPembayaranInput,
} from "./Pembayaran.schema"

export async function listPembayaran(query: ListPembayaranQuery) {
  const { skip, take } = buildSkipTake(query)
  const where = {
    tagihanId: query.tagihanId,
    tagihanLainId: query.tagihanLainId,
    status: query.status,
    kanal: query.kanal,
  }
  const [data, total] = await Promise.all([
    prisma.riwayatPembayaran.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { createdAt: "desc" }),
    }),
    prisma.riwayatPembayaran.count({ where }),
  ])
  return {
    data,
    meta: buildMeta(total, query),
  }
}

export async function getPembayaranById(id: string) {
  const row = await prisma.riwayatPembayaran.findUnique({
    where: { id },
  })
  if (!row) throw new NotFoundError("RiwayatPembayaran")
  return row
}

export async function createPembayaran(body: CreatePembayaranInput) {
  // Pastikan tagihan tujuan ada & belum lunas sebelum mencatat percobaan bayar.
  if (body.tagihanId) {
    const t = await prisma.tagihan.findUnique({
      where: { id: body.tagihanId },
    })
    if (!t) throw new NotFoundError("Tagihan")
    if (t.status === "SUDAH_BAYAR")
      throw new ConflictError("Tagihan sudah lunas")
    if (t.status === "DIHAPUSKAN")
      throw new BadRequestError("Tagihan sudah dihapuskan, tidak bisa dibayar")
  } else {
    const t = await prisma.tagihanLain.findUnique({
      where: { id: body.tagihanLainId! },
    })
    if (!t) throw new NotFoundError("TagihanLain")
    if (t.status === "SUDAH_BAYAR")
      throw new ConflictError("Tagihan sudah lunas")
    if (t.status === "DIHAPUSKAN")
      throw new BadRequestError("Tagihan sudah dihapuskan, tidak bisa dibayar")
  }

  return prisma.riwayatPembayaran.create({
    data: {
      tagihanId: body.tagihanId ?? null,
      tagihanLainId: body.tagihanLainId ?? null,
      jumlahBayar: body.jumlahBayar,
      kanal: body.kanal,
      penyelenggara: body.penyelenggara ?? null,
      kodeReferensi: body.kodeReferensi,
      status: body.status ?? "PENDING",
      waktuBayar: body.waktuBayar ?? null,
      payloadCallback:
        body.payloadCallback === undefined
          ? undefined
          : JSON.parse(JSON.stringify(body.payloadCallback)),
    },
  })
}

/// Finalisasi satu percobaan bayar. Kalau BERHASIL: dalam SATU transaksi,
/// tandai ledger BERHASIL + set Tagihan/TagihanLain jadi SUDAH_BAYAR beserta
/// cache tanggalBayar-nya. Baris yang sudah final tidak bisa dikonfirmasi
/// ulang (idempotensi terhadap callback ganda dari gateway).
export async function konfirmasiPembayaran(
  id: string,
  input: KonfirmasiPembayaranInput,
  requesterId: string,
  auditMeta: { ipAddress: string | null; userAgent: string | null }
) {
  const { status, waktuBayar, payloadCallback } = input
  const { ipAddress, userAgent } = auditMeta

  const existing = await prisma.riwayatPembayaran.findUnique({
    where: { id },
  })
  if (!existing) throw new NotFoundError("RiwayatPembayaran")
  if (existing.status !== "PENDING") {
    throw new ConflictError(
      `Pembayaran ini sudah difinalisasi sebelumnya (status: ${existing.status})`
    )
  }

  const saatBayar = waktuBayar ?? new Date()

  return prisma.$transaction(async (tx) => {
    const row = await tx.riwayatPembayaran.update({
      where: { id },
      data: {
        status,
        waktuKonfirmasi: new Date(),
        waktuBayar: status === "BERHASIL" ? saatBayar : existing.waktuBayar,
        payloadCallback:
          payloadCallback === undefined
            ? undefined
            : JSON.parse(JSON.stringify(payloadCallback)),
      },
    })

    if (status === "BERHASIL") {
      if (row.tagihanId) {
        await tx.tagihan.update({
          where: { id: row.tagihanId },
          data: { status: "SUDAH_BAYAR", tanggalBayar: saatBayar },
        })
      } else if (row.tagihanLainId) {
        await tx.tagihanLain.update({
          where: { id: row.tagihanLainId },
          data: { status: "SUDAH_BAYAR", tanggalBayar: saatBayar },
        })
      }
    }

    await recordAudit(tx, {
      userId: requesterId,
      aksi: `PEMBAYARAN_${status}`,
      entitas: "RiwayatPembayaran",
      entitasId: id,
      perubahan: {
        kodeReferensi: row.kodeReferensi,
        jumlahBayar: row.jumlahBayar,
        tagihanId: row.tagihanId,
        tagihanLainId: row.tagihanLainId,
      },
      ipAddress,
      userAgent,
    })

    return row
  })
}
