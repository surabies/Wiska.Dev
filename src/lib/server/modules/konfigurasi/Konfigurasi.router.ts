// server/modules/konfigurasi/konfigurasi.router.ts — key-value store
// operasional (mis. AMBANG_ANOMALI_PERSEN). `isRahasia` menyamarkan
// `nilai` di response untuk siapapun selain SUPER_ADMIN — bukan enkripsi,
// murni supaya nilai sensitif tidak nongol begitu saja di UI admin biasa.
// Tidak ada endpoint DELETE (key konfigurasi bersifat tetap/sistem).
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { z } from "zod"
import { prisma } from "@db"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/Pagination"
import { ok, paginated } from "../../lib/Respons"
import { BadRequestError, NotFoundError } from "../../lib/Galat"
import {
  dapatkanJendelaLaporMandiri,
  KUNCI_TANGGAL_BUKA,
  KUNCI_TANGGAL_TUTUP,
} from "../laporan/LaporanMandiri.service"

export const konfigurasiRouter = new Hono()

const MASK = "••••••••"

function maskIfNeeded<T extends { nilai: string; isRahasia: boolean }>(
  row: T,
  canSeeSecret: boolean
): T {
  if (!row.isRahasia || canSeeSecret) return row
  return { ...row, nilai: MASK }
}

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["kunci", "tipe", "isRahasia", "updatedAt"]),
  q: z.string().trim().min(1).optional(),
})

konfigurasiRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = query.q
      ? {
          OR: [
            { kunci: { contains: query.q, mode: "insensitive" as const } },
            { deskripsi: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}
    const [data, total] = await Promise.all([
      prisma.konfigurasi.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { kunci: "asc" }),
      }),
      prisma.konfigurasi.count({ where }),
    ])
    const canSeeSecret = getSessionUser(c).role === "SUPER_ADMIN"
    return paginated(
      c,
      data.map((row) => maskIfNeeded(row, canSeeSecret)),
      buildMeta(total, query)
    )
  }
)

konfigurasiRouter.get(
  "/lapor-mandiri/jendela",
  requireRole(...ROLE_GROUPS.ADMIN),
  async (c) => {
    const jendela = await dapatkanJendelaLaporMandiri()
    return ok(c, {
      tanggalBuka: jendela.tanggalBuka,
      tanggalTutup: jendela.tanggalTutup,
    })
  }
)

const jendelaLaporMandiriSchema = z
  .object({
    tanggalBuka: z.number().int().min(1).max(28),
    tanggalTutup: z.number().int().min(1).max(28),
  })
  .refine((nilai) => nilai.tanggalBuka <= nilai.tanggalTutup, {
    message: "Tanggal buka tidak boleh melewati tanggal tutup.",
    path: ["tanggalBuka"],
  })

konfigurasiRouter.patch(
  "/lapor-mandiri/jendela",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", jendelaLaporMandiriSchema),
  async (c) => {
    const { tanggalBuka, tanggalTutup } = c.req.valid("json")
    const [konfigurasiBuka, konfigurasiTutup] = await prisma.$transaction(
      async (tx) => {
        const buka = await tx.konfigurasi.upsert({
          where: { kunci: KUNCI_TANGGAL_BUKA },
          update: { nilai: String(tanggalBuka) },
          create: {
            kunci: KUNCI_TANGGAL_BUKA,
            nilai: String(tanggalBuka),
            deskripsi: "Tanggal mulai laporan meter mandiri setiap bulan.",
            tipe: "number",
          },
        })
        const tutup = await tx.konfigurasi.upsert({
          where: { kunci: KUNCI_TANGGAL_TUTUP },
          update: { nilai: String(tanggalTutup) },
          create: {
            kunci: KUNCI_TANGGAL_TUTUP,
            nilai: String(tanggalTutup),
            deskripsi: "Tanggal akhir laporan meter mandiri setiap bulan.",
            tipe: "number",
          },
        })
        return [buka, tutup] as const
      }
    )
    return ok(c, {
      tanggalBuka: Number(konfigurasiBuka.nilai),
      tanggalTutup: Number(konfigurasiTutup.nilai),
    })
  }
)

konfigurasiRouter.get(
  "/:kunci",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const row = await prisma.konfigurasi.findUnique({
      where: { kunci: c.req.param("kunci") },
    })
    if (!row) throw new NotFoundError("Konfigurasi")
    const canSeeSecret = getSessionUser(c).role === "SUPER_ADMIN"
    return ok(c, maskIfNeeded(row, canSeeSecret))
  }
)

const upsertSchema = z.object({
  nilai: z.string().min(1),
  deskripsi: z.string().max(500).nullable().optional(),
  tipe: z.string().min(1).max(20).optional(),
  isRahasia: z.boolean().optional(),
})

konfigurasiRouter.patch(
  "/:kunci",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", upsertSchema),
  async (c) => {
    const kunci = c.req.param("kunci")
    const body = c.req.valid("json")
    if (kunci === KUNCI_TANGGAL_BUKA || kunci === KUNCI_TANGGAL_TUTUP) {
      throw new BadRequestError(
        "Ubah tanggal buka dan tutup sekaligus melalui /api/v1/konfigurasi/lapor-mandiri/jendela."
      )
    }
    const row = await prisma.konfigurasi.upsert({
      where: { kunci },
      update: body,
      create: { kunci, ...body },
    })
    return ok(c, row)
  }
)
