// server/lib/pagination.ts — query schema & helper pagination dipakai
// seragam oleh semua endpoint list.
import { z } from "zod"

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // max 5000 (semula 1000, semula lagi 100). Dua pendorongnya:
  // (1) ekspor Excel menarik baris per blok besar — 22 ribu baris cukup ~5
  // request alih-alih 225; (2) layar verifikasi memang dikerjakan borongan,
  // dan aplikasi lama pun menyajikan 200-5000 baris sekaligus. Endpoint ini
  // seluruhnya di belakang login + RBAC, jadi blok besar bukan pintu
  // penyalahgunaan anonim.
  pageSize: z.coerce.number().int().min(1).max(5000).default(20),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function buildSkipTake(query: PaginationQuery): {
  skip: number
  take: number
} {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize }
}

export function buildMeta(
  total: number,
  query: PaginationQuery,
): PaginationMeta {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  }
}

export function sortSchema<T extends [string, ...string[]]>(
  fields: T,
  defaultField: T[number],
) {
  return z.object({
    sortBy: z.enum(fields).default(defaultField),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  })
}

/// Varian untuk `.extend()` di listQuerySchema: sortBy OPSIONAL (tanpa sort
/// eksplisit, endpoint memakai urutan default-nya). Field yang boleh
/// di-sort di-whitelist per endpoint — JANGAN menerima string bebas, nama
/// kolom dari client bukan hal yang layak dipercaya.
export function sortQuery<T extends [string, ...string[]]>(fields: T) {
  return {
    sortBy: z.enum(fields).optional(),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  }
}

/** orderBy Prisma dari query sort; jatuh ke `fallback` bila sortBy kosong. */
export function buildOrderBy(
  query: { sortBy?: string; sortDir: "asc" | "desc" },
  fallback: Record<string, unknown> | Array<Record<string, unknown>>,
): Record<string, unknown> | Array<Record<string, unknown>> {
  return query.sortBy ? { [query.sortBy]: query.sortDir } : fallback
}
