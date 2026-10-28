// server/modules/pengaduan/pengaduan.router.ts — sisi PETUGAS dari alur
// pengaduan (aduan masyarakat, termasuk keluhan kebocoran). Sisi warga ada
// di server/modules/publik/publik.router.ts.
//
// Aturan yang mengikat seluruh file ini: perubahan status TIDAK PERNAH
// ditulis lewat `prisma.pengaduan.update({ data: { status } })` — semuanya
// lewat `transisiPengaduan()` di alur.ts, supaya setiap perubahan otomatis
// punya jejak di linimasa dan efek samping SLA-nya tidak terlewat. Lihat
// alasan lengkapnya di alur.ts.
//
// Catatan akses: POST terbuka untuk SEMUA user yang login (termasuk role
// USER = pelanggan), karena inilah kanal masuk aduan. Pengelolaan
// (tugaskan/ubah status/eskalasi) dibatasi SUPERVISOR ke atas; menulis
// catatan tindak lanjut dibuka untuk STAFF ke atas — petugas lapanganlah
// yang tahu perkembangannya, dan memaksa mereka menitip lewat supervisor
// hanya membuat linimasa kosong.
import { Hono, type Context } from "hono"
import { z } from "zod"
import {
  JenisPengaduan,
  KlasifikasiPengaduan,
  PrioritasPengaduan,
  StatusPengaduan,
  type Prisma,
} from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../lib/errors"
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
  findNearby,
} from "../../lib/spatial"
import { simpanBerkas, BerkasTidakValidError } from "../../lib/storage"
import { buatNomorTiketUnik, normalisasiNomorTiket } from "./tiket"
import { hitungTargetSla, prioritasAwal, ringkasSla } from "./sla"
import {
  transisiPengaduan,
  catatRiwayat,
  TRANSISI,
  TRANSISI_PETUGAS,
  type Pelaku,
} from "./alur"
import {
  ambilBatasKonfirmasiJam,
  hitungKonfirmasiBatasAt,
  sapuTutupOtomatis,
} from "./otomatis"
import { tandaiWilayah } from "./wilayah"
import { getNotifier } from "../notifikasi/notifier"

export const pengaduanRouter = new Hono()

/// Pelaku linimasa dari session. Nama di-snapshot di sini (bukan cuma id)
/// supaya linimasa tetap terbaca kalau user-nya kelak dihapus/berganti nama.
function pelakuDariSession(c: Context): Pelaku {
  const user = getSessionUser(c)
  return { id: user.id, nama: user.name ?? user.email }
}

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "status",
    "prioritas",
    "jenis",
    "judul",
    "pelapor",
    "nomorTiket",
    "targetSelesaiAt",
  ]),
  q: z.string().trim().min(1).optional(),
  jenis: z.enum(JenisPengaduan).optional(),
  status: z.enum(StatusPengaduan).optional(),
  prioritas: z.enum(PrioritasPengaduan).optional(),
  pelangganId: z.string().optional(),
  ditugaskanKeId: z.string().optional(),
  /// Saring antrean per wilayah kejadian (hasil auto-tag ST_Contains saat
  /// tiket dibuat — lihat wilayah.ts).
  kelurahanId: z.string().optional(),
  kecamatanId: z.string().optional(),
  /// "tiket terbuka yang tenggatnya sudah lewat" — antrean yang paling perlu
  /// dilihat supervisor tiap pagi.
  melanggarSla: z.coerce.boolean().optional(),
  /// Tiket yang ditugaskan ke SAYA. Dipakai petugas lapangan; lebih jujur
  /// daripada menyuruh mereka menyalin id sendiri ke ditugaskanKeId.
  milikSaya: z.coerce.boolean().optional(),
})

// Titik kebocoran terdekat — untuk dispatch petugas dari peta dashboard.
const nearQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50000).default(1000),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

pengaduanRouter.get(
  "/near",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", nearQuerySchema),
  async (c) => {
    const { lat, lng, radius, limit } = c.req.valid("query")
    const nearby = await findNearby(prisma, GEO.pengaduan, {
      lat,
      lng,
      radiusMeters: radius,
      limit,
    })
    if (nearby.length === 0) return ok(c, [])
    const rows = await prisma.pengaduan.findMany({
      where: { id: { in: nearby.map((r) => r.id) } },
      select: {
        id: true,
        nomorTiket: true,
        jenis: true,
        judul: true,
        status: true,
        prioritas: true,
        alamatKejadian: true,
      },
    })
    const byId = new Map(rows.map((r) => [r.id, r]))
    return ok(
      c,
      nearby.flatMap((r) => {
        const row = byId.get(r.id)
        return row ? [{ ...row, jarakMeter: r.jarakMeter }] : []
      }),
    )
  },
)

/// Papan ringkasan antrean — angka untuk kartu statistik dashboard.
/// Diagregasi di DB (groupBy/count), bukan findMany().length: tabel ini
/// tumbuh terus dan menarik semua baris hanya untuk menghitungnya adalah
/// cara paling mahal yang tersedia.
pengaduanRouter.get(
  "/statistik",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const sekarang = new Date()
    const TERBUKA: StatusPengaduan[] = [
      "BARU",
      "DITUGASKAN",
      "DIPROSES",
      "MENUNGGU_PELANGGAN",
      "DIBUKA_KEMBALI",
    ]

    const [perStatus, perPrioritas, melanggarSla, belumDitugaskan, rataRating] =
      await Promise.all([
        prisma.pengaduan.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.pengaduan.groupBy({
          by: ["prioritas"],
          _count: { _all: true },
          where: { status: { in: TERBUKA } },
        }),
        prisma.pengaduan.count({
          where: { status: { in: TERBUKA }, targetSelesaiAt: { lt: sekarang } },
        }),
        prisma.pengaduan.count({ where: { status: "BARU" } }),
        prisma.pengaduan.aggregate({
          _avg: { ratingKepuasan: true },
          _count: { ratingKepuasan: true },
        }),
      ])

    return ok(c, {
      perStatus: Object.fromEntries(
        perStatus.map((r) => [r.status, r._count._all]),
      ),
      perPrioritasTerbuka: Object.fromEntries(
        perPrioritas.map((r) => [r.prioritas, r._count._all]),
      ),
      melanggarSla,
      belumDitugaskan,
      rataRating: rataRating._avg.ratingKepuasan,
      jumlahDinilai: rataRating._count.ratingKepuasan,
    })
  },
)

/// Daftar petugas yang bisa ditugaskan/dieskalasi — bahan dropdown panel
/// penanganan.
///
/// KENAPA ADA DI SINI, BUKAN PAKAI `GET /users`? `GET /users` dibatasi
/// MANAGEMENT_UP, sementara menugaskan tiket hanya butuh SUPERVISOR_UP. Ini
/// bukan detail sepele: memakai /users membuat SUPERVISOR — justru peran yang
/// paling sering menugaskan — dapat 403 dan dropdown kosong, alias tidak bisa
/// menugaskan sama sekali. Endpoint ini menutup celah itu TANPA melonggarkan
/// /users: yang keluar hanya id/nama/role akun aktif, tanpa email, kontak,
/// atau data organisasi.
pengaduanRouter.get(
  "/petugas",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  async (c) => {
    const rows = await prisma.user.findMany({
      where: { status: "ACTIVE", role: { notIn: ["USER"] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
      take: 500,
    })
    return ok(c, rows)
  },
)

pengaduanRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    const sekarang = new Date()

    const TERBUKA: StatusPengaduan[] = [
      "BARU",
      "DITUGASKAN",
      "DIPROSES",
      "MENUNGGU_PELANGGAN",
      "DIBUKA_KEMBALI",
    ]

    const where: Prisma.PengaduanWhereInput = {
      jenis: query.jenis,
      status: query.status,
      prioritas: query.prioritas,
      pelangganId: query.pelangganId,
      kelurahanId: query.kelurahanId,
      kecamatanId: query.kecamatanId,
      ditugaskanKeId: query.milikSaya
        ? getSessionUser(c).id
        : query.ditugaskanKeId,
      ...(query.q
        ? {
            OR: [
              { judul: { contains: query.q, mode: "insensitive" as const } },
              {
                nomorTiket: { contains: query.q, mode: "insensitive" as const },
              },
            ],
          }
        : {}),
      // Lewat AND, BUKAN spread `status:` di level atas — spread akan MENIMPA
      // filter `status` dari query dan diam-diam mengabaikan pilihan pengguna.
      // Disaring di DB (bukan di JS setelah paginasi): menyaring setelah `take`
      // mengembalikan halaman yang isinya kurang dari pageSize dan `total` yang
      // bohong.
      ...(query.melanggarSla
        ? {
            AND: [
              { status: { in: TERBUKA } },
              { targetSelesaiAt: { lt: sekarang } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.pengaduan.findMany({
        where,
        skip,
        take,
        // Default: yang paling mendesak di atas — prioritas, lalu tenggat
        // terdekat. Ini antrean kerja, bukan arsip kronologis.
        orderBy: buildOrderBy(query, [
          { prioritas: "desc" },
          { targetSelesaiAt: "asc" },
          { createdAt: "desc" },
        ]),
        include: {
          pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
          ditugaskanKe: { select: { id: true, name: true } },
          kelurahan: { select: { id: true, nama: true } },
          kecamatan: { select: { id: true, nama: true } },
        },
      }),
      prisma.pengaduan.count({ where }),
    ])

    const koord = await getPointGeoJsonMany(
      prisma,
      GEO.pengaduan,
      rows.map((r) => r.id),
    )
    return paginated(
      c,
      rows.map((r) => ({
        ...r,
        koordinat: koord.get(r.id) ?? null,
        sla: ringkasSla(r, sekarang),
      })),
      buildMeta(total, query),
    )
  },
)

/// "Laporan saya" — tiket yang DIBUAT oleh pengguna yang sedang login,
/// ditandai lewat `olehId` pada entri linimasa DIBUAT-nya (lihat catatan di
/// publik.router.ts: POST /api/public/pengaduan menautkan otomatis kalau
/// pelapor kebetulan sedang login). TANPA requireRole — beda dari `GET /`
/// di atas yang STAFF_UP, ini justru harus terbuka untuk role USER: warga
/// yang login butuh cara melihat riwayat laporannya sendiri tanpa mengingat
/// nomor tiket satu per satu.
///
/// WAJIB didaftarkan SEBELUM /:id — kalau tidak, "saya" akan tertelan
/// sebagai parameter :id, pola sama seperti /near, /statistik, /petugas.
pengaduanRouter.get(
  "/saya",
  validate("query", paginationQuerySchema),
  async (c) => {
    const userId = getSessionUser(c).id
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)

    const dibuatOleh = await prisma.riwayatPengaduan.findMany({
      where: { aksi: "DIBUAT", olehId: userId },
      select: { pengaduanId: true },
    })
    const ids = dibuatOleh.map((r) => r.pengaduanId)
    if (ids.length === 0) return paginated(c, [], buildMeta(0, query))

    const where: Prisma.PengaduanWhereInput = { id: { in: ids } }
    const [rows, total] = await Promise.all([
      prisma.pengaduan.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          nomorTiket: true,
          jenis: true,
          judul: true,
          status: true,
          prioritas: true,
          createdAt: true,
          targetResponsAt: true,
          targetSelesaiAt: true,
          responsAt: true,
          jedaMulaiAt: true,
          selesaiAt: true,
          ditugaskanKe: { select: { name: true } },
        },
      }),
      prisma.pengaduan.count({ where }),
    ])

    return paginated(
      c,
      rows.map((r) => ({ ...r, sla: ringkasSla(r) })),
      buildMeta(total, query),
    )
  },
)

pengaduanRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const id = c.req.param("id")
  const row = await prisma.pengaduan.findUnique({
    where: { id },
    include: {
      pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
      ditugaskanKe: { select: { id: true, name: true, role: true } },
      eskalasiKe: { select: { id: true, name: true, role: true } },
      kelurahan: { select: { id: true, nama: true } },
      kecamatan: { select: { id: true, nama: true } },
      // Petugas melihat SELURUH linimasa, termasuk catatan internal — beda
      // dari endpoint publik yang hanya mengirim `isPublik: true`.
      riwayat: {
        orderBy: { createdAt: "asc" },
        include: { oleh: { select: { id: true, name: true, role: true } } },
      },
    },
  })
  if (!row) throw new NotFoundError("Pengaduan")

  // Transisi yang BENAR-BENAR bisa dieksekusi pemanggil ini lewat
  // PATCH /:id/status — bukan matriks mentah. DITUTUP/DIBUKA_KEMBALI hak
  // pelapor (selalu disaring); STAFF dibatasi aturan operator/petugas yang
  // sama dengan handler /status.
  const user = getSessionUser(c)
  let transisiTersedia = TRANSISI[row.status].filter(
    (s) => s !== "DITUTUP" && s !== "DIBUKA_KEMBALI",
  )
  if (user.role === "STAFF") {
    transisiTersedia = transisiTersedia.filter((s) =>
      s === "TERVERIFIKASI"
        ? true
        : row.ditugaskanKeId === user.id && TRANSISI_PETUGAS.includes(s),
    )
  }

  return ok(c, {
    ...row,
    koordinat: await getPointGeoJson(prisma, GEO.pengaduan, id),
    sla: ringkasSla(row),
    /// Diserahkan ke client supaya UI bisa menampilkan HANYA tombol yang
    /// sah — daripada menawarkan aksi yang pasti ditolak server.
    transisiTersedia,
  })
})

const createSchema = z
  .object({
    pelangganId: z.string().min(1).nullable().optional(),
    nomorLangganan: z.string().trim().max(20).nullable().optional(),
    /// Opsional demi kompatibilitas dengan klien lama yang belum mengenal
    /// sumbu ini — bila kosong, kolomnya memakai default DB.
    klasifikasi: z.enum(KlasifikasiPengaduan).optional(),
    jenis: z.enum(JenisPengaduan),
    judul: z.string().trim().min(1).max(200),
    deskripsi: z.string().trim().min(1),
    koordinat: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .nullable()
      .optional(),
    alamatKejadian: z.string().trim().max(500).nullable().optional(),
    prioritas: z.enum(PrioritasPengaduan).optional(),
    pelapor: z.string().trim().min(1).max(150),
    kontakPelapor: z.string().trim().max(50).nullable().optional(),
    fotoUrl: z.url().nullable().optional(),
  })
  // Aturan bisnis dari schema: BOCOR_PIPA_DINAS wajib punya titik lokasi
  // supaya bisa di-dispatch ke petugas/rute terdekat lewat query jarak PostGIS.
  .refine((d) => d.jenis !== "BOCOR_PIPA_DINAS" || !!d.koordinat, {
    message:
      "Pengaduan jenis Bocor Pipa Dinas wajib menyertakan koordinat lokasi kejadian",
    path: ["koordinat"],
  })

// Sengaja TANPA requireRole: semua user terautentikasi (termasuk role USER)
// boleh mengirim aduan. Dipakai juga aplikasi Flutter petugas untuk mencatat
// aduan yang masuk lewat telepon/loket.
pengaduanRouter.post("/", validate("json", createSchema), async (c) => {
  const { koordinat, prioritas, ...body } = c.req.valid("json")
  const pelaku = pelakuDariSession(c)

  const prioritasFinal = prioritas ?? prioritasAwal(body.jenis)
  const sekarang = new Date()
  const target = hitungTargetSla(prioritasFinal, sekarang)

  const row = await buatNomorTiketUnik((nomorTiket) =>
    prisma.$transaction(async (tx) => {
      // Auto-tag wilayah kejadian dari koordinat (ST_Contains) — supaya
      // antrean bisa disaring per kelurahan/kecamatan sejak tiket lahir.
      const wilayah = koordinat
        ? await tandaiWilayah(tx, koordinat.lat, koordinat.lng)
        : null
      const row = await tx.pengaduan.create({
        data: {
          ...body,
          nomorTiket,
          prioritas: prioritasFinal,
          ...target,
          kelurahanId: wilayah?.kelurahanId ?? null,
          kecamatanId: wilayah?.kecamatanId ?? null,
        },
      })
      if (koordinat)
        await setPoint(tx, GEO.pengaduan, row.id, koordinat.lat, koordinat.lng)
      await catatRiwayat(tx, {
        pengaduanId: row.id,
        aksi: "DIBUAT",
        oleh: pelaku,
        catatan: `Aduan dicatat oleh ${pelaku.nama}.`,
        isPublik: true,
      })
      return row
    }),
  )

  return created(c, {
    ...row,
    koordinat: koordinat
      ? { type: "Point", coordinates: [koordinat.lng, koordinat.lat] }
      : null,
  })
})

const tugaskanSchema = z.object({
  ditugaskanKeId: z.string().min(1),
  catatan: z.string().trim().max(1000).optional(),
})

pengaduanRouter.patch(
  "/:id/tugaskan",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", tugaskanSchema),
  async (c) => {
    const id = c.req.param("id")
    const { ditugaskanKeId, catatan } = c.req.valid("json")
    const pelaku = pelakuDariSession(c)

    // Divalidasi eksplisit (bukan diserahkan ke P2003) supaya pesannya
    // menyebut MASALAHNYA — "petugas tidak ditemukan", bukan "foreign key
    // tidak valid" — dan supaya tiket tidak bisa ditugaskan ke akun nonaktif.
    const petugas = await prisma.user.findUnique({
      where: { id: ditugaskanKeId },
      select: { name: true, status: true },
    })
    if (!petugas) throw new NotFoundError("Petugas")
    if (petugas.status !== "ACTIVE")
      throw new BadRequestError("Petugas tersebut tidak berstatus aktif.")

    const row = await prisma.$transaction((tx) =>
      transisiPengaduan(tx, {
        pengaduanId: id,
        ke: "DITUGASKAN",
        aksi: "DITUGASKAN",
        oleh: pelaku,
        ditugaskanKeId,
        // Nama petugas ikut ditulis ke linimasa PUBLIK: warga berhak tahu
        // siapa yang menangani laporannya. Kontak/emailnya TIDAK — itu tetap
        // lewat kanal resmi.
        catatan: catatan ?? `Ditugaskan kepada ${petugas.name ?? "petugas"}.`,
        isPublik: true,
      }),
    )
    // Beri tahu petugas yang ditugaskan (best-effort; tak menggagalkan aksi).
    await getNotifier().kirim([ditugaskanKeId], {
      judul: "Tiket pengaduan baru ditugaskan",
      isi: `Anda ditugaskan menangani tiket ${row.nomorTiket ?? id}.`,
      tipe: "pengaduan",
      data: { tipe: "pengaduan", id },
    })
    return ok(c, row)
  },
)

/// URL foto boleh absolut (Cloudinary) atau path relatif server (fallback
/// storage dev) — pola sama seperti laporan-harian.
const urlFotoSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/"), {
    message: "URL foto harus absolut (http/https) atau path relatif server",
  })

const statusSchema = z.object({
  status: z.enum(StatusPengaduan),
  catatan: z.string().trim().max(1000).optional(),
  catatanPenyelesaian: z.string().trim().max(1000).nullable().optional(),
  /// Foto bukti hasil pekerjaan — WAJIB saat status = SELESAI (dicek di
  /// handler, bukan schema, supaya pesannya menyebut aturan bisnisnya).
  fotoPenyelesaianUrl: urlFotoSchema.nullable().optional(),
  fotoPenyelesaianPublicId: z.string().trim().max(300).nullable().optional(),
  /// Default true: perubahan STATUS adalah kabar yang memang ditunggu
  /// pelapor. Catatan internal punya endpoint sendiri (/catatan).
  isPublik: z.boolean().default(true),
})

/// STAFF_UP (bukan lagi SUPERVISOR_UP): petugas lapangan HARUS bisa
/// menggerakkan tiketnya sendiri (MENUJU_LOKASI/DIPROSES/dst) — versi lama
/// membuat seluruh app petugas gangguan 403 saat ganti status. Batasan
/// untuk role STAFF ditegakkan di handler:
///   1. verifikasi triase (BARU -> TERVERIFIKASI) — peran operator; atau
///   2. transisi TRANSISI_PETUGAS pada tiket yang DITUGASKAN KEPADANYA.
/// SUPERVISOR ke atas bebas (dalam batas matriks TRANSISI).
pengaduanRouter.patch(
  "/:id/status",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", statusSchema),
  async (c) => {
    const id = c.req.param("id")
    const {
      status,
      catatan,
      catatanPenyelesaian,
      isPublik,
      fotoPenyelesaianUrl,
      fotoPenyelesaianPublicId,
    } = c.req.valid("json")
    const user = getSessionUser(c)

    // DITUTUP sengaja TIDAK bisa dipaksakan petugas lewat sini: konfirmasi
    // "masalah saya memang beres" adalah hak pelapor (POST
    // /api/public/pengaduan/:nomorTiket/konfirmasi) atau sistem (auto-close).
    // Membiarkan petugas menutup sendiri akan membuat angka kepuasan karangan.
    if (status === "DITUTUP") {
      throw new BadRequestError(
        "Tiket ditutup oleh pelapor lewat halaman pelacakan, bukan oleh petugas. Tandai SELESAI — pelapor yang mengonfirmasi.",
      )
    }
    if (status === "DIBUKA_KEMBALI") {
      throw new BadRequestError(
        "DIBUKA_KEMBALI hanya bisa dipicu pelapor dari halaman pelacakan.",
      )
    }

    if (user.role === "STAFF") {
      const tiket = await prisma.pengaduan.findUnique({
        where: { id },
        select: { ditugaskanKeId: true },
      })
      if (!tiket) throw new NotFoundError("Pengaduan")
      const sebagaiOperator = status === "TERVERIFIKASI"
      const sebagaiPetugas =
        tiket.ditugaskanKeId === user.id && TRANSISI_PETUGAS.includes(status)
      if (!sebagaiOperator && !sebagaiPetugas) {
        throw new ForbiddenError(
          "Sebagai STAFF Anda hanya bisa memverifikasi tiket baru, atau mengubah status tiket yang ditugaskan kepada Anda.",
        )
      }
    }

    // "Selesai" harus BISA DIBUKTIKAN: tanpa foto hasil pekerjaan + catatan,
    // klaim selesai tidak berarti apa-apa bagi pelapor yang tinggal jauh dari
    // kantor. Ditegakkan untuk SEMUA role — supervisor bukan pengecualian.
    if (status === "SELESAI") {
      if (!catatanPenyelesaian?.trim()) {
        throw new BadRequestError(
          "Transisi SELESAI wajib menyertakan catatanPenyelesaian.",
        )
      }
      if (!fotoPenyelesaianUrl) {
        throw new BadRequestError(
          "Transisi SELESAI wajib menyertakan foto bukti hasil pekerjaan (unggah lewat POST /pengaduan/foto, lalu kirim fotoPenyelesaianUrl).",
        )
      }
    }

    // Batas konfirmasi pelapor (auto-close) dihitung SEKALI di sini dari
    // konfigurasi saat transisi terjadi — bukan dihitung ulang saat dibaca.
    const konfirmasiBatasAt =
      status === "SELESAI"
        ? hitungKonfirmasiBatasAt(new Date(), await ambilBatasKonfirmasiJam())
        : undefined

    const row = await prisma.$transaction((tx) =>
      transisiPengaduan(tx, {
        pengaduanId: id,
        ke: status,
        aksi: status === "TERVERIFIKASI" ? "DIVERIFIKASI" : undefined,
        oleh: pelakuDariSession(c),
        catatan,
        catatanPenyelesaian,
        isPublik,
        // Foto bukti juga masuk entri linimasa publik — pelapor melihat
        // buktinya langsung di halaman pelacakan.
        fotoUrl: status === "SELESAI" ? fotoPenyelesaianUrl : undefined,
        fotoPenyelesaianUrl,
        fotoPenyelesaianPublicId,
        konfirmasiBatasAt,
      }),
    )
    return ok(c, row)
  },
)

const catatanSchema = z.object({
  catatan: z.string().trim().min(1).max(2000),
  /// Default FALSE — kebalikan dari /status. Catatan bebas paling sering
  /// dipakai koordinasi antar petugas; yang boleh dibaca warga harus
  /// dinyatakan sadar, bukan kebobolan karena lupa.
  isPublik: z.boolean().default(false),
  fotoUrl: z.url().nullable().optional(),
})

/// Tindak lanjut tanpa mengubah status — "sudah survei, menunggu material",
/// "regu berangkat". Dibuka untuk STAFF: petugas lapangan yang tahu
/// perkembangannya.
pengaduanRouter.post(
  "/:id/catatan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", catatanSchema),
  async (c) => {
    const id = c.req.param("id")
    const { catatan, isPublik, fotoUrl } = c.req.valid("json")

    const ada = await prisma.pengaduan.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!ada) throw new NotFoundError("Pengaduan")

    const row = await prisma.$transaction((tx) =>
      catatRiwayat(tx, {
        pengaduanId: id,
        aksi: "CATATAN",
        oleh: pelakuDariSession(c),
        catatan,
        isPublik,
        fotoUrl,
      }),
    )
    return created(c, row)
  },
)

const chatSchema = z.object({
  pesan: z.string().trim().min(1, "Pesan tidak boleh kosong").max(2000),
  fotoUrl: urlFotoSchema.nullable().optional(),
})

/// Pesan CHAT dua arah pada thread tiket — sisi PETUGAS/operator/supervisor.
/// Sisi pelapor ada di POST /api/public/pengaduan/:nomorTiket/chat. Beda
/// dari /catatan: chat SELALU publik (memang untuk dibaca pelapor) dan
/// tercatat sebagai aksi CHAT supaya UI bisa merendernya sebagai
/// percakapan, bukan log status.
pengaduanRouter.post(
  "/:id/chat",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", chatSchema),
  async (c) => {
    const id = c.req.param("id")
    const { pesan, fotoUrl } = c.req.valid("json")

    const tiket = await prisma.pengaduan.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!tiket) throw new NotFoundError("Pengaduan")
    if (tiket.status === "DITUTUP") {
      throw new BadRequestError(
        "Tiket sudah ditutup — percakapan tidak bisa dilanjutkan.",
      )
    }

    const row = await prisma.$transaction((tx) =>
      catatRiwayat(tx, {
        pengaduanId: id,
        aksi: "CHAT",
        oleh: pelakuDariSession(c),
        catatan: pesan,
        fotoUrl,
        isPublik: true,
      }),
    )
    return created(c, row)
  },
)

/// Upload foto bukti penyelesaian (multipart, field `foto`) — dipanggil app
/// petugas SEBELUM PATCH /:id/status SELESAI, lalu URL-nya dikirim sebagai
/// `fotoPenyelesaianUrl`. Pola sama dengan POST /laporan-harian/foto:
/// validasi magic bytes + penamaan deterministik di simpanBerkas().
pengaduanRouter.post(
  "/foto",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const form = await c.req.formData()
    const parsed = z
      .object({ nomorTiket: z.string().trim().min(5).max(40) })
      .parse({ nomorTiket: form.get("nomorTiket") })
    const nomorTiket = normalisasiNomorTiket(parsed.nomorTiket)

    const foto = form.get("foto")
    if (!(foto instanceof File))
      throw new BadRequestError("Foto wajib dilampirkan sebagai field `foto`.")

    try {
      const hasil = await simpanBerkas(foto, {
        prefix: "pengaduan",
        namaBerkas: `${nomorTiket}_penyelesaian`,
        subFolder: nomorTiket.slice(3, 7),
      })
      return created(c, { url: hasil.url, publicId: hasil.publicId })
    } catch (err) {
      if (err instanceof BerkasTidakValidError)
        throw new BadRequestError(err.message)
      throw err
    }
  },
)

/// Sweep auto-close: tutup semua tiket SELESAI yang batas konfirmasinya
/// lewat. Idempoten & aman dipanggil kapan pun — untuk penjadwal eksternal
/// (cron) ATAU tombol manual supervisor. Jalur malasnya (per-tiket saat
/// dibaca publik) ada di publik.router.ts; keduanya memakai otomatis.ts.
pengaduanRouter.post(
  "/tutup-otomatis",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  async (c) => {
    const jumlahDitutup = await sapuTutupOtomatis()
    return ok(c, { jumlahDitutup })
  },
)

const eskalasiSchema = z.object({
  eskalasiKeId: z.string().min(1),
  alasan: z.string().trim().min(1).max(1000),
  prioritasBaru: z.enum(PrioritasPengaduan).optional(),
})

/// Menaikkan tiket ke atasan — mis. kebocoran yang butuh alat berat atau
/// keputusan anggaran.
///
/// TIDAK mengubah status: eskalasi adalah soal SIAPA yang memegang, bukan
/// sudah sampai mana pekerjaannya. Tiket yang dieskalasi tetap DIPROSES.
///
/// Menaikkan prioritas SENGAJA memperketat tenggat penyelesaian dihitung
/// dari sekarang: tiket yang baru disadari gawat tidak boleh tetap memakai
/// tenggat santai yang diberikan saat ia disangka biasa saja.
pengaduanRouter.patch(
  "/:id/eskalasi",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", eskalasiSchema),
  async (c) => {
    const id = c.req.param("id")
    const { eskalasiKeId, alasan, prioritasBaru } = c.req.valid("json")
    const pelaku = pelakuDariSession(c)

    const [pengaduan, atasan] = await Promise.all([
      prisma.pengaduan.findUnique({
        where: { id },
        select: { id: true, status: true },
      }),
      prisma.user.findUnique({
        where: { id: eskalasiKeId },
        select: { name: true, status: true },
      }),
    ])
    if (!pengaduan) throw new NotFoundError("Pengaduan")
    if (!atasan) throw new NotFoundError("Penerima eskalasi")
    if (atasan.status !== "ACTIVE")
      throw new BadRequestError("Penerima eskalasi tidak berstatus aktif.")

    const sekarang = new Date()
    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.pengaduan.update({
        where: { id },
        data: {
          eskalasiKeId,
          eskalasiAt: sekarang,
          alasanEskalasi: alasan,
          ...(prioritasBaru
            ? {
                prioritas: prioritasBaru,
                targetSelesaiAt: hitungTargetSla(prioritasBaru, sekarang)
                  .targetSelesaiAt,
              }
            : {}),
        },
      })
      await catatRiwayat(tx, {
        pengaduanId: id,
        aksi: "ESKALASI",
        oleh: pelaku,
        catatan: `Dieskalasi ke ${atasan.name ?? "atasan"}: ${alasan}`,
        // Internal: alasan eskalasi kerap menyangkut kendala anggaran/personel
        // yang bukan urusan pelapor. Kabar untuk warga disampaikan lewat
        // catatan publik tersendiri.
        isPublik: false,
      })
      return row
    })
    // Beri tahu penerima eskalasi (best-effort).
    await getNotifier().kirim([eskalasiKeId], {
      judul: "Tiket dieskalasikan kepada Anda",
      isi: `Tiket ${row.nomorTiket ?? id} dieskalasi: ${alasan}`,
      tipe: "pengaduan",
      data: { tipe: "pengaduan", id },
    })
    return ok(c, row)
  },
)
