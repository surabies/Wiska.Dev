// server/modules/pembayaran/pembayaran.router.ts — ledger pembayaran
// tunggal untuk Tagihan (air) DAN TagihanLain (non-air).
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
import { Hono } from "hono"
import { z } from "zod"
import { KanalPembayaran, StatusPembayaran } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError, BadRequestError, ConflictError } from "../../lib/errors"
import { recordAudit, auditMetaFromRequest } from "../../lib/audit"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"

export const pembayaranRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "jumlahBayar",
    "status",
    "kanal",
    "waktuBayar",
    "kodeReferensi",
  ]),
  tagihanId: z.string().optional(),
  tagihanLainId: z.string().optional(),
  status: z.enum(StatusPembayaran).optional(),
  kanal: z.enum(KanalPembayaran).optional(),
})

pembayaranRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
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
    return paginated(c, data, buildMeta(total, query))
  },
)

pembayaranRouter.get(
  "/:id",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const row = await prisma.riwayatPembayaran.findUnique({
      where: { id: c.req.param("id") },
    })
    if (!row) throw new NotFoundError("RiwayatPembayaran")
    return ok(c, row)
  },
)

const createSchema = z
  .object({
    tagihanId: z.string().min(1).optional(),
    tagihanLainId: z.string().min(1).optional(),
    jumlahBayar: z.coerce.number().int().min(1),
    kanal: z.enum(KanalPembayaran),
    penyelenggara: z.string().trim().max(100).nullable().optional(),
    kodeReferensi: z.string().trim().min(1).max(100),
    status: z.enum(StatusPembayaran).optional(),
    waktuBayar: z.coerce.date().nullable().optional(),
    payloadCallback: z.unknown().optional(),
  })
  .refine((d) => (d.tagihanId ? 1 : 0) + (d.tagihanLainId ? 1 : 0) === 1, {
    message:
      "Tepat satu dari tagihanId atau tagihanLainId wajib diisi (tidak boleh keduanya, tidak boleh kosong)",
    path: ["tagihanId"],
  })

pembayaranRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createSchema),
  async (c) => {
    const body = c.req.valid("json")

    // Pastikan tagihan tujuan ada & belum lunas sebelum mencatat percobaan bayar.
    if (body.tagihanId) {
      const t = await prisma.tagihan.findUnique({
        where: { id: body.tagihanId },
      })
      if (!t) throw new NotFoundError("Tagihan")
      if (t.status === "SUDAH_BAYAR")
        throw new ConflictError("Tagihan sudah lunas")
      if (t.status === "DIHAPUSKAN")
        throw new BadRequestError(
          "Tagihan sudah dihapuskan, tidak bisa dibayar",
        )
    } else {
      const t = await prisma.tagihanLain.findUnique({
        where: { id: body.tagihanLainId! },
      })
      if (!t) throw new NotFoundError("TagihanLain")
      if (t.status === "SUDAH_BAYAR")
        throw new ConflictError("Tagihan sudah lunas")
      if (t.status === "DIHAPUSKAN")
        throw new BadRequestError(
          "Tagihan sudah dihapuskan, tidak bisa dibayar",
        )
    }

    const row = await prisma.riwayatPembayaran.create({
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
    return created(c, row)
  },
)

const konfirmasiSchema = z.object({
  status: z.enum(["BERHASIL", "GAGAL", "EXPIRED"]),
  waktuBayar: z.coerce.date().optional(),
  payloadCallback: z.unknown().optional(),
})

/// Finalisasi satu percobaan bayar. Kalau BERHASIL: dalam SATU transaksi,
/// tandai ledger BERHASIL + set Tagihan/TagihanLain jadi SUDAH_BAYAR beserta
/// cache tanggalBayar-nya. Baris yang sudah final tidak bisa dikonfirmasi
/// ulang (idempotensi terhadap callback ganda dari gateway).
pembayaranRouter.patch(
  "/:id/konfirmasi",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", konfirmasiSchema),
  async (c) => {
    const id = c.req.param("id")
    const { status, waktuBayar, payloadCallback } = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const existing = await prisma.riwayatPembayaran.findUnique({
      where: { id },
    })
    if (!existing) throw new NotFoundError("RiwayatPembayaran")
    if (existing.status !== "PENDING") {
      throw new ConflictError(
        `Pembayaran ini sudah difinalisasi sebelumnya (status: ${existing.status})`,
      )
    }

    const saatBayar = waktuBayar ?? new Date()

    const row = await prisma.$transaction(async (tx) => {
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
        userId: requester.id,
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

    return ok(c, row)
  },
)
