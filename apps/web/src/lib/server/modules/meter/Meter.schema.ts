// server/modules/meter/Meter.schema.ts — skema validasi input untuk
// pengelolaan aset meter fisik.
import { z } from "zod"
import { UkuranMeter } from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listMeterQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "nomorMeter",
    "merkKode",
    "ukuran",
    "tanggalPasang",
    "isAktif",
    "createdAt",
  ]),
  q: z.string().trim().min(1).optional(),
  pelangganId: z.string().optional(),
  isAktif: z.coerce.boolean().optional(),
})

export type ListMeterQuery = z.infer<typeof listMeterQuerySchema>

export const createMeterSchema = z.object({
  pelangganId: z.string().min(1),
  nomorMeter: z.string().trim().min(1).max(50),
  nomorSegel: z.string().trim().max(50).nullable().optional(),
  merkKode: z.string().trim().max(50).nullable().optional(),
  ukuran: z.enum(UkuranMeter).optional(),
  tanggalPasang: z.coerce.date().nullable().optional(),
  catatan: z.string().max(500).nullable().optional(),
})

export type CreateMeterInput = z.infer<typeof createMeterSchema>

// Hanya field administratif yang boleh diubah. nomorMeter/ukuran/pelangganId
// TIDAK bisa di-PATCH — mengganti meter fisik harus lewat POST (supaya
// menghasilkan baris histori baru, bukan menimpa yang lama).
export const updateMeterSchema = z.object({
  nomorSegel: z.string().trim().max(50).nullable().optional(),
  catatan: z.string().max(500).nullable().optional(),
})

export type UpdateMeterInput = z.infer<typeof updateMeterSchema>
