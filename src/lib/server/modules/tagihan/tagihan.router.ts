// server/modules/tagihan/tagihan.router.ts — tagihan air periodik.
// Pembentukan nominal ada di tagihan.service.ts (dihitung server dari
// TarifBlok, tidak pernah dari client).
import { Hono } from "hono"
import { z } from "zod"
import { StatusTagihan } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError, BadRequestError } from "../../lib/errors"
import { recordAudit, auditMetaFromRequest } from "../../lib/audit"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"
import { periodeToDate, dateToPeriode } from "../../lib/periode"
import { generateTagihan, hitungBiayaAir } from "./tagihan.service"

export const tagihanRouter = new Hono()

// BigInt (Tagihan.nominalTunggak) tidak bisa di-JSON.stringify -> ubah ke
// string di boundary API. Presisinya wajib dipertahankan (tunggakan bisa
// ratusan juta rupiah), jadi string, bukan Number.
function serialize<T extends { nominalTunggak?: bigint | null }>(row: T) {
  return {
    ...row,
    nominalTunggak:
      row.nominalTunggak == null ? null : row.nominalTunggak.toString(),
  }
}

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "periode",
    "pemakaianM3",
    "totalTagihan",
    "denda",
    "status",
    "tanggalJatuhTempo",
    "tanggalBayar",
  ]),
  pelangganId: z.string().optional(),
  status: z.enum(StatusTagihan).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

tagihanRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      pelangganId: query.pelangganId,
      status: query.status,
      periode: query.periode ? periodeToDate(query.periode) : undefined,
    }
    const [rows, total] = await Promise.all([
      prisma.tagihan.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { periode: "desc" }),
        include: {
          pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
        },
      }),
      prisma.tagihan.count({ where }),
    ])
    return paginated(c, rows.map(serialize), buildMeta(total, query))
  },
)

// ============================================================
// DRD — Daftar Rekening Ditagih (laporan penagihan per periode)
// ============================================================
// Terdaftar SEBELUM /:id supaya path statis "drd" tidak tertelan param id.

const drdQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "periode",
    "pemakaianM3",
    "jmlHargaAir",
    "totalTagihan",
    "denda",
    "status",
    "tanggalJatuhTempo",
    "tanggalBayar",
  ]),
  q: z.string().trim().min(1).optional(),
  status: z.enum(StatusTagihan).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

/// Baris DRD = Tagihan + identitas pelanggan selengkap kebutuhan cetakan
/// DRD (nomor langganan, nama, alamat, golongan tarif, rute) — berbeda dari
/// GET / yang include-nya minimal untuk daftar umum.
tagihanRouter.get(
  "/drd",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", drdQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      status: query.status,
      periode: query.periode ? periodeToDate(query.periode) : undefined,
      ...(query.q
        ? {
            pelanggan: {
              OR: [
                { nomorLangganan: { contains: query.q } },
                { nama: { contains: query.q, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.tagihan.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, [
          { periode: "desc" },
          { createdAt: "asc" },
        ]),
        include: {
          pelanggan: {
            select: {
              id: true,
              nomorLangganan: true,
              nama: true,
              alamat: true,
              tarifGolongan: { select: { kodeAsli: true, nama: true } },
              rute: { select: { kode: true } },
            },
          },
        },
      }),
      prisma.tagihan.count({ where }),
    ])
    return paginated(c, rows.map(serialize), buildMeta(total, query))
  },
)

/// Rekap DRD: agregat per status + total keseluruhan + daftar periode yang
/// punya data (untuk dropdown). Agregasi di DB — tabel tagihan >22 ribu
/// baris per periode.
const drdRekapQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

tagihanRouter.get(
  "/drd/rekap",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", drdRekapQuerySchema),
  async (c) => {
    const { periode } = c.req.valid("query")
    const where = periode ? { periode: periodeToDate(periode) } : {}
    const [totalAgg, perStatus, periodes] = await Promise.all([
      prisma.tagihan.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          pemakaianM3: true,
          jmlHargaAir: true,
          denda: true,
          totalTagihan: true,
        },
      }),
      prisma.tagihan.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        _sum: { totalTagihan: true },
      }),
      prisma.tagihan.groupBy({
        by: ["periode"],
        orderBy: { periode: "desc" },
        take: 24,
      }),
    ])
    return ok(c, {
      totalRekening: totalAgg._count._all,
      totalPemakaianM3: totalAgg._sum.pemakaianM3 ?? 0,
      totalHargaAir: totalAgg._sum.jmlHargaAir ?? 0,
      totalDenda: totalAgg._sum.denda ?? 0,
      totalTagihan: totalAgg._sum.totalTagihan ?? 0,
      perStatus: perStatus.map((s) => ({
        status: s.status,
        jumlah: s._count._all,
        nominal: s._sum.totalTagihan ?? 0,
      })),
      periodes: periodes.map((p) => dateToPeriode(p.periode)),
    })
  },
)

tagihanRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await prisma.tagihan.findUnique({
    where: { id: c.req.param("id") },
    include: {
      pelanggan: {
        select: { id: true, nomorLangganan: true, nama: true, alamat: true },
      },
      pembacaan: true,
      riwayatPembayaran: { orderBy: { createdAt: "desc" } },
      validator: { select: { id: true, name: true } },
    },
  })
  if (!row) throw new NotFoundError("Tagihan")
  return ok(c, serialize(row))
})

const generateSchema = z.object({
  pembacaanId: z.string().min(1),
  beaBeban: z.coerce.number().int().min(0).optional(),
  beaAdmin: z.coerce.number().int().min(0).optional(),
  airKotor: z.coerce.number().int().min(0).optional(),
  lainLain: z.coerce.number().int().min(0).optional(),
  denda: z.coerce.number().int().min(0).optional(),
  tanggalJatuhTempo: z.coerce.date(),
})

tagihanRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", generateSchema),
  async (c) => {
    const row = await generateTagihan(c.req.valid("json"))
    return created(c, serialize(row))
  },
)

/// Simulasi tagihan tanpa menyimpan — untuk preview di UI sebelum closing.
const simulasiSchema = z.object({
  tarifGolonganId: z.string().min(1),
  pemakaianM3: z.coerce.number().int().min(0),
  periode: z.coerce.number().int().min(190001).max(999912),
})

tagihanRouter.post(
  "/simulasi",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", simulasiSchema),
  async (c) => {
    const { tarifGolonganId, pemakaianM3, periode } = c.req.valid("json")
    const tanggal = periodeToDate(periode)
    const blok = await prisma.tarifBlok.findMany({
      where: {
        tarifGolonganId,
        berlakuMulai: { lte: tanggal },
        OR: [{ berlakuSampai: null }, { berlakuSampai: { gte: tanggal } }],
      },
    })
    if (blok.length === 0)
      throw new BadRequestError(
        "Tidak ada TarifBlok yang berlaku untuk golongan/periode tersebut",
      )
    const { total, rincian } = hitungBiayaAir(pemakaianM3, blok)
    return ok(c, { pemakaianM3, jmlHargaAir: total, rincianBlok: rincian })
  },
)

/// Perubahan status manual. SUDAH_BAYAR sengaja TIDAK diizinkan di sini —
/// pelunasan hanya boleh lewat konfirmasi RiwayatPembayaran (modul
/// pembayaran) supaya setiap rupiah yang tercatat lunas selalu punya baris
/// ledger pendampingnya, tidak bisa "dilunaskan" tanpa jejak transaksi.
const patchStatusSchema = z.object({
  status: z.enum(["DIHAPUSKAN", "JATUH_TEMPO", "BELUM_BAYAR"]),
  catatanValidasi: z.string().trim().min(1).max(500),
})

tagihanRouter.patch(
  "/:id/status",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  validate("json", patchStatusSchema),
  async (c) => {
    const id = c.req.param("id")
    const { status, catatanValidasi } = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const existing = await prisma.tagihan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("Tagihan")
    if (existing.status === "SUDAH_BAYAR") {
      throw new BadRequestError(
        "Tagihan yang sudah dibayar tidak bisa diubah statusnya lewat endpoint ini",
      )
    }

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.tagihan.update({
        where: { id },
        data: {
          status,
          catatanValidasi,
          validatorId: requester.id,
          validasiAt: new Date(),
        },
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: `TAGIHAN_STATUS_${status}`,
        entitas: "Tagihan",
        entitasId: id,
        perubahan: {
          before: { status: existing.status },
          after: { status },
          catatanValidasi,
        },
        ipAddress,
        userAgent,
      })
      return row
    })

    return ok(c, serialize(row))
  },
)
