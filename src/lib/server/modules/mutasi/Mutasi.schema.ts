import { z } from "zod"
import { JenisMutasi, UkuranMeter, GolonganTarif } from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "periode",
    "jenis",
    "tanggalAktif",
    "nomorMeterBaru",
  ]),
  pelangganId: z.string().optional(),
  jenis: z.enum(JenisMutasi).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

export const createSchema = z.object({
  pelangganId: z.string().min(1),
  jenis: z.enum(JenisMutasi),
  periode: z.coerce.number().int().min(190001).max(999912),
  nomorMeterBaru: z.string().trim().max(50).nullable().optional(),
  merkMeterBaru: z.string().trim().max(50).nullable().optional(),
  ukuranMeterBaru: z.enum(UkuranMeter).nullable().optional(),
  tarifBaru: z.enum(GolonganTarif).nullable().optional(),
  koordinatMutasi: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable()
    .optional(),
  ruteBaru: z.string().trim().max(50).nullable().optional(),
  kodeWilayahBaru: z.string().trim().max(50).nullable().optional(),
  noUrut: z.coerce.number().int().nullable().optional(),
  jumlahPenghuni: z.coerce.number().int().min(0).nullable().optional(),
  tanggalAktif: z.coerce.date().nullable().optional(),
  catatan: z.string().max(500).nullable().optional(),
})

export type ListMutasiQuery = z.infer<typeof listQuerySchema>
export type CreateMutasiInput = z.infer<typeof createSchema>
