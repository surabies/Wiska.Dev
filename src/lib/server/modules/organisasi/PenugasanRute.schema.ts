import { z } from "zod"
import { paginationQuerySchema } from "../../lib/Pagination"

export const listQuerySchema = z.object({
  pencatatId: z.string().min(1),
})

export const opsiFilterQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

export const ruteTanpaPetugasSchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
})

export const buatSchema = z.object({
  pencatatId: z.string().min(1),
  ruteId: z.string().min(1),
})

export const urutanSchema = z.object({
  pencatatId: z.string().min(1),
  ruteIds: z.array(z.string().min(1)).min(1),
})

export type ListPenugasanRuteQuery = z.infer<typeof listQuerySchema>
export type OpsiFilterPenugasanRuteQuery = z.infer<typeof opsiFilterQuerySchema>
export type RuteTanpaPetugasQuery = z.infer<typeof ruteTanpaPetugasSchema>
export type BuatPenugasanRuteInput = z.infer<typeof buatSchema>
export type UrutanPenugasanRuteInput = z.infer<typeof urutanSchema>
