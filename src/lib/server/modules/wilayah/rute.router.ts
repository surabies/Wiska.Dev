// server/modules/wilayah/rute.router.ts — rute pencatatan meter. Tidak
// punya field `nama` (beda dari model wilayah lain) -> orderBy/searchFields
// dioverride ke `kode`.
import { z } from "zod"
import { GEO } from "../../lib/spatial"
import { createGeoCrudRouter, geoJsonSchema } from "../../lib/geo-crud-factory"
import { ROLE_GROUPS, requireRole } from "../../middleware/rbac"
import { validate } from "../../lib/validate"
import { prisma } from "@db"
import { ok, paginated } from "../../lib/response"
import { NotFoundError, BadRequestError } from "../../lib/errors"
import {
  buildMeta,
  buildSkipTake,
  paginationQuerySchema,
} from "../../lib/pagination"

const createSchema = z.object({
  kode: z.string().trim().min(1).max(50),
  noUrut: z.coerce.number().int().min(0).nullable().optional(),
  seksiCaterId: z.string().min(1),
  area: geoJsonSchema.nullable().optional(),
})

const updateSchema = createSchema.partial()

export const ruteRouter = createGeoCrudRouter({
  entitas: "Rute",
  model: "rute",
  geo: GEO.rute,
  createSchema,
  updateSchema,
  searchFields: ["kode"],
  orderBy: { kode: "asc" },
  include: { seksiCater: true },
  read: ROLE_GROUPS.STAFF_UP,
  write: ROLE_GROUPS.ADMIN,
})

// ── Daftar pelanggan terurut dalam satu rute ───────────────────────────
const urutanPelangganListSchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
})

ruteRouter.get(
  "/:id/pelanggan-urutan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", urutanPelangganListSchema),
  async (c) => {
    const ruteId = c.req.param("id")
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const rute = await prisma.rute.findUnique({
      where: { id: ruteId },
      select: { id: true },
    })
    if (!rute) throw new NotFoundError("Rute")
    const where = {
      ruteId,
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { nomorLangganan: { contains: query.q } },
              { nama: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.pelanggan.findMany({
        where,
        orderBy: [{ noUrutRute: "asc" }, { nomorLangganan: "asc" }],
        skip,
        take,
        select: {
          id: true,
          nomorLangganan: true,
          nama: true,
          noUrutRute: true,
        },
      }),
      prisma.pelanggan.count({ where }),
    ])
    return paginated(c, rows, buildMeta(total, query))
  },
)

// Urutan kunjungan pelanggan DALAM satu rute (Pelanggan.noUrutRute) — diatur
// dari halaman Pemetaan Rute dashboard. `pelangganIds` = urutan baru; tiap
// pelanggan diberi noUrutRute sesuai indeks (1-based). Dibaca mobile lewat
// pengurutan di rute-saya.
const urutanPelangganSchema = z.object({
  pelangganIds: z.array(z.string().min(1)).min(1).max(50000),
})

ruteRouter.patch(
  "/:id/urutan-pelanggan",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", urutanPelangganSchema),
  async (c) => {
    const ruteId = c.req.param("id")
    const { pelangganIds } = c.req.valid("json")
    const rute = await prisma.rute.findUnique({
      where: { id: ruteId },
      select: { id: true },
    })
    if (!rute) throw new NotFoundError("Rute")

    // Semua id harus milik rute ini — cegah menata ulang pelanggan rute lain.
    const milik = await prisma.pelanggan.findMany({
      where: { ruteId, deletedAt: null },
      select: { id: true },
    })
    const setMilik = new Set(milik.map((m) => m.id))
    if (
      pelangganIds.length !== setMilik.size ||
      new Set(pelangganIds).size !== pelangganIds.length ||
      !pelangganIds.every((id) => setMilik.has(id))
    ) {
      throw new BadRequestError(
        "Daftar pelanggan tidak cocok dengan pelanggan aktif pada rute ini",
      )
    }
    await prisma.$transaction(
      pelangganIds.map((id, i) =>
        prisma.pelanggan.update({ where: { id }, data: { noUrutRute: i + 1 } }),
      ),
    )
    return ok(c, { ruteId, jumlah: pelangganIds.length })
  },
)
