// server/modules/laporan/laporan-mandiri.router.ts — laporan stand meter
// mandiri oleh pelanggan (self-service, wajib foto bukti).
//
// ALUR STATUS YANG SEBENARNYA TERJADI: MENUNGGU -> DIGUNAKAN (verify) atau
// MENUNGGU -> DITOLAK (reject), dan DITOLAK -> MENUNGGU lagi bila warga
// mengirim ulang foto yang benar (POST / menimpa barisnya — lihat di bawah).
// DIVERIFIKASI ada di enum tapi TIDAK PERNAH
// DITULIS: verify membuat PembacaanMeter resmi di transaksi yang sama, jadi
// laporan langsung berstatus "sudah dipakai". Baris yang sudah diverifikasi
// TIDAK dihapus dari tabel ini — ia tetap terdaftar, hanya berganti status;
// lihat whereStatus() di bawah untuk akibatnya pada penyaring.
import { Hono } from "hono"
import { z } from "zod"
import { StatusLaporanMandiri } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError, ConflictError, BadRequestError } from "../../lib/errors"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"
import { dateToPeriode, periodeToDate } from "../../lib/periode"
import { rentangTanggalWIB } from "../../lib/rentang-tanggal"
import { jendelaLaporMandiri } from "@/lib/domain/lapor-mandiri"
import {
  ambilPembacaanResmi,
  denganSumberResmi,
  simpanPembacaanResmi,
} from "./pembacaan-resmi"

export const laporanMandiriRouter = new Hono()

async function muatStandAwalSebelumnya(
  rows: { pelangganId: string; periode: number }[],
) {
  const pelangganIds = [...new Set(rows.map((row) => row.pelangganId))]
  if (pelangganIds.length === 0) return new Map<string, number>()

  const meters = await prisma.meter.findMany({
    where: { pelangganId: { in: pelangganIds }, isAktif: true },
    select: { id: true, pelangganId: true },
    orderBy: { createdAt: "desc" },
  })
  const meterPerPelanggan = new Map<string, string>()
  for (const meter of meters) {
    if (!meterPerPelanggan.has(meter.pelangganId))
      meterPerPelanggan.set(meter.pelangganId, meter.id)
  }

  const perPeriode = new Map<number, Set<string>>()
  for (const row of rows) {
    const meterId = meterPerPelanggan.get(row.pelangganId)
    if (!meterId) continue
    const ids = perPeriode.get(row.periode) ?? new Set<string>()
    ids.add(meterId)
    perPeriode.set(row.periode, ids)
  }

  const hasil = new Map<string, number>()
  for (const [thbl, meterIds] of perPeriode) {
    const ids = [...meterIds]
    for (let offset = 0; offset < ids.length; offset += 500) {
      const bacaan = await prisma.pembacaanMeter.findMany({
        where: {
          meterId: { in: ids.slice(offset, offset + 500) },
          periode: { lt: periodeToDate(thbl) },
        },
        orderBy: { periode: "desc" },
        select: { meterId: true, standAkhir: true },
      })
      for (const item of bacaan) {
        if (!hasil.has(`${thbl}:${item.meterId}`))
          hasil.set(`${thbl}:${item.meterId}`, item.standAkhir)
      }
    }
  }

  return new Map(
    rows.flatMap((row) => {
      const meterId = meterPerPelanggan.get(row.pelangganId)
      const stand = meterId ? hasil.get(`${row.periode}:${meterId}`) : undefined
      return stand === undefined ? [] : [[`${row.pelangganId}:${row.periode}`, stand]]
    }),
  )
}

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "periode",
    "standDilaporkan",
    "status",
    "nomorLangganan",
    "namaPelapor",
  ]),
  q: z.string().trim().min(1).optional(),
  status: z.enum(StatusLaporanMandiri).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  pelangganId: z.string().optional(),
  /// Rentang TANGGAL MASUK (createdAt), bukan periode: "kiriman warga hari
  /// ini / pekan ini". Keduanya inklusif dan boleh dipakai sendiri-sendiri.
  tanggalDari: z.string().trim().optional(),
  tanggalSampai: z.string().trim().optional(),
})

/// PENYARING STATUS — kenapa DIVERIFIKASI tidak diteruskan apa adanya.
///
/// PATCH /:id/verify melompat langsung ke DIGUNAKAN: pembacaan resmi dibuat
/// di transaksi yang sama, jadi tidak ada jeda "diverifikasi tapi belum
/// dipakai" dan status DIVERIFIKASI praktis tidak pernah tertulis. Menyaring
/// "DIVERIFIKASI" mentah-mentah karena itu SELALU memberi nol baris — layar
/// verifikasi tampak seperti kehilangan laporan yang baru saja disetujui,
/// padahal barisnya masih ada dengan status DIGUNAKAN. Di penyaring, tanya
/// yang sebenarnya diajukan orang adalah "mana yang sudah lolos verifikasi",
/// dan jawabannya kedua status itu.
function whereStatus(status?: StatusLaporanMandiri) {
  if (!status) return {}
  if (status === "DIVERIFIKASI") {
    return {
      status: { in: ["DIVERIFIKASI", "DIGUNAKAN"] as StatusLaporanMandiri[] },
    }
  }
  return { status }
}

laporanMandiriRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const masuk = rentangTanggalWIB(query.tanggalDari, query.tanggalSampai)
    const where = {
      ...whereStatus(query.status),
      periode: query.periode,
      pelangganId: query.pelangganId,
      ...(masuk ? { createdAt: masuk } : {}),
      ...(query.q
        ? {
            OR: [
              { nomorLangganan: { contains: query.q } },
              {
                namaPelapor: {
                  contains: query.q,
                  mode: "insensitive" as const,
                },
              },
              {
                pelanggan: {
                  nama: { contains: query.q, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    }
    const [data, total] = await Promise.all([
      prisma.laporanMandiri.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { createdAt: "desc" }),
        include: {
          pelanggan: {
            select: {
              id: true,
              nomorLangganan: true,
              nama: true,
              alamat: true,
              tarifGolongan: { select: { kodeAsli: true } },
              rute: { select: { kode: true } },
            },
          },
          pembacaan: {
            select: {
              standLalu: true,
              standAkhir: true,
              pemakaianRiil: true,
              pemakaianM3: true,
            },
          },
        },
      }),
      prisma.laporanMandiri.count({ where }),
    ])
    const pembacaanResmi = await ambilPembacaanResmi(
      data.map((row) => ({ pelangganId: row.pelangganId, periode: row.periode })),
    )
    const petaPembacaan = new Map()
    for (const row of pembacaanResmi) {
      const kunci = `${row.meter.pelangganId}:${dateToPeriode(row.periode)}`
      if (!petaPembacaan.has(kunci))
        petaPembacaan.set(kunci, denganSumberResmi(row))
    }
    const standAwalSebelumnya = await muatStandAwalSebelumnya(data)
    const dataDenganPembacaan = data.map((row) => ({
      ...row,
      standAwal:
        petaPembacaan.get(`${row.pelangganId}:${row.periode}`)?.standLalu ??
        standAwalSebelumnya.get(`${row.pelangganId}:${row.periode}`) ??
        null,
      pembacaan: petaPembacaan.get(`${row.pelangganId}:${row.periode}`) ?? null,
    }))
    return paginated(c, dataDenganPembacaan, buildMeta(total, query))
  },
)

/// Ringkasan untuk halaman verifikasi: hitungan per status + daftar periode
/// yang punya data. Terdaftar SEBELUM /:id supaya "stats" tidak tertelan
/// param id.
const statsQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

laporanMandiriRouter.get(
  "/stats",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", statsQuerySchema),
  async (c) => {
    const { periode } = c.req.valid("query")
    const where = periode ? { periode } : {}
    const [perStatus, periodes] = await Promise.all([
      prisma.laporanMandiri.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.laporanMandiri.groupBy({
        by: ["periode"],
        orderBy: { periode: "desc" },
        take: 24,
      }),
    ])
    const hitung = Object.fromEntries(
      perStatus.map((s) => [s.status, s._count._all]),
    ) as Partial<Record<StatusLaporanMandiri, number>>
    const total = perStatus.reduce((acc, s) => acc + s._count._all, 0)
    return ok(c, {
      total,
      menunggu: hitung.MENUNGGU ?? 0,
      diverifikasi: (hitung.DIVERIFIKASI ?? 0) + (hitung.DIGUNAKAN ?? 0),
      ditolak: hitung.DITOLAK ?? 0,
      periodes: periodes.map((p) => p.periode),
    })
  },
)

laporanMandiriRouter.get(
  "/:id",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const row = await prisma.laporanMandiri.findUnique({
      where: { id: c.req.param("id") },
      include: {
        pelanggan: true,
        pembacaan: true,
        verifiedBy: { select: { id: true, name: true } },
      },
    })
    if (!row) throw new NotFoundError("LaporanMandiri")
    const pembacaan = await ambilPembacaanResmi([
      { pelangganId: row.pelangganId, periode: row.periode },
    ])
    return ok(c, {
      ...row,
      pembacaan: denganSumberResmi(
        pembacaan.find((item) => item.meter.pelangganId === row.pelangganId) ??
          row.pembacaan,
      ),
    })
  },
)

const createSchema = z.object({
  pelangganId: z.string().min(1),
  periode: z.coerce.number().int().min(190001).max(999912),
  standDilaporkan: z.coerce.number().int().min(0),
  fotoUrl: z.url(),
  fotoPublicId: z.string().trim().min(1),
  nomorPelapor: z.string().trim().min(1).max(30),
  namaPelapor: z.string().trim().min(1).max(150),
})

// Tanpa requireRole: pelanggan (role USER) memang pengirim utama laporan ini.
// @@unique([pelangganId, periode]) -> kirim dua kali utk periode sama = 409,
// KECUALI laporan sebelumnya DITOLAK (lihat di bawah).
laporanMandiriRouter.post("/", validate("json", createSchema), async (c) => {
  // Jendela tanggal 1-25 ditegakkan DI SINI JUGA, bukan hanya di
  // /publik/lapor-meter. Keduanya membuat baris LaporanMandiri yang sama;
  // menjaga satu pintu saja berarti aturannya bisa dilewati lewat pintu
  // lain, dan aturan yang punya jalan memutar bukan aturan.
  const jendela = jendelaLaporMandiri()
  if (!jendela.boleh) throw new BadRequestError(jendela.pesan)

  const body = c.req.valid("json")
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: body.pelangganId },
  })
  if (!pelanggan || pelanggan.deletedAt) throw new NotFoundError("Pelanggan")

  // KIRIM ULANG SETELAH DITOLAK. Aturan "satu laporan per periode" mengikat
  // laporan yang masih hidup (MENUNGGU) dan yang sudah jadi angka resmi
  // (DIVERIFIKASI/DIGUNAKAN) — bukan yang ditolak. Penolakan lazimnya berbunyi
  // "foto tidak terbaca, kirim ulang"; menahan pengiriman berikutnya sampai
  // periode berganti membuat perintah itu tidak mungkin dijalankan. Barisnya
  // DITIMPA, bukan digandakan — alasannya sama dengan di /publik/lapor-meter:
  // nama berkas foto deterministik per periode, jadi baris kedua akan menunjuk
  // foto yang sudah tergantikan.
  const sudahAda = await prisma.laporanMandiri.findUnique({
    where: {
      pelangganId_periode: {
        pelangganId: body.pelangganId,
        periode: body.periode,
      },
    },
  })
  if (sudahAda && sudahAda.status !== "DITOLAK") {
    throw new ConflictError(
      `Laporan periode ${body.periode} untuk pelanggan ini sudah ada (status: ${sudahAda.status}). Satu laporan per periode.`,
    )
  }
  if (sudahAda) {
    // createdAt disegarkan: antrean verifikasi diurutkan & disaring memakai
    // kolom ini ("kiriman warga hari ini"), dan setelah ditimpa baris ini
    // memang kiriman baru — bukan yang bertanggal lama.
    const diperbarui = await prisma.laporanMandiri.update({
      where: { id: sudahAda.id },
      data: {
        ...body,
        status: "MENUNGGU",
        alasanDitolak: null,
        verifiedAt: null,
        verifiedById: null,
        createdAt: new Date(),
      },
    })
    return created(c, diperbarui)
  }

  const row = await prisma.laporanMandiri.create({
    data: { ...body, nomorLangganan: pelanggan.nomorLangganan },
  })
  return created(c, row)
})

const verifySchema = z.object({
  meterId: z.string().min(1),
  standLalu: z.coerce.number().int().min(0),
  blokTarif: z.coerce.number().int().min(1).max(4),
  pemakaianM3: z.coerce.number().int().min(0).optional(),
  /// Koreksi angka stand bila pelapor salah ketik (verifikator membandingkan
  /// dengan foto). Bila diisi, angka ini menimpa `standDilaporkan` di laporan
  /// SEKALIGUS jadi standAkhir pembacaan resmi — sengaja satu angka, bukan
  /// "dilaporkan" vs "dicatat resmi" yang ambigu dibaca di tabel maupun panel.
  standDilaporkan: z.coerce.number().int().min(0).optional(),
})

/// Verifikasi + langsung jadikan PembacaanMeter resmi (status DIGUNAKAN).
/// kategori OFFSITE — stand dilaporkan pelanggan, bukan dibaca petugas di
/// lokasi.
laporanMandiriRouter.patch(
  "/:id/verify",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", verifySchema),
  async (c) => {
    const id = c.req.param("id")
    const { meterId, standLalu, blokTarif, standDilaporkan, pemakaianM3 } =
      c.req.valid("json")
    const requester = getSessionUser(c)

    const laporan = await prisma.laporanMandiri.findUnique({ where: { id } })
    if (!laporan) throw new NotFoundError("LaporanMandiri")
    if (laporan.status !== "MENUNGGU")
      throw new ConflictError(
        `Laporan sudah diproses sebelumnya (status: ${laporan.status})`,
      )

    const meter = await prisma.meter.findUnique({ where: { id: meterId } })
    if (!meter) throw new NotFoundError("Meter")

    const standAkhir = standDilaporkan ?? laporan.standDilaporkan
    const pemakaianRiil = Math.max(0, standAkhir - standLalu)
    const pemakaianTagih = pemakaianM3 ?? pemakaianRiil

    const row = await prisma.$transaction(async (tx) => {
      const pembacaan = await simpanPembacaanResmi(tx, {
        pelangganId: laporan.pelangganId,
        meterId,
        periode: laporan.periode,
        sumber: "KONSUMEN",
        laporanId: laporan.id,
        data: {
          standLalu,
          standAkhir,
          pemakaianM3: pemakaianTagih,
          pemakaianRiil,
          alasanTaksir:
            pemakaianTagih === pemakaianRiil ? null : "OVERRIDE_MANUAL",
          blokTarif,
          kategori: "OFFSITE",
          fotoBukti: laporan.fotoUrl,
        },
      })
      return tx.laporanMandiri.update({
        where: { id },
        data: {
          status: "DIGUNAKAN",
          verifiedAt: new Date(),
          verifiedById: requester.id,
          pembacaanId: pembacaan.id,
          // Laporan ikut dikoreksi supaya tabel /laporan-mandiri (yang membaca
          // standDilaporkan) tidak memperlihatkan angka lama yang sudah ditolak
          // verifikator.
          standDilaporkan: standAkhir,
        },
        include: { pembacaan: true },
      })
    })

    return ok(c, row)
  },
)

const rejectSchema = z.object({
  alasanDitolak: z.string().trim().min(1).max(500),
})

laporanMandiriRouter.patch(
  "/:id/reject",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", rejectSchema),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const laporan = await prisma.laporanMandiri.findUnique({ where: { id } })
    if (!laporan) throw new NotFoundError("LaporanMandiri")
    if (laporan.status !== "MENUNGGU")
      throw new ConflictError(
        `Laporan sudah diproses sebelumnya (status: ${laporan.status})`,
      )

    const row = await prisma.laporanMandiri.update({
      where: { id },
      data: {
        status: "DITOLAK",
        alasanDitolak: c.req.valid("json").alasanDitolak,
        verifiedAt: new Date(),
        verifiedById: requester.id,
      },
    })
    return ok(c, row)
  },
)

/// "Unverifikasi": membatalkan hasil proses — DIGUNAKAN/DIVERIFIKASI maupun
/// DITOLAK kembali ke MENUNGGU. Pembatalan laporan yang sudah jadi
/// PembacaanMeter resmi ikut menghapus pembacaannya, dan ditolak bila
/// pembacaan itu sudah dipakai Tagihan (angka penagihan tidak boleh berubah
/// diam-diam).
laporanMandiriRouter.patch(
  "/:id/unverify",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const id = c.req.param("id")
    const laporan = await prisma.laporanMandiri.findUnique({ where: { id } })
    if (!laporan) throw new NotFoundError("LaporanMandiri")
    if (laporan.status === "MENUNGGU")
      throw new ConflictError(
        "Laporan masih menunggu — belum ada hasil verifikasi untuk dibatalkan",
      )

    if (laporan.pembacaanId) {
      const tagihan = await prisma.tagihan.findUnique({
        where: { pembacaanId: laporan.pembacaanId },
      })
      if (tagihan)
        throw new ConflictError(
          "Pembacaan resmi laporan ini sudah dipakai tagihan — tidak bisa dibatalkan",
        )

      const pembacaanId = laporan.pembacaanId
      const row = await prisma.$transaction(async (tx) => {
        const diperbarui = await tx.laporanMandiri.update({
          where: { id },
          data: {
            status: "MENUNGGU",
            verifiedAt: null,
            verifiedById: null,
            alasanDitolak: null,
            pembacaanId: null,
          },
        })
        await tx.pembacaanMeter.delete({ where: { id: pembacaanId } })
        return diperbarui
      })
      return ok(c, row)
    }

    const row = await prisma.laporanMandiri.update({
      where: { id },
      data: {
        status: "MENUNGGU",
        verifiedAt: null,
        verifiedById: null,
        alasanDitolak: null,
      },
    })
    return ok(c, row)
  },
)
