// server/modules/pembayaran/Pembayaran.schema.ts — skema validasi input untuk
// ledger pembayaran tunggal Tagihan (air) dan TagihanLain (non-air).
import { z } from "zod"
import { KanalPembayaran, StatusPembayaran } from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listPembayaranQuerySchema = paginationQuerySchema.extend({
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

export type ListPembayaranQuery = z.infer<typeof listPembayaranQuerySchema>

// POLYMORPHIC XOR: tepat satu dari tagihanId/tagihanLainId harus terisi.
// Prisma tidak punya relasi polymorphic native (lihat komentar model
// RiwayatPembayaran), jadi divalidasi di zod + service.
export const createPembayaranSchema = z
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

export type CreatePembayaranInput = z.infer<typeof createPembayaranSchema>

export const konfirmasiPembayaranSchema = z.object({
  status: z.enum(["BERHASIL", "GAGAL", "EXPIRED"]),
  waktuBayar: z.coerce.date().optional(),
  payloadCallback: z.unknown().optional(),
})

export type KonfirmasiPembayaranInput = z.infer<
  typeof konfirmasiPembayaranSchema
>
