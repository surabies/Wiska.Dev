// server/modules/pembacaan/Pembacaan.schema.ts — skema validasi input untuk
// PembacaanMeter resmi (hasil closing/verifikasi).
import { z } from "zod"
import { KondisiCatat, KategoriPembacaan } from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listPembacaanQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "periode",
    "standLalu",
    "standAkhir",
    "pemakaianM3",
    "kondisi",
    "createdAt",
  ]),
  meterId: z.string().optional(),
  pelangganId: z.string().optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  periodeSebelum: z.coerce.number().int().min(190001).max(999912).optional(),
  kondisi: z.enum(KondisiCatat).optional(),
  /// Penyaring per petugas. Dipasangkan dengan periode + kondisi, inilah yang
  /// menjawab "berapa banyak stand tempel milik AGUS bulan ini" — pertanyaan
  /// pengawasan yang tidak bisa dijawab oleh penyaring kondisi saja.
  pencatatId: z.string().optional(),
})

export type ListPembacaanQuery = z.infer<typeof listPembacaanQuerySchema>

export const createPembacaanSchema = z.object({
  meterId: z.string().min(1),
  /// Format thbl seperti sumber data: 202605 -> periode 2026-05-01.
  periode: z.coerce.number().int().min(190001).max(999912),
  standLalu: z.coerce.number().int().min(0),
  standAkhir: z.coerce.number().int().min(0),
  blokTarif: z.coerce.number().int().min(1).max(4),
  pemakaianLalu: z.coerce.number().int().min(0).nullable().optional(),
  blokTarifLalu: z.coerce.number().int().min(1).max(4).nullable().optional(),
  kondisi: z.enum(KondisiCatat).optional(),
  kategori: z.enum(KategoriPembacaan).optional(),
  pencatatId: z.string().min(1).nullable().optional(),
  tanggalCatat: z.coerce.date().nullable().optional(),
  fotoBukti: z.url().nullable().optional(),
})

export type CreatePembacaanInput = z.infer<typeof createPembacaanSchema>
