// server/modules/pemutusan/pemutusan.router.ts — riwayat pemutusan
// sambungan (TSM/SPT dari closing resmi, LAINNYA dari survei lapangan).
//
// KEPUTUSAN PENTING (konsisten dengan seed, lihat prisma/docs/README.md):
// mencatat pemutusan TIDAK PERNAH mengubah `Pelanggan.status` sebagai efek
// samping. Pencatatan pemutusan dan perubahan status pelanggan adalah dua
// keputusan bisnis terpisah, supaya tidak ada perubahan tersembunyi di data
// billing.
//
// Perubahan status punya pintunya sendiri yang HARUS ditekan manusia:
// POST /pemutusan/terapkan-status di bawah (pratinjau dulu, lalu setujui),
// atau PATCH /pelanggan/:id untuk satu pelanggan. Yang dilarang adalah
// otomatisnya, bukan perubahannya.
//
// `pelangganId` opsional: 219 titik "Eks Pelanggan" dari survei geojson
// adalah histori cabut lama yang nolg-nya kerap tidak ada di tabel
// Pelanggan. Snapshot `nomorLangganan`/`namaPelanggan` tetap diisi supaya
// baris orphan tidak kehilangan identitas.
import { Hono } from "hono"
import { z } from "zod"
import { JenisPemutusan } from "@db"
import type { StatusPelanggan } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError } from "../../lib/errors"
import { recordAudit, auditMetaFromRequest } from "../../lib/audit"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/pagination"
import {
  GEO,
  setPoint,
  getPointGeoJson,
  getPointGeoJsonMany,
} from "../../lib/spatial"

export const pemutusanRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "periode",
    "jenis",
    "nomorLangganan",
    "namaPelanggan",
    "tanggalSPT",
  ]),
  q: z.string().trim().min(1).optional(),
  pelangganId: z.string().optional(),
  jenis: z.enum(JenisPemutusan).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  sumberData: z.string().optional(),
})

pemutusanRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const where = {
      pelangganId: query.pelangganId,
      jenis: query.jenis,
      periode: query.periode,
      sumberData: query.sumberData,
      ...(query.q
        ? {
            OR: [
              { nomorLangganan: { contains: query.q } },
              {
                namaPelanggan: {
                  contains: query.q,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.pemutusan.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { createdAt: "desc" }),
        include: {
          pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
          kelurahan: { select: { id: true, nama: true } },
        },
      }),
      prisma.pemutusan.count({ where }),
    ])
    const koord = await getPointGeoJsonMany(
      prisma,
      GEO.pemutusan,
      rows.map((r) => r.id),
    )
    return paginated(
      c,
      rows.map((r) => ({ ...r, koordinatVerifikasi: koord.get(r.id) ?? null })),
      buildMeta(total, query),
    )
  },
)

pemutusanRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const id = c.req.param("id")
  const row = await prisma.pemutusan.findUnique({
    where: { id },
    include: { pelanggan: true, kelurahan: true, kecamatan: true },
  })
  if (!row) throw new NotFoundError("Pemutusan")
  return ok(c, {
    ...row,
    koordinatVerifikasi: await getPointGeoJson(prisma, GEO.pemutusan, id),
  })
})

const createSchema = z.object({
  pelangganId: z.string().min(1).nullable().optional(),
  kelurahanId: z.string().min(1).nullable().optional(),
  kecamatanId: z.string().min(1).nullable().optional(),
  nomorLangganan: z.string().trim().max(20).nullable().optional(),
  namaPelanggan: z.string().trim().max(200).nullable().optional(),
  jenis: z.enum(JenisPemutusan),
  periode: z.coerce.number().int().min(190001).max(999912),
  nomorSurat: z.string().trim().max(100).nullable().optional(),
  tanggalPermohonan: z.coerce.date().nullable().optional(),
  nomorSPT: z.string().trim().max(100).nullable().optional(),
  tanggalSPT: z.coerce.date().nullable().optional(),
  tanggalTutup: z.coerce.date().nullable().optional(),
  tanggalCabut: z.coerce.date().nullable().optional(),
  koordinatVerifikasi: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable()
    .optional(),
  catatanSurveiAsli: z.string().max(1000).nullable().optional(),
  catatan: z.string().max(500).nullable().optional(),
})

pemutusanRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createSchema),
  async (c) => {
    const { koordinatVerifikasi, ...body } = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.pemutusan.create({
        data: { ...body, sumberData: "API", prosesOlehId: requester.id },
      })
      if (koordinatVerifikasi)
        await setPoint(
          tx,
          GEO.pemutusan,
          row.id,
          koordinatVerifikasi.lat,
          koordinatVerifikasi.lng,
        )

      // TANDAI DAFTAR CATAT PERIODE ITU SEBAGAI DICABUT.
      //
      // Inilah yang membuat pemutusan benar-benar berpengaruh pada siklus.
      // Tanpa baris ini, sambungan yang dicabut lewat aplikasi TETAP muncul di
      // daftar kerja bulan berikutnya — terus dikunjungi dan terus ditagih —
      // karena "buka bulan baru" mengeluarkan pelanggan berdasarkan tanda
      // DICABUT di daftar catat, bukan berdasarkan tabel Pemutusan.
      // Sebelumnya tanda itu HANYA pernah dibuat oleh skrip seed dari
      // r-nomor.csv, sehingga cabutan dari aplikasi tidak berefek sama sekali.
      //
      // Barisnya tidak dihapus, hanya ditandai: beban kerja periode berjalan
      // tidak boleh berubah surut — petugas memang sudah mengunjunginya.
      if (body.pelangganId) {
        await tx.daftarCatat.updateMany({
          where: { periode: body.periode, pelangganId: body.pelangganId },
          data: { status: "DICABUT", selesaiAt: new Date() },
        })
      }

      await recordAudit(tx, {
        userId: requester.id,
        aksi: `PEMUTUSAN_${body.jenis}`,
        entitas: "Pemutusan",
        entitasId: row.id,
        perubahan: { after: row },
        ipAddress,
        userAgent,
      })
      return row
    })

    return created(c, {
      ...row,
      koordinatVerifikasi: koordinatVerifikasi
        ? {
            type: "Point",
            coordinates: [koordinatVerifikasi.lng, koordinatVerifikasi.lat],
          }
        : null,
    })
  },
)

// ── Terapkan status pelanggan dari pemutusan ─────────────────────────────
//
// KENAPA ADA, DAN KENAPA BENTUKNYA BEGINI. Kepala berkas ini menyatakan
// pemutusan tidak pernah mengubah Pelanggan.status otomatis, dan itu tetap
// berlaku. Yang keliru selama ini bukan aturannya, melainkan tidak adanya
// PINTU: satu-satunya jalur yang pernah mengubah status adalah unggah master
// STI dan PATCH /pelanggan/:id satu per satu. Akibatnya terukur — 34
// sambungan yang sudah dicabut Maret–Juni masih berstatus AKTIF, dan angka
// "pelanggan aktif" di layar data pelanggan meleset sebanyak itu.
//
// Jadi pintunya dibuka, tapi tetap DITEKAN MANUSIA: seorang supervisor
// memilih periodenya, melihat pratinjau baris demi baris, lalu menyetujui.
// Tidak ada yang berubah sebagai efek samping impor atau closing.
//
// STATUS TUJUAN DITURUNKAN DARI `jenis`, TIDAK DITANYAKAN KE PEMANGGIL.
// TSM -> TUTUP_SEMENTARA, SPT -> TUTUP_SPT: pemetaan yang sama dengan
// STATUS_DARI_MUTASI di master-sti.service.ts (mutasikode 5 & 4). Baris
// berjenis LAINNYA ("terkonfirmasi cabut, jenis belum diketahui") SENGAJA
// tidak ditebak — ia dilewati dan dilaporkan, supaya yang perlu ditentukan
// manusia terlihat jelas alih-alih diam-diam jadi TUTUP_SEMENTARA.
const STATUS_DARI_JENIS: Partial<Record<JenisPemutusan, StatusPelanggan>> = {
  TSM: "TUTUP_SEMENTARA",
  SPT: "TUTUP_SPT",
}

const terapkanStatusSchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912),
  /// Bawaannya PRATINJAU. Menulis harus dinyatakan eksplisit — layar boleh
  /// memanggil endpoint ini untuk "berapa yang akan berubah?" tanpa risiko
  /// mengubah apa pun.
  terapkan: z.boolean().optional(),
})

interface BarisTerap {
  pemutusanId: string
  nomorLangganan: string | null
  namaPelanggan: string | null
  jenis: string
  statusSekarang: StatusPelanggan | null
  statusTujuan: StatusPelanggan | null
  tindakan:
    | "AKAN_DIUBAH"
    | "SUDAH_SESUAI"
    | "TANPA_PELANGGAN"
    | "JENIS_BELUM_PASTI"
    | "TERSAMBUNG_KEMBALI"
}

pemutusanRouter.post(
  "/terapkan-status",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", terapkanStatusSchema),
  async (c) => {
    const { periode, terapkan } = c.req.valid("json")
    const requester = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const rows = await prisma.pemutusan.findMany({
      where: { periode },
      select: {
        id: true,
        jenis: true,
        nomorLangganan: true,
        namaPelanggan: true,
        pelanggan: {
          select: {
            id: true,
            nama: true,
            nomorLangganan: true,
            status: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { nomorLangganan: "asc" },
    })

    // PENJAGA "TERSAMBUNG KEMBALI". Mutasi "Pembukaan Kembali PS/SPT" nyata
    // ada di data ini (lihat bulan-baru.service.ts: lima kejadian di 202604),
    // dan tanpa penjaga ini menerapkan status periode LAMA akan mengembalikan
    // sambungan yang sudah hidup lagi menjadi tertutup — merusak data yang
    // benar dengan keputusan yang sudah kedaluwarsa.
    //
    // Tandanya diambil dari daftar catat: muncul lagi di periode SESUDAH
    // pemutusannya dengan status selain DICABUT = ia kembali jadi pekerjaan,
    // artinya sudah tersambung lagi.
    const idPelanggan = rows
      .map((r) => r.pelanggan?.id)
      .filter((v): v is string => !!v)
    const sesudah = await prisma.daftarCatat.findMany({
      where: {
        pelangganId: { in: idPelanggan },
        periode: { gt: periode },
        status: { not: "DICABUT" },
      },
      select: { pelangganId: true },
      distinct: ["pelangganId"],
    })
    const tersambungLagi = new Set(sesudah.map((x) => x.pelangganId))

    const rencana: BarisTerap[] = rows.map((r) => {
      const tujuan = STATUS_DARI_JENIS[r.jenis] ?? null
      const dasar = {
        pemutusanId: r.id,
        nomorLangganan: r.pelanggan?.nomorLangganan ?? r.nomorLangganan,
        namaPelanggan: r.pelanggan?.nama ?? r.namaPelanggan,
        jenis: r.jenis,
        statusSekarang: r.pelanggan?.status ?? null,
        statusTujuan: tujuan,
      }
      if (!tujuan) return { ...dasar, tindakan: "JENIS_BELUM_PASTI" as const }
      // Pelanggan yang sudah dihapus diperlakukan sama dengan yang tidak
      // punya baris Pelanggan: tidak ada yang bisa diubah statusnya.
      if (!r.pelanggan || r.pelanggan.deletedAt)
        return { ...dasar, tindakan: "TANPA_PELANGGAN" as const }
      if (tersambungLagi.has(r.pelanggan.id))
        return { ...dasar, tindakan: "TERSAMBUNG_KEMBALI" as const }
      if (r.pelanggan.status === tujuan)
        return { ...dasar, tindakan: "SUDAH_SESUAI" as const }
      return { ...dasar, tindakan: "AKAN_DIUBAH" as const }
    })

    const akanDiubah = rencana.filter((r) => r.tindakan === "AKAN_DIUBAH")
    const ringkas = {
      periode,
      diperiksa: rencana.length,
      akanDiubah: akanDiubah.length,
      sudahSesuai: rencana.filter((r) => r.tindakan === "SUDAH_SESUAI").length,
      tanpaPelanggan: rencana.filter((r) => r.tindakan === "TANPA_PELANGGAN")
        .length,
      jenisBelumPasti: rencana.filter((r) => r.tindakan === "JENIS_BELUM_PASTI")
        .length,
      tersambungKembali: rencana.filter(
        (r) => r.tindakan === "TERSAMBUNG_KEMBALI",
      ).length,
    }

    if (!terapkan) return ok(c, { ...ringkas, diterapkan: false, rencana })

    // Satu transaksi per baris, bukan satu transaksi raksasa: perubahan status
    // ini per-pelanggan dan saling bebas — satu baris bermasalah tidak boleh
    // membatalkan yang lain. Jejak audit ditulis bersama perubahannya supaya
    // tidak pernah ada perubahan status tanpa nama orang di belakangnya.
    let diubah = 0
    for (const r of akanDiubah) {
      const asal = rows.find((x) => x.id === r.pemutusanId)!
      await prisma.$transaction(async (tx) => {
        await tx.pelanggan.update({
          where: { id: asal.pelanggan!.id },
          data: { status: r.statusTujuan! },
        })
        await recordAudit(tx, {
          userId: requester.id,
          aksi: "UBAH_STATUS_DARI_PEMUTUSAN",
          entitas: "Pelanggan",
          entitasId: asal.pelanggan!.id,
          perubahan: {
            before: { status: r.statusSekarang },
            after: { status: r.statusTujuan },
            dasar: { pemutusanId: r.pemutusanId, periode, jenis: r.jenis },
          },
          ipAddress,
          userAgent,
        })
      })
      diubah++
    }

    return ok(c, { ...ringkas, diterapkan: true, diubah, rencana })
  },
)
