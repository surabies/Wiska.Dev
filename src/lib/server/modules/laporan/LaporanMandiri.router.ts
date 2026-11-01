// server/modules/laporan/laporan-mandiri.router.ts — laporan stand meter
// mandiri oleh pelanggan (self-service, wajib foto bukti).
//
// Verifikasi memeriksa bukti dan mengoreksi stand laporan mandiri, tetapi
// tidak membuat PembacaanMeter resmi. Hasil resmi diterbitkan melalui alur
// verifikasi petugas. Setiap percobaan/bukti lama tetap tersimpan pada
// KirimanLaporanMandiri; baris utama adalah proyeksi status dan stand terbaru.
import { Hono } from "hono"
import { z } from "zod"
import { JenisInputLaporanHarian, StatusLaporanMandiri } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created, paginated } from "../../lib/Respons"
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from "../../lib/Galat"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/Pagination"
import { dateToPeriode, periodeToDate } from "../../lib/Periode"
import { rentangTanggalWIB } from "../../lib/RentangTanggal"
import { auditMetaFromRequest, recordAudit } from "../../lib/Audit"
import { pilihPemakaianLalu } from "@/lib/domain/PemakaianLalu"
import {
  ambilPemakaianPeriodeSebelumnya,
  ambilPembacaanResmi,
  denganSumberResmi,
} from "./PembacaanResmi"
import {
  dapatkanJendelaLaporMandiri,
  pastikanSambunganTertautKeAkun,
  simpanKirimanLaporanMandiri,
} from "./LaporanMandiri.service"

export const laporanMandiriRouter = new Hono()

async function muatStandAwalSebelumnya(
  rows: { pelangganId: string; periode: number }[]
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
      return stand === undefined
        ? []
        : [[`${row.pelangganId}:${row.periode}`, stand]]
    })
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

/// Filter "DIVERIFIKASI" juga memuat status "DIGUNAKAN" lama untuk menjaga
/// kompatibilitas data yang dibuat sebelum verifikasi Mandiri dipisahkan dari
/// penerbitan pembacaan resmi.
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
              pemakaianLalu: true,
            },
          },
        },
      }),
      prisma.laporanMandiri.count({ where }),
    ])
    const pembacaanResmi = await ambilPembacaanResmi(
      data.map((row) => ({
        pelangganId: row.pelangganId,
        periode: row.periode,
      }))
    )
    const petaPembacaan = new Map()
    for (const row of pembacaanResmi) {
      const kunci = `${row.meter.pelangganId}:${dateToPeriode(row.periode)}`
      if (!petaPembacaan.has(kunci))
        petaPembacaan.set(kunci, denganSumberResmi(row))
    }
    const standAwalSebelumnya = await muatStandAwalSebelumnya(data)
    const pemakaianPeriodeSebelumnya = await ambilPemakaianPeriodeSebelumnya(
      data.map((row) => ({
        pelangganId: row.pelangganId,
        periode: row.periode,
      }))
    )
    const dataDenganPembacaan = data.map((row) => ({
      ...row,
      standAwal:
        petaPembacaan.get(`${row.pelangganId}:${row.periode}`)?.standLalu ??
        standAwalSebelumnya.get(`${row.pelangganId}:${row.periode}`) ??
        null,
      pemakaianLalu: pilihPemakaianLalu(
        petaPembacaan.get(`${row.pelangganId}:${row.periode}`)?.pemakaianLalu,
        row.pembacaan?.pemakaianLalu,
        pemakaianPeriodeSebelumnya.get(`${row.periode}:${row.pelangganId}`)
      ),
      pembacaan:
        petaPembacaan.get(`${row.pelangganId}:${row.periode}`) ??
        (row.pembacaan ? denganSumberResmi(row.pembacaan) : null),
    }))
    return paginated(c, dataDenganPembacaan, buildMeta(total, query))
  }
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
      perStatus.map((s) => [s.status, s._count._all])
    ) as Partial<Record<StatusLaporanMandiri, number>>
    const total = perStatus.reduce((acc, s) => acc + s._count._all, 0)
    return ok(c, {
      total,
      menunggu: hitung.MENUNGGU ?? 0,
      diverifikasi: (hitung.DIVERIFIKASI ?? 0) + (hitung.DIGUNAKAN ?? 0),
      ditolak: hitung.DITOLAK ?? 0,
      periodes: periodes.map((p) => p.periode),
    })
  }
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
          row.pembacaan
      ),
    })
  }
)

const createSchema = z.object({
  pelangganId: z.string().min(1),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  standDilaporkan: z.coerce.number().int().min(0),
  fotoUrl: z.url(),
  fotoPublicId: z.string().trim().min(1),
  nomorPelapor: z.string().trim().min(1).max(30),
  namaPelapor: z.string().trim().min(1).max(150),
})

// Jalur akun hanya menerima sambungan yang tertaut ke akun warga yang sedang
// login. Laporan ini adalah bukti; pembacaan resmi diterbitkan terpisah lewat
// verifikasi laporan petugas.
laporanMandiriRouter.post("/", validate("json", createSchema), async (c) => {
  const requester = getSessionUser(c)
  if (requester.role !== "USER") {
    throw new ForbiddenError("Jalur ini hanya untuk akun warga.")
  }

  // Jendela tanggal ditegakkan DI SINI JUGA, bukan hanya di
  // /publik/lapor-meter. Keduanya membuat baris LaporanMandiri yang sama;
  // menjaga satu pintu saja berarti aturannya bisa dilewati lewat pintu
  // lain, dan aturan yang punya jalan memutar bukan aturan.
  const jendela = await dapatkanJendelaLaporMandiri()
  if (!jendela.boleh) throw new BadRequestError(jendela.pesan)

  const body = c.req.valid("json")
  if (body.periode !== undefined && body.periode !== jendela.periode) {
    throw new BadRequestError(
      `Periode laporan harus mengikuti periode berjalan ${jendela.periode}.`
    )
  }
  const pelanggan = await pastikanSambunganTertautKeAkun(
    requester.id,
    body.pelangganId
  )

  const row = await simpanKirimanLaporanMandiri({
    pelangganId: pelanggan.id,
    nomorLangganan: pelanggan.nomorLangganan,
    periode: jendela.periode,
    standDilaporkan: body.standDilaporkan,
    fotoUrl: body.fotoUrl,
    fotoPublicId: body.fotoPublicId,
    nomorPelapor: body.nomorPelapor,
    namaPelapor: body.namaPelapor,
    pengirimId: requester.id,
  })
  return created(c, row)
})

const verifySchema = z.object({
  /// Stand yang sudah dicocokkan atau dikoreksi berdasarkan foto.
  standDilaporkan: z.coerce.number().int().min(0).optional(),
})

function hitungPersentaseLaporan(
  pemakaian: number,
  pemakaianLalu: number | null
) {
  if (pemakaianLalu == null || pemakaianLalu === 0) return null
  const nilai = Math.round(((pemakaian - pemakaianLalu) / pemakaianLalu) * 100)
  return Number.isSafeInteger(nilai) && Math.abs(nilai) <= 2_147_483_647
    ? nilai
    : null
}

/// Verifikasi Mandiri menyinkronkan koreksi ke antrean Petugas dan mereset
/// tahap lama. PembacaanMeter tetap hanya diterbitkan melalui verifikasi V3.
laporanMandiriRouter.patch(
  "/:id/verify",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", verifySchema),
  async (c) => {
    const id = c.req.param("id")
    const { standDilaporkan } = c.req.valid("json")
    const requester = getSessionUser(c)

    const laporan = await prisma.laporanMandiri.findUnique({
      where: { id },
      include: { pelanggan: { select: { nama: true, alamat: true } } },
    })
    if (!laporan) throw new NotFoundError("LaporanMandiri")
    if (laporan.status !== "MENUNGGU")
      throw new ConflictError(
        `Laporan sudah diproses sebelumnya (status: ${laporan.status})`
      )
    const standKoreksi = standDilaporkan ?? laporan.standDilaporkan

    const row = await prisma.$transaction(async (tx) => {
      const periode = await tx.periodePenagihan.findUnique({
        where: { periode: laporan.periode },
        select: { status: true },
      })
      if (periode?.status === "TERKUNCI") {
        throw new ConflictError(
          "Periode sudah ditutup; laporan Mandiri tidak dapat mengganti data verifikasi."
        )
      }

      const laporanPetugas = await tx.laporanHarianPetugas.findUnique({
        where: {
          nomorLangganan_periode: {
            nomorLangganan: laporan.nomorLangganan,
            periode: laporan.periode,
          },
        },
        include: {
          pembacaan: {
            select: { id: true, tagihan: { select: { id: true } } },
          },
        },
      })
      const sudahDiverifikasi =
        laporanPetugas &&
        (laporanPetugas.verif1At != null ||
          laporanPetugas.verif2At != null ||
          laporanPetugas.verif3At != null ||
          laporanPetugas.isVerified ||
          laporanPetugas.pembacaanId != null)
      if (
        sudahDiverifikasi &&
        !(ROLE_GROUPS.SENIOR_UP as readonly string[]).includes(requester.role)
      ) {
        throw new ForbiddenError(
          "Mengganti hasil verifikasi Petugas memerlukan kewenangan V3 (Senior Manager ke atas)."
        )
      }
      if (laporanPetugas?.pembacaan?.tagihan) {
        throw new ConflictError(
          "Hasil periode ini sudah masuk proses tagihan; selesaikan atau batalkan proses closing sebelum mengoreksinya."
        )
      }

      let standAwal = laporanPetugas?.standAwal
      if (!laporanPetugas) {
        const meterAktif = await tx.meter.findMany({
          where: { pelangganId: laporan.pelangganId, isAktif: true },
          select: { id: true },
          take: 2,
        })
        if (meterAktif.length > 1) {
          throw new ConflictError(
            "Stand awal tidak dapat ditentukan karena pelanggan memiliki lebih dari satu meter aktif."
          )
        }
        const meterId = meterAktif[0]?.id
        const pembacaanSebelumnya = meterId
          ? await tx.pembacaanMeter.findFirst({
              where: {
                meterId,
                periode: { lt: periodeToDate(laporan.periode) },
              },
              orderBy: { periode: "desc" },
              select: { standAkhir: true },
            })
          : null
        standAwal = pembacaanSebelumnya?.standAkhir ?? 0
      }
      standAwal ??= 0
      const pemakaian = standKoreksi - standAwal
      const dataSinkron = {
        standAkhir: standKoreksi,
        pemakaian,
        persentase: hitungPersentaseLaporan(
          pemakaian,
          laporanPetugas?.pemakaianLalu ?? null
        ),
        kategori: "OFFSITE" as const,
        jenisInput: JenisInputLaporanHarian.KONSUMEN,
        fotoStandUrl: laporan.fotoUrl,
        tanggalCatat: laporanPetugas?.tanggalCatat ?? laporan.createdAt,
        isVerified: false,
        verifiedAt: null,
        verifiedById: null,
        catatanVerif: null,
        pembacaanId: null,
        pemakaianTagihVerif: null,
        blokTarifVerif: null,
        meterVerifId: null,
        standAkhirRevisi: null,
        standAwalRevisi: null,
        kondisiRevisi: null,
        standAngkatLama: null,
        standMeterBaru: null,
        verif1At: null,
        verif1ById: null,
        verif2At: null,
        verif2ById: null,
        verif3At: null,
        verif3ById: null,
      }

      let petugasDiperbarui
      if (laporanPetugas) {
        const hasilSinkron = await tx.laporanHarianPetugas.updateMany({
          where: {
            id: laporanPetugas.id,
            verif1At: laporanPetugas.verif1At,
            verif2At: laporanPetugas.verif2At,
            verif3At: laporanPetugas.verif3At,
            isVerified: laporanPetugas.isVerified,
            pembacaanId: laporanPetugas.pembacaanId,
          },
          data: dataSinkron,
        })
        if (hasilSinkron.count !== 1) {
          throw new ConflictError(
            "Data verifikasi Petugas berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
          )
        }
        if (laporanPetugas.pembacaanId) {
          await tx.pembacaanMeter.delete({
            where: { id: laporanPetugas.pembacaanId },
          })
        }
        petugasDiperbarui = await tx.laporanHarianPetugas.findUniqueOrThrow({
          where: { id: laporanPetugas.id },
        })
      } else {
        petugasDiperbarui = await tx.laporanHarianPetugas.create({
          data: {
            nomorLangganan: laporan.nomorLangganan,
            pelangganId: laporan.pelangganId,
            namaPelanggan: laporan.pelanggan.nama,
            alamatPelanggan: laporan.pelanggan.alamat,
            periode: laporan.periode,
            standAwal,
            ...dataSinkron,
          },
        })
      }

      const verifiedAt = new Date()
      const hasilUpdate = await tx.laporanMandiri.updateMany({
        where: { id, status: "MENUNGGU" },
        data: {
          status: "DIVERIFIKASI",
          verifiedAt,
          verifiedById: requester.id,
          standDilaporkan: standKoreksi,
        },
      })
      if (hasilUpdate.count !== 1) {
        throw new ConflictError(
          "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
        )
      }

      const hasil = await tx.laporanMandiri.findUniqueOrThrow({
        where: { id },
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: laporanPetugas
          ? "LAPORAN_MANDIRI_SINKRON_PETUGAS"
          : "LAPORAN_MANDIRI_MASUK_PETUGAS",
        entitas: "LaporanHarianPetugas",
        entitasId: petugasDiperbarui.id,
        perubahan: {
          sebelum: laporanPetugas
            ? {
                standAkhir: laporanPetugas.standAkhir,
                verif1At: laporanPetugas.verif1At,
                verif2At: laporanPetugas.verif2At,
                verif3At: laporanPetugas.verif3At,
                pembacaanId: laporanPetugas.pembacaanId,
              }
            : null,
          sesudah: {
            standAkhir: standKoreksi,
            verif1At: null,
            verif2At: null,
            verif3At: null,
            pembacaanId: null,
          },
          laporanMandiriId: id,
        },
        ...auditMetaFromRequest(c.req.raw),
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "VERIFIKASI_LAPORAN_MANDIRI",
        entitas: "LaporanMandiri",
        entitasId: id,
        perubahan: {
          sebelum: {
            status: laporan.status,
            standDilaporkan: laporan.standDilaporkan,
          },
          sesudah: {
            status: "DIVERIFIKASI",
            standDilaporkan: hasil.standDilaporkan,
          },
        },
        ...auditMetaFromRequest(c.req.raw),
      })
      return hasil
    })

    return ok(c, row)
  }
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
        `Laporan sudah diproses sebelumnya (status: ${laporan.status})`
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
  }
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
        "Laporan masih menunggu — belum ada hasil verifikasi untuk dibatalkan"
      )

    if (laporan.pembacaanId) {
      const tagihan = await prisma.tagihan.findUnique({
        where: { pembacaanId: laporan.pembacaanId },
      })
      if (tagihan)
        throw new ConflictError(
          "Pembacaan resmi laporan ini sudah dipakai tagihan — tidak bisa dibatalkan"
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
  }
)
