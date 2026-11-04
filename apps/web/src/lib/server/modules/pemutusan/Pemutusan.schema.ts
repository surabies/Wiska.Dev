// server/modules/pemutusan/Pemutusan.schema.ts — skema validasi input untuk
// riwayat pemutusan sambungan dan penerapan status pelanggan dari pemutusan.
import { z } from "zod"
import { JenisPemutusan } from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listPemutusanQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "periode",
    "jenis",
    "nomorLangganan",
    "namaPelanggan",
    "tanggalSPT",
  ]),
  q: z.string().trim().min(1).optional(),
  pelangganId: z.string().optional(),
  jenis: z.enum(JenisPemutusan).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  sumberData: z.string().optional(),
})

export type ListPemutusanQuery = z.infer<typeof listPemutusanQuerySchema>

export const createPemutusanSchema = z.object({
  pelangganId: z.string().min(1).nullable().optional(),
  kelurahanId: z.string().min(1).nullable().optional(),
  kecamatanId: z.string().min(1).nullable().optional(),
  nomorLangganan: z.string().trim().max(20).nullable().optional(),
  namaPelanggan: z.string().trim().max(200).nullable().optional(),
  jenis: z.enum(JenisPemutusan),
  periode: z.coerce.number().int().min(190001).max(999912),
  nomorSurat: z.string().trim().max(100).nullable().optional(),
  tanggalPermohonan: z.coerce.date().nullable().optional(),
  nomorSPT: z.string().trim().max(100).nullable().optional(),
  tanggalSPT: z.coerce.date().nullable().optional(),
  tanggalTutup: z.coerce.date().nullable().optional(),
  tanggalCabut: z.coerce.date().nullable().optional(),
  koordinatVerifikasi: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable()
    .optional(),
  catatanSurveiAsli: z.string().max(1000).nullable().optional(),
  catatan: z.string().max(500).nullable().optional(),
})

export type CreatePemutusanInput = z.infer<typeof createPemutusanSchema>

export const terapkanStatusPemutusanSchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912),
  /// Bawaannya PRATINJAU. Menulis harus dinyatakan eksplisit — layar boleh
  /// memanggil endpoint ini untuk "berapa yang akan berubah?" tanpa risiko
  /// mengubah apa pun.
  terapkan: z.boolean().optional(),
})

export type TerapkanStatusPemutusanInput = z.infer<
  typeof terapkanStatusPemutusanSchema
>
