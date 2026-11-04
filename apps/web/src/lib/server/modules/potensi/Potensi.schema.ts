import { z } from "zod"
import { StatusPotensi } from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["createdAt", "alamat", "status"]),
  q: z.string().trim().min(1).optional(),
  status: z.enum(StatusPotensi).optional(),
  ruteId: z.string().optional(),
  kelurahanId: z.string().optional(),
})

export const nearQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50000).default(1000),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const koordinatSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .nullable()
  .optional()

export const createSchema = z.object({
  alamat: z.string().trim().min(1).max(500),
  koordinat: koordinatSchema,
  status: z.enum(StatusPotensi).optional(),
  catatan: z.string().max(500).nullable().optional(),
  petugasId: z.string().min(1).nullable().optional(),
  ruteId: z.string().min(1).nullable().optional(),
  kelurahanId: z.string().min(1).nullable().optional(),
})

export const updateSchema = createSchema.partial()

export type ListPotensiQuery = z.infer<typeof listQuerySchema>
export type NearPotensiQuery = z.infer<typeof nearQuerySchema>
export type CreatePotensiInput = z.infer<typeof createSchema>
export type UpdatePotensiInput = z.infer<typeof updateSchema>
