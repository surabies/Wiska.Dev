// server/lib/crud-factory.ts — generic CRUD router untuk model referensi
// murni (tanpa kolom geometry, tanpa business rule khusus): Divisi,
// Bagian, SubBagian, Pencatat, TargetKinerja, GolonganBesar, Dma.
// Model dengan kolom geometry (wilayah, Pelanggan, dst.) atau alur bisnis
// khusus (Tagihan, Meter, dst.) TIDAK pakai ini — ditulis manual di modul
// masing-masing.
//
// Delegate Prisma di-tipe longgar (bukan generic penuh mengikuti tipe
// model) karena mencoba menyatukan >30 delegate model yang berbeda-beda ke
// satu signature generik yang ketat akan lebih merepotkan daripada
// manfaatnya untuk router setipis ini — validasi bentuk data tetap ketat
// lewat zod schema di titik masuk (createSchema/updateSchema).
import { Hono } from "hono"
import { validate } from "./validate"
import { z, type ZodType } from "zod"
import type { Role } from "@db"
import { requireRole } from "../middleware/rbac"
import { paginationQuerySchema, buildSkipTake, buildMeta } from "./pagination"
import { ok, created, paginated } from "./response"
import { NotFoundError } from "./errors"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

// Prisma delegate methods use "exact object" arg types (SelectSubset<T, ...>
// with a `{ [x: string]: never }` catch-all) so that unknown keys are
// rejected at the call site. That is incompatible in *parameter* position
// with an object type carrying a `string` index signature (AnyRecord) — the
// only type that stays assignable no matter how a given model's delegate
// narrows its args is `any` itself. Runtime shape is still whatever we pass
// from the router below; zod already validated the *input* payload, this
// interface only needs to describe "some Prisma delegate", not enforce
// per-model argument shape.
/* eslint-disable @typescript-eslint/no-explicit-any */
interface CrudDelegate {
  findMany: (args: any) => Promise<AnyRecord[]>
  count: (args: any) => Promise<number>
  findUnique: (args: any) => Promise<AnyRecord | null>
  create: (args: any) => Promise<AnyRecord>
  update: (args: any) => Promise<AnyRecord>
  delete: (args: any) => Promise<AnyRecord>
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface CrudConfig<TCreate extends ZodType, TUpdate extends ZodType> {
  /** Nama entitas untuk pesan error, mis. "Divisi". */
  entitas: string
  delegate: CrudDelegate
  createSchema: TCreate
  updateSchema: TUpdate
  /** Kolom string yang bisa dicari lewat ?q=, dibandingkan pakai `contains` (case-insensitive). */
  searchFields?: string[]
  orderBy?: AnyRecord
  read: readonly Role[]
  write: readonly Role[]
  include?: AnyRecord
  /** Efek samping best-effort setelah PATCH berhasil (mis. kirim notifikasi).
   *  Menerima baris SEBELUM & SESUDAH update; dijalankan di luar transaksi dan
   *  dibungkus try/catch agar kegagalannya tidak menggagalkan respons. */
  onAfterUpdate?: (args: {
    existing: AnyRecord
    updated: AnyRecord
  }) => Promise<void> | void
}

export function createCrudRouter<
  TCreate extends ZodType,
  TUpdate extends ZodType,
>(config: CrudConfig<TCreate, TUpdate>) {
  const {
    delegate,
    entitas,
    searchFields = [],
    read,
    write,
    include,
    orderBy,
  } = config
  const listQuerySchema = paginationQuerySchema.extend({
    q: z.string().trim().min(1).optional(),
  })

  const router = new Hono()

  router.get(
    "/",
    requireRole(...read),
    validate("query", listQuerySchema),
    async (c) => {
      const query = c.req.valid("query")
      const { skip, take } = buildSkipTake(query)
      const where: AnyRecord =
        query.q && searchFields.length > 0
          ? {
              OR: searchFields.map((field) => ({
                [field]: { contains: query.q, mode: "insensitive" },
              })),
            }
          : {}
      const [data, total] = await Promise.all([
        delegate.findMany({
          where,
          skip,
          take,
          orderBy: orderBy ?? { id: "asc" },
          include,
        }),
        delegate.count({ where }),
      ])
      return paginated(c, data, buildMeta(total, query))
    },
  )

  router.get("/:id", requireRole(...read), async (c) => {
    const row = await delegate.findUnique({
      where: { id: c.req.param("id") },
      include,
    })
    if (!row) throw new NotFoundError(entitas)
    return ok(c, row)
  })

  router.post(
    "/",
    requireRole(...write),
    validate("json", config.createSchema),
    async (c) => {
      const row = await delegate.create({ data: c.req.valid("json"), include })
      return created(c, row)
    },
  )

  router.patch(
    "/:id",
    requireRole(...write),
    validate("json", config.updateSchema),
    async (c) => {
      const id = c.req.param("id")
      const existing = await delegate.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError(entitas)
      const row = await delegate.update({
        where: { id },
        data: c.req.valid("json"),
        include,
      })
      if (config.onAfterUpdate) {
        try {
          await config.onAfterUpdate({ existing, updated: row })
        } catch (e) {
          console.error(`[crud:${entitas}] onAfterUpdate gagal:`, e)
        }
      }
      return ok(c, row)
    },
  )

  router.delete("/:id", requireRole(...write), async (c) => {
    const id = c.req.param("id")
    const existing = await delegate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError(entitas)
    await delegate.delete({ where: { id } })
    return ok(c, { id })
  })

  return router
}
