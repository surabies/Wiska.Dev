// server/lib/response.ts — envelope respons sukses yang konsisten dipakai
// seluruh modul. Error envelope ada di errors.ts (dibentuk oleh
// errorHandler, bukan lewat helper ini).
import type { Context } from "hono"
import type { PaginationMeta } from "./pagination"

export function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ success: true, data }, status)
}

export function created<T>(c: Context, data: T) {
  return ok(c, data, 201)
}

export function paginated<T>(c: Context, data: T[], meta: PaginationMeta) {
  return c.json({ success: true, data, meta }, 200)
}
