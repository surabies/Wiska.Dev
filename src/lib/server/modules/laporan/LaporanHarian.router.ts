// server/modules/laporan/laporan-harian.router.ts — laporan harian petugas
// (pra-verifikasi), dengan alur verifikasi BERJENJANG V1→V2→V3
// (Supervisor → Manager → Senior Manager). Laporan BERMUARA ke
// PembacaanMeter resmi hanya di V3: satu transaksi membuat baris
// PembacaanMeter dari data laporan (memakai koreksi V1 bila ada) lalu
// menautkannya balik (`pembacaanId`) — itulah yang membuat laporan
// lapangan naik jadi angka resmi penagihan.
//
// Pola relasi + snapshot (pelangganId opsional + namaPelanggan/alamat teks)
// mengikuti keputusan schema: baris orphan (pelanggan belum ter-import)
// tetap punya identitas yang terbaca di UI, lihat prisma/docs/README.md.
import { Hono } from "hono"
import { z } from "zod"
import { JenisInputLaporanHarian, KondisiCatat, KategoriPembacaan } from "@db"
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
  isPrismaKnownError,
} from "../../lib/Galat"
import {
  paginationQuerySchema,
  buildSkipTake,
  buildMeta,
  buildOrderBy,
  sortQuery,
} from "../../lib/Pagination"
import { periodeToDate, dateToPeriode } from "../../lib/Periode"
import { rentangTanggalWIB } from "../../lib/RentangTanggal"
import { simpanBerkas, BerkasTidakValidError } from "../../lib/Penyimpanan"
import { hitungPemakaianGantiMeter } from "@/lib/domain/PerhitunganMeter"
import { tentukanBlok } from "@/lib/domain/Tagihan"
import { pilihPemakaianLalu } from "@/lib/domain/PemakaianLalu"
import { recordAudit, auditMetaFromRequest } from "../../lib/Audit"
import JSZip from "jszip"
import { verifikasiMassal } from "./VerifMassal"
import {
  ambilPemakaianPeriodeSebelumnya,
  ambilPembacaanResmi,
  denganSumberResmi,
  simpanPembacaanResmi,
} from "./PembacaanResmi"
import { pastikanV3UntukTagihan } from "./KewenanganTagihan"

export const laporanHarianRouter = new Hono()

/// Status verifikasi TURUNAN (tidak ada kolomnya sendiri): MENUNGGU =
/// belum pernah disentuh verifikator (verifiedAt null); DIVERIFIKASI =
/// isVerified true; DITOLAK = isVerified false TAPI verifiedAt terisi
/// (reject mengisi verifiedAt tanpa menaikkan isVerified). Filter
/// isVerified saja tidak bisa membedakan MENUNGGU dari DITOLAK.
const STATUS_VERIF = ["MENUNGGU", "DIVERIFIKASI", "DITOLAK"] as const
type StatusVerif = (typeof STATUS_VERIF)[number]

const WHERE_STATUS_VERIF: Record<StatusVerif, Record<string, unknown>> = {
  MENUNGGU: { verifiedAt: null },
  DIVERIFIKASI: { isVerified: true },
  DITOLAK: { isVerified: false, verifiedAt: { not: null } },
}

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "tanggalCatat",
    "periode",
    "standAwal",
    "standAkhir",
    "pemakaian",
    "kondisi",
    "nomorLangganan",
    "namaPelanggan",
    "isVerified",
    "persentase",
    "createdAt",
  ]),
  q: z.string().trim().min(1).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  isVerified: z.coerce.boolean().optional(),
  statusVerif: z.enum(STATUS_VERIF).optional(),
  jenisInput: z.enum(JenisInputLaporanHarian).optional(),
  pencatatId: z.string().optional(),
  pelangganId: z.string().optional(),
  /// Rute baca meter pelanggannya. Verifikasi dikerjakan PER RUTE — satu
  /// penyelia memegang beberapa rute dan memeriksa setoran rute demi rute,
  /// bukan 22 ribu baris bercampur. Menyaring lewat pencatat tidak menjawab
  /// itu: seorang pencatat bisa memegang beberapa rute, dan satu rute bisa
  /// berpindah tangan di tengah bulan.
  ruteId: z.string().optional(),
  wilayahDistId: z.string().optional(),
  zonaId: z.string().optional(),
  ruteLanjutanId: z.string().optional(),
  pencatatLanjutanId: z.string().optional(),
  kondisiLanjutan: z.enum(KondisiCatat).optional(),
  tarifGolonganId: z.string().optional(),
  kecamatanId: z.string().optional(),
  kelurahanId: z.string().optional(),
  alamat: z.string().trim().min(1).optional(),
  noPel: z.string().trim().min(1).optional(),
  nama: z.string().trim().min(1).optional(),
  standKoreksi: z.enum(["ya", "tidak"]).optional(),
  statusSpt: z.enum(["ya", "tidak"]).optional(),
  statusBaca: z.enum(["ya", "tidak"]).optional(),
  tanggalBacaDari: z.string().trim().optional(),
  tanggalBacaSampai: z.string().trim().optional(),
  kategori: z.enum(["ONSITE", "OFFSITE"]).optional(),
  pemakaianRangeDari: z.coerce.number().int().optional(),
  pemakaianRangeSampai: z.coerce.number().int().optional(),
  pemakaianOperator: z.enum(["=", ">", ">=", "<", "<="]).optional(),
  pemakaian: z.coerce.number().int().optional(),
  persentaseOperator: z.enum(["=", ">", ">=", "<", "<="]).optional(),
  persentase: z.coerce.number().int().optional(),
  verifWil: z.enum(["ya", "tidak"]).optional(),
  verifKasie: z.enum(["ya", "tidak"]).optional(),
  verifPusat: z.enum(["ya", "tidak"]).optional(),
  /// Kondisi catat lapangan (NORMAL, RUMAH_KOSONG, METER_RUSAK, …). Kolomnya
  /// sudah tampil di tabel /dashboard/laporan-harian sejak lama, tapi tanpa
  /// penyaring ini pertanyaan pengawasan yang wajar — "berapa meter rusak
  /// yang disetor bulan ini" — hanya bisa dijawab dengan menggulir 22 ribu
  /// baris. Sama persis dengan penyaring `kondisi` di /pembacaan.
  kondisi: z.enum(KondisiCatat).optional(),
  /// Rentang TANGGAL CATAT (bukan periode). Dipakai layar verifikasi untuk
  /// memantau setoran harian: "apa yang masuk hari ini", "pekan ini".
  /// Keduanya inklusif; boleh dipakai sendiri-sendiri.
  tanggalDari: z.string().trim().optional(),
  tanggalSampai: z.string().trim().optional(),
  /// true = hanya baris anomali (di luar ±ambang). Ambangnya dibaca dari
  /// Konfigurasi, sama dengan yang dipakai kartu ringkasan.
  hanyaAnomali: z.coerce.boolean().optional(),
  /// true = hanya baris yang membawa usulan perubahan data dari lapangan
  /// (bill_perubahan Aurora). Tanpa penyaring ini usulan petugas terkubur di
  /// antara 22.500 baris biasa dan praktis tidak pernah terbaca siapa pun —
  /// yang selama ini memang terjadi: kolomnya terisi, tidak ada yang membuka.
  adaUsulan: z.coerce.boolean().optional(),
  /// true = kirim HANYA kolom yang dipakai tabel. Baris penuh berisi 50
  /// field + 7 relasi (~1,9 KB); yang ditampilkan cuma 18. Pada 2.000 baris
  /// selisihnya 3,7 MB vs ~0,9 MB — dan itu terasa sebagai "halaman berat"
  /// jauh sebelum servernya sendiri melambat. Panel detail tetap mengambil
  /// baris penuh lewat GET /:id saat sebuah baris dipilih.
  ringkas: z.coerce.boolean().optional(),
})

/// Kolom yang benar-benar dibaca tabel verifikasi. Ditulis eksplisit, bukan
/// diturunkan dari komponen, supaya menambah kolom di UI memaksa orang
/// membuka berkas ini — daripada diam-diam mengandalkan `include` gemuk.
const PILIH_RINGKAS = {
  id: true,
  pelangganId: true,
  nomorLangganan: true,
  namaPelanggan: true,
  alamatPelanggan: true,
  periode: true,
  standAwal: true,
  standAkhir: true,
  standAkhirRevisi: true,
  standAwalRevisi: true,
  kondisiRevisi: true,
  standAngkatLama: true,
  standMeterBaru: true,
  meterVerifId: true,
  blokTarifVerif: true,
  pemakaianTagihVerif: true,
  pemakaian: true,
  pemakaianLalu: true,
  persentase: true,
  kondisi: true,
  jenisInput: true,
  alasanManual: true,
  tanggalCatat: true,
  /// Usulan dari lapangan ikut di baris ringkas: layar tinjauan menyaring
  /// dengan `adaUsulan` lalu menampilkannya langsung di tabel, tanpa perlu
  /// membuka baris satu per satu.
  usulanPerubahan: true,
  usulanNoUrut: true,
  isVerified: true,
  verifiedAt: true,
  pembacaanId: true,
  verif1At: true,
  verif2At: true,
  verif3At: true,
  pencatat: { select: { id: true, namaLapangan: true } },
  pelanggan: {
    select: {
      id: true,
      nomorLangganan: true,
      nama: true,
      alamat: true,
      rute: { select: { kode: true } },
    },
  },
} as const

laporanHarianRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)
    // Batas hari WIB, bukan UTC — aturannya (beserta alasannya) pindah ke
    // lib/rentang-tanggal.ts karena kiriman warga di /laporan-mandiri kini
    // memakai saringan tanggal yang sama persis.
    const tglCatat = rentangTanggalWIB(query.tanggalDari, query.tanggalSampai)
    let ambang = 50
    if (query.hanyaAnomali) {
      const konf = await prisma.konfigurasi.findUnique({
        where: { kunci: "AMBANG_ANOMALI_PERSEN" },
      })
      ambang = Number.parseInt(konf?.nilai ?? "", 10) || 50
    }
    // Dua syarat sama-sama butuh OR (anomali & pencarian). Ditulis sebagai
    // dua entri AND, BUKAN dua kunci `OR` di objek yang sama — kunci kedua
    // akan menimpa yang pertama secara diam-diam, dan hasilnya: mencari nama
    // sambil menyaring anomali akan mengembalikan baris yang tidak anomali.
    const and: Record<string, unknown>[] = []
    if (query.hanyaAnomali) {
      and.push({
        OR: [{ persentase: { gt: ambang } }, { persentase: { lt: -ambang } }],
      })
    }
    if (query.adaUsulan) {
      // Teks kosong dihitung "tidak ada usulan": aplikasi versi lama pernah
      // mengirim string kosong alih-alih null, dan menampilkannya sebagai
      // usulan akan mengisi layar tinjauan dengan baris hampa.
      and.push(
        { usulanPerubahan: { not: null } },
        { NOT: { usulanPerubahan: "" } }
      )
    }
    if (query.q) {
      and.push({
        OR: [
          { nomorLangganan: { contains: query.q } },
          {
            namaPelanggan: { contains: query.q, mode: "insensitive" as const },
          },
        ],
      })
    }
    if (query.alamat) {
      and.push({
        OR: [
          {
            alamatPelanggan: {
              contains: query.alamat,
              mode: "insensitive" as const,
            },
          },
          {
            pelanggan: {
              is: {
                alamat: {
                  contains: query.alamat,
                  mode: "insensitive" as const,
                },
              },
            },
          },
        ],
      })
    }
    if (query.noPel) {
      and.push({
        OR: [
          { nomorLangganan: { contains: query.noPel } },
          { pelanggan: { is: { nomorLangganan: { contains: query.noPel } } } },
        ],
      })
    }
    if (query.nama) {
      and.push({
        OR: [
          {
            namaPelanggan: {
              contains: query.nama,
              mode: "insensitive" as const,
            },
          },
          {
            pelanggan: {
              is: {
                nama: { contains: query.nama, mode: "insensitive" as const },
              },
            },
          },
        ],
      })
    }
    if (query.wilayahDistId) {
      and.push({
        pelanggan: {
          is: { seksiCater: { is: { wilayahDistId: query.wilayahDistId } } },
        },
      })
    }
    if (query.zonaId) and.push({ pelanggan: { is: { zonaId: query.zonaId } } })
    if (query.ruteLanjutanId) {
      and.push({ pelanggan: { is: { ruteId: query.ruteLanjutanId } } })
    }
    if (query.pencatatLanjutanId) {
      and.push({ pencatatId: query.pencatatLanjutanId })
    }
    if (query.kondisiLanjutan) and.push({ kondisi: query.kondisiLanjutan })
    if (query.tarifGolonganId) {
      and.push({
        pelanggan: { is: { tarifGolonganId: query.tarifGolonganId } },
      })
    }
    if (query.kecamatanId) {
      and.push({ pelanggan: { is: { kecamatanId: query.kecamatanId } } })
    }
    if (query.kelurahanId) {
      and.push({ pelanggan: { is: { kelurahanId: query.kelurahanId } } })
    }
    if (query.standKoreksi) {
      const adaRevisi = {
        OR: [
          { standAwalRevisi: { not: null } },
          { standAkhirRevisi: { not: null } },
        ],
      }
      and.push(
        query.standKoreksi === "ya"
          ? adaRevisi
          : {
              standAwalRevisi: null,
              standAkhirRevisi: null,
            }
      )
    }
    if (query.statusSpt) {
      and.push(
        query.statusSpt === "ya"
          ? { pelanggan: { is: { status: "TUTUP_SPT" } } }
          : {
              OR: [
                { pelanggan: { is: { status: { not: "TUTUP_SPT" } } } },
                { pelanggan: null },
              ],
            }
      )
    }
    if (query.statusBaca) {
      and.push({ isVerified: query.statusBaca === "ya" })
    }
    const tanggalBaca = rentangTanggalWIB(
      query.tanggalBacaDari,
      query.tanggalBacaSampai
    )
    if (tanggalBaca) and.push({ tanggalCatat: tanggalBaca })
    if (query.kategori) and.push({ kategori: query.kategori })
    if (
      query.pemakaianRangeDari !== undefined ||
      query.pemakaianRangeSampai !== undefined
    ) {
      const pemakaian: Record<string, number> = {}
      if (query.pemakaianRangeDari !== undefined)
        pemakaian.gte = query.pemakaianRangeDari
      if (query.pemakaianRangeSampai !== undefined)
        pemakaian.lte = query.pemakaianRangeSampai
      and.push({ pemakaian })
    }
    const operatorPrisma = {
      "=": "equals",
      ">": "gt",
      ">=": "gte",
      "<": "lt",
      "<=": "lte",
    } as const
    if (query.pemakaian !== undefined) {
      and.push({
        pemakaian: {
          [operatorPrisma[query.pemakaianOperator ?? "="]]: query.pemakaian,
        },
      })
    }
    if (query.persentase !== undefined) {
      and.push({
        persentase: {
          [operatorPrisma[query.persentaseOperator ?? "="]]: query.persentase,
        },
      })
    }
    for (const [parameter, kolom] of [
      ["verifWil", "verif1At"],
      ["verifKasie", "verif2At"],
      ["verifPusat", "verif3At"],
    ] as const) {
      const nilai = query[parameter]
      if (nilai) {
        and.push({
          [kolom]: nilai === "ya" ? { not: null } : null,
        })
      }
    }
    const where = {
      ...(tglCatat ? { tanggalCatat: tglCatat } : {}),
      periode: query.periode,
      isVerified: query.isVerified,
      pencatatId: query.pencatatId,
      pelangganId: query.pelangganId,
      kondisi: query.kondisi,
      jenisInput: query.jenisInput,
      // Lewat relasi pelanggan — rute bukan kolom laporan. Baris yang
      // pelanggannya belum ter-resolve (pelangganId null) memang ikut
      // tersaring keluar: baris tanpa pelanggan tidak punya rute.
      ...(query.ruteId ? { pelanggan: { is: { ruteId: query.ruteId } } } : {}),
      ...(query.statusVerif ? WHERE_STATUS_VERIF[query.statusVerif] : {}),
      ...(and.length > 0 ? { AND: and } : {}),
    }
    const [data, total] = await Promise.all([
      prisma.laporanHarianPetugas.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query, { tanggalCatat: "desc" }),
        ...(query.ringkas ? { select: PILIH_RINGKAS } : {}),
        ...(query.ringkas
          ? {}
          : {
              include: {
                // Tabel verifikasi (tabel.md) butuh kolom turunan pelanggan (tarif,
                // rute, W = wilayah seksi, zona), stand resmi dari pembacaan, dan
                // nama verifikator tiap ring — semuanya select sempit, bukan row utuh.
                pelanggan: {
                  select: {
                    id: true,
                    nomorLangganan: true,
                    nama: true,
                    alamat: true,
                    tarifGolongan: { select: { kodeAsli: true } },
                    rute: { select: { kode: true } },
                    zona: {
                      select: {
                        kode: true,
                        wilayahSeksi: { select: { kode: true } },
                      },
                    },
                  },
                },
                pencatat: { select: { id: true, namaLapangan: true } },
                pembacaan: { select: { id: true, standAkhir: true } },
                verifiedBy: { select: { id: true, name: true } },
                verif1By: { select: { id: true, name: true } },
                verif2By: { select: { id: true, name: true } },
                verif3By: { select: { id: true, name: true } },
              },
            }),
      }),
      prisma.laporanHarianPetugas.count({ where }),
    ])
    const pembacaanResmi = await ambilPembacaanResmi(
      data.map((row) => ({
        pelangganId: row.pelangganId,
        periode: row.periode,
      }))
    )
    const pemakaianPeriodeSebelumnya = await ambilPemakaianPeriodeSebelumnya(
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
    const dataDenganPembacaan = data.map((row) => ({
      ...row,
      pemakaianLalu: pilihPemakaianLalu(
        row.pemakaianLalu,
        pemakaianPeriodeSebelumnya.get(`${row.periode}:${row.pelangganId}`)
      ),
      pembacaan:
        petaPembacaan.get(`${row.pelangganId}:${row.periode}`) ??
        ("pembacaan" in row ? row.pembacaan : null),
    }))
    return paginated(c, dataDenganPembacaan, buildMeta(total, query))
  }
)

/// Ringkasan untuk halaman verifikasi: hitungan per status + daftar periode
/// yang benar-benar punya data (untuk dropdown filter). Terdaftar SEBELUM
/// /:id supaya "stats" tidak tertelan param id.
const statsQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

laporanHarianRouter.get(
  "/stats",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", statsQuerySchema),
  async (c) => {
    const { periode } = c.req.valid("query")
    const where = periode ? { periode } : {}
    // Ambang anomali dikonfigurasi lewat Konfigurasi (lihat komentar kolom
    // `persentase` di operasional.prisma); 50% bila belum diset.
    const konf = await prisma.konfigurasi.findUnique({
      where: { kunci: "AMBANG_ANOMALI_PERSEN" },
    })
    const ambangAnomali = Number.parseInt(konf?.nilai ?? "", 10) || 50
    const [total, menunggu, diverifikasi, ditolak, anomali, periodes] =
      await Promise.all([
        prisma.laporanHarianPetugas.count({ where }),
        prisma.laporanHarianPetugas.count({
          where: { ...where, ...WHERE_STATUS_VERIF.MENUNGGU },
        }),
        prisma.laporanHarianPetugas.count({
          where: { ...where, ...WHERE_STATUS_VERIF.DIVERIFIKASI },
        }),
        prisma.laporanHarianPetugas.count({
          where: { ...where, ...WHERE_STATUS_VERIF.DITOLAK },
        }),
        prisma.laporanHarianPetugas.count({
          where: {
            ...where,
            OR: [
              { persentase: { gt: ambangAnomali } },
              { persentase: { lt: -ambangAnomali } },
            ],
          },
        }),
        prisma.laporanHarianPetugas.groupBy({
          by: ["periode"],
          orderBy: { periode: "desc" },
          take: 24,
        }),
      ])
    return ok(c, {
      total,
      menunggu,
      diverifikasi,
      ditolak,
      anomali,
      ambangAnomali,
      periodes: periodes.map((p) => p.periode),
    })
  }
)

// ── PROGRES HARIAN PER PENCATAT ──────────────────────────────────────────
//
// Menjawab pertanyaan penyelia yang tidak bisa dijawab tabel laporan maupun
// /stats: "hari ini siapa yang sudah menyetor, siapa yang diam, dan siapa
// yang belum mulai sama sekali". Tabel laporan menampilkan setoran yang
// MASUK; yang dicari di sini justru yang TIDAK masuk, per orang per hari.
//
// DUA SUMBER, DAN KEDUANYA WAJIB:
//   • DaftarCatat  = pembaginya. Satu baris per pelanggan per periode dengan
//     pencatat yang di-snapshot saat daftar dibekukan (lihat komentarnya di
//     operasional.prisma) — inilah "berapa yang HARUS dicatat orang ini".
//     Tanpa itu, 40 setoran sehari tidak bisa dibedakan antara hampir
//     selesai dan baru seperempat jalan.
//   • LaporanHarianPetugas = pembilangnya, dikelompokkan per TANGGAL.
//
// TANGGALNYA HARI WIB, bukan hari UTC. Setoran pukul 06.00 WIB masih
// tanggal kemarin menurut UTC, dan petugas yang berangkat subuh akan
// tercatat menyetor di hari yang salah — persis kekeliruan yang sudah
// diperbaiki pada saringan rentang tanggal di berkas ini.
const progresQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912),
})

/// Ambang "diam": setoran terakhir lebih lama dari ini (dalam hari, relatif
/// tanggal acuan) sementara pekerjaannya belum selesai. Tiga hari dipilih
/// supaya akhir pekan tidak langsung membunyikan alarm; angkanya ikut
/// dikirim ke layar supaya yang membaca tahu ambang apa yang dipakainya,
/// bukan menebak-nebak arti lencana merah.
const AMBANG_DIAM_HARI = 3

/// JENIS HARI — dasar pewarnaan kolom tanggal di layar progres.
///
///   kerja       Senin–Jumat biasa.
///   akhirpekan  Sabtu/Minggu.
///   libur       Tanggal merah nasional (lihat KUNCI_LIBUR di bawah).
///   lembur      Hari libur/akhir pekan yang TERNYATA ADA SETORANNYA.
///
/// "lembur" DITURUNKAN, bukan dicatat: sistem ini tidak punya tabel lembur,
/// dan yang bisa dibuktikan datanya hanyalah "ada orang bekerja di hari
/// yang seharusnya libur". Kalau kelak lembur mulai diajukan & disetujui
/// lewat aplikasi, sumbernya tinggal diganti di sini — layar tidak perlu
/// tahu bedanya.
export type JenisHari = "kerja" | "akhirpekan" | "libur" | "lembur"

/// Tanggal merah nasional disimpan sebagai Konfigurasi, BUKAN tabel baru dan
/// bukan daftar tertanam di kode. Alasannya: daftarnya berubah tiap tahun,
/// ditetapkan SKB menteri, dan yang tahu tanggalnya bagian kepegawaian —
/// bukan orang yang bisa mengubah kode. Menanamkannya di kode juga berarti
/// tanggal yang salah menyamarkan hari kerja yang benar-benar bolong.
///
/// Format nilainya: tanggal ISO dipisah koma/spasi/baris baru, mis.
/// "2026-08-17, 2026-12-25". Kosong (atau kuncinya belum ada) = tidak ada
/// tanggal merah — layar tetap benar, hanya tanpa kolom oranye. Pola
/// "baca-kalau-ada, kalau tidak pakai bawaan" sama dengan
/// AMBANG_ANOMALI_PERSEN di berkas ini.
///
/// CARA MENGISINYA HARI INI: `PATCH /api/v1/konfigurasi/LIBUR_NASIONAL`
/// (role ADMIN). Halaman Administrasi → Konfigurasi masih HANYA-BACA — ia
/// menampilkan daftar kunci tanpa penyunting, jadi kunci ini belum bisa
/// diubah dari layar. Kalau kelak halaman itu diberi dialog sunting, kunci
/// ini ikut terlayani tanpa perubahan di sini.
const KUNCI_LIBUR = "LIBUR_NASIONAL"

/// Hari WIB "hari ini". Dipakai membatasi kolom tanggal periode berjalan:
/// tanpa batas ini, sisa bulan yang BELUM TERJADI ikut tergambar sebagai
/// hari kerja tanpa setoran — dan seluruh petugas terlihat menunggak untuk
/// hari yang belum datang.
function hariIniWib(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/// Seluruh tanggal periode (thbl) sampai batas, sebagai "YYYY-MM-DD".
function tanggalPeriode(periode: number, sampai: string): string[] {
  const tahun = Math.floor(periode / 100)
  const bulan = periode % 100
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini.
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const hasil: string[] = []
  for (let h = 1; h <= hariTerakhir; h++) {
    const t = `${tahun}-${String(bulan).padStart(2, "0")}-${String(h).padStart(2, "0")}`
    if (t > sampai) break
    hasil.push(t)
  }
  return hasil
}

laporanHarianRouter.get(
  "/progres-pencatat",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", progresQuerySchema),
  async (c) => {
    const { periode } = c.req.valid("query")

    const [
      perTanggal,
      targetPerPencatat,
      setorPerPencatat,
      pencatats,
      konfLibur,
    ] = await Promise.all([
      // Setoran per pencatat per TANGGAL WIB. Lewat raw SQL karena groupBy
      // Prisma tidak bisa mengelompokkan pada hasil konversi zona waktu.
      prisma.$queryRaw<
        Array<{ pencatatId: string | null; tanggal: string; jumlah: bigint }>
      >`
        SELECT "pencatatId",
               to_char(("tanggalCatat" AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD') AS tanggal,
               COUNT(*) AS jumlah
          FROM laporan_harian_petugas
         WHERE periode = ${periode} AND "tanggalCatat" IS NOT NULL
         GROUP BY 1, 2
         ORDER BY 2 ASC`,
      prisma.daftarCatat.groupBy({
        by: ["pencatatId"],
        where: { periode },
        _count: { _all: true },
      }),
      prisma.laporanHarianPetugas.groupBy({
        by: ["pencatatId"],
        where: { periode },
        _count: { _all: true },
      }),
      prisma.pencatat.findMany({
        where: { isAktif: true },
        select: { id: true, namaLapangan: true },
        orderBy: { namaLapangan: "asc" },
      }),
      prisma.konfigurasi.findUnique({ where: { kunci: KUNCI_LIBUR } }),
    ])

    const target = new Map(
      targetPerPencatat.map((t) => [t.pencatatId ?? "", t._count._all])
    )
    const setor = new Map(
      setorPerPencatat.map((t) => [t.pencatatId ?? "", t._count._all])
    )

    const harian = new Map<string, Map<string, number>>()
    const adaSetoran = new Set<string>()
    for (const b of perTanggal) {
      adaSetoran.add(b.tanggal)
      const kunci = b.pencatatId ?? ""
      let baris = harian.get(kunci)
      if (!baris) {
        baris = new Map()
        harian.set(kunci, baris)
      }
      baris.set(b.tanggal, Number(b.jumlah))
    }

    // SELURUH TANGGAL PERIODE, bukan hanya yang ada setorannya. Versi
    // pertama memakai tanggal-yang-punya-data, dan pada bulan yang setorannya
    // baru masuk sekali, grafik & tabelnya berisi SATU kolom — terbaca
    // seperti layar rusak, padahal justru itu kabarnya: 30 hari lain kosong.
    // Hari yang belum terjadi tetap dipotong (lihat hariIniWib).
    const batas = [hariIniWib(), ...adaSetoran].sort().at(-1)!
    const tanggal = tanggalPeriode(periode, batas)

    const liburNasional = new Set(
      (konfLibur?.nilai ?? "")
        .split(/[\s,;]+/)
        .map((t) => t.trim())
        .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t))
    )

    const jenisHari = (t: string): JenisHari => {
      // getUTCDay pada tengah malam UTC dari tanggal WIB yang sama:
      // penamaan harinya identik karena keduanya menyebut tanggal kalender
      // yang sama, bukan satu momen waktu.
      const hari = new Date(`${t}T00:00:00Z`).getUTCDay()
      const dasar: JenisHari = liburNasional.has(t)
        ? "libur"
        : hari === 0 || hari === 6
          ? "akhirpekan"
          : "kerja"
      // Ada yang bekerja di hari libur → hari itu jadi hari lembur.
      return dasar !== "kerja" && adaSetoran.has(t) ? "lembur" : dasar
    }

    // Tanggal acuan = hari WIB terakhir yang PUNYA setoran, bukan hari
    // kalender. Periode yang sudah lewat tetap bisa ditinjau tanpa seluruh
    // petugasnya dicap "diam" hanya karena bulannya sudah berganti.
    const acuan = [...adaSetoran].sort().at(-1) ?? null
    const selisihHari = (a: string, b: string) =>
      Math.round(
        (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) /
          86_400_000
      )

    // Pencatat yang punya target ATAU punya setoran — termasuk yang sudah
    // non-aktif tapi masih menyetor bulan ini (kalau tidak, setorannya
    // hilang dari total tanpa penjelasan).
    const idTerlibat = new Set<string>([
      ...pencatats.map((p) => p.id),
      ...[...target.keys()].filter(Boolean),
      ...[...setor.keys()].filter(Boolean),
    ])
    const namaPencatat = new Map(pencatats.map((p) => [p.id, p.namaLapangan]))
    const namaTambahan = await prisma.pencatat.findMany({
      where: {
        id: { in: [...idTerlibat].filter((id) => !namaPencatat.has(id)) },
      },
      select: { id: true, namaLapangan: true },
    })
    for (const p of namaTambahan) namaPencatat.set(p.id, p.namaLapangan)

    const baris = [...idTerlibat]
      .map((id) => {
        const perHari = harian.get(id) ?? new Map<string, number>()
        const tanggalSetor = [...perHari.keys()].sort()
        const terakhir = tanggalSetor.at(-1) ?? null
        const jumlahTarget = target.get(id) ?? 0
        const jumlahSetor = setor.get(id) ?? 0
        const hariDiam = terakhir && acuan ? selisihHari(terakhir, acuan) : null

        /// Status DITURUNKAN di server supaya tiga layar tidak menghitungnya
        /// dengan tiga aturan berbeda.
        const status: "selesai" | "jalan" | "diam" | "belum" =
          jumlahTarget > 0 && jumlahSetor >= jumlahTarget
            ? "selesai"
            : jumlahSetor === 0
              ? "belum"
              : (hariDiam ?? 0) >= AMBANG_DIAM_HARI
                ? "diam"
                : "jalan"

        return {
          id,
          nama: namaPencatat.get(id) ?? "(pencatat terhapus)",
          target: jumlahTarget,
          tersetor: jumlahSetor,
          terakhirSetor: terakhir,
          hariDiam,
          status,
          perTanggal: Object.fromEntries(perHari),
        }
      })
      // Yang paling perlu ditindak di atas: belum mulai → diam → jalan →
      // selesai; di dalam tiap kelompok, sisa pekerjaan terbanyak dulu.
      .filter((b) => b.target > 0 || b.tersetor > 0)
      .sort((a, b) => {
        const urut = { belum: 0, diam: 1, jalan: 2, selesai: 3 } as const
        return (
          urut[a.status] - urut[b.status] ||
          b.target - b.tersetor - (a.target - a.tersetor)
        )
      })

    const totalPerTanggal = tanggal.map((t) => ({
      tanggal: t,
      jumlah: baris.reduce((n, b) => n + (b.perTanggal[t] ?? 0), 0),
    }))

    return ok(c, {
      periode,
      tanggalAcuan: acuan,
      ambangDiamHari: AMBANG_DIAM_HARI,
      /// Tanggal + jenis harinya sekaligus: layar mewarnai kolom dari sini,
      /// jadi aturan "Sabtu itu akhir pekan" tidak perlu ditulis dua kali.
      hari: tanggal.map((t) => ({ tanggal: t, jenis: jenisHari(t) })),
      tanggal,
      totalPerTanggal,
      pencatat: baris,
    })
  }
)

// ── BELUM DIBACA — pemantauan beban kerja petugas ────────────────────────
//
// Menjawab pertanyaan yang tidak bisa dijawab tabel laporan: siapa yang
// SEHARUSNYA dicatat bulan ini tapi belum ada setorannya. Sumbernya daftar
// catat (DPM) periode itu, dikurangi nomor yang sudah punya laporan.
//
// Ini kebalikan dari daftar laporan — dan justru inilah yang dipakai
// supervisor untuk menagih pekerjaan ke petugas, bukan menghitung yang
// sudah masuk.
const belumDibacaQuerySchema = paginationQuerySchema.extend({
  periode: z.coerce.number().int().min(190001).max(999912),
  pencatatId: z.string().optional(),
  ruteId: z.string().optional(),
  q: z.string().trim().min(1).optional(),
})

laporanHarianRouter.get(
  "/belum-dibaca",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", belumDibacaQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { skip, take } = buildSkipTake(query)

    // Nomor yang SUDAH punya laporan pada periode ini. Diambil sebagai daftar
    // nomor (bukan join) supaya tetap sederhana dan terbaca; 22 ribu string
    // ringan dibanding kerumitan raw query.
    const sudah = await prisma.laporanHarianPetugas.findMany({
      where: { periode: query.periode },
      select: { pelangganId: true },
    })
    const sudahIds = sudah
      .map((s) => s.pelangganId)
      .filter((v): v is string => v !== null)

    const where = {
      periode: query.periode,
      pelangganId: { notIn: sudahIds.length > 0 ? sudahIds : ["-"] },
      ...(query.pencatatId ? { pencatatId: query.pencatatId } : {}),
      ...(query.ruteId ? { ruteId: query.ruteId } : {}),
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

    const [data, total] = await Promise.all([
      prisma.daftarCatat.findMany({
        where,
        skip,
        take,
        orderBy: [{ urutan: "asc" }],
        include: {
          pelanggan: {
            select: {
              id: true,
              nomorLangganan: true,
              nama: true,
              alamat: true,
              status: true,
              rute: { select: { kode: true } },
            },
          },
          pencatat: { select: { id: true, namaLapangan: true } },
          rute: { select: { id: true, kode: true } },
        },
      }),
      prisma.daftarCatat.count({ where }),
    ])
    return paginated(c, data, buildMeta(total, query))
  }
)

// ── Rute Baca Meter (RBM) petugas — dipakai aplikasi mobile pencatat.
// Terdaftar SEBELUM /:id supaya "rute-saya" tidak tertelan param id.
//
// Alurnya: akun User (token) → Pencatat (jembatan userId) → Rute yang
// ditugaskan (pencatat.ruteId, diatur dari dashboard web lewat
// PATCH /pencatat/:id) → seluruh pelanggan rute itu, dilengkapi stand
// resmi terakhir (prefill stand lalu), pemakaian lalu (dasar peringatan
// deviasi), dan status sudah/belum dicatat pada periode berjalan. Respons
// ini sekaligus "paket unduhan rute" yang di-cache aplikasi untuk kerja
// offline di lapangan.
const ruteSayaQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

laporanHarianRouter.get(
  "/rute-saya",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("query", ruteSayaQuerySchema),
  async (c) => {
    const user = getSessionUser(c)
    // Default periode = bulan kalender berjalan: pencatatan lapangan merekam
    // bulan berjalan (beda dari dashboard yang memakai periode terakhir
    // ber-data — closing bulanan boleh tertinggal, rute tidak).
    const periode = c.req.valid("query").periode ?? dateToPeriode(new Date())

    const pencatat = await prisma.pencatat.findUnique({
      where: { userId: user.id },
      include: {
        // Rute yang dipetakan admin (many-to-many BERURUT lewat PenugasanRute,
        // halaman Pemetaan Rute). Satu pencatat bisa memegang banyak rute;
        // urutannya menentukan urutan kerja di lapangan.
        penugasanRute: {
          orderBy: { urutan: "asc" },
          include: {
            rute: {
              select: {
                id: true,
                kode: true,
                seksiCater: { select: { kode: true, nama: true } },
              },
            },
          },
        },
      },
    })
    if (!pencatat || !pencatat.isAktif) {
      throw new BadRequestError(
        "Akun Anda belum tertaut ke data Pencatat aktif — minta admin menautkannya di menu Pencatat dashboard web."
      )
    }

    // Jumlah laporan yang DIA catat pada periode ini (lintas rute — pindah
    // rute di tengah bulan tidak menghilangkan hasil kerjanya) — angka
    // "hasil kerja saya" di beranda aplikasi.
    const dicatatSaya = await prisma.laporanHarianPetugas.count({
      where: { periode, pencatatId: pencatat.id },
    })

    // Belum ditugaskan rute = bukan error: rute dipetakan admin di halaman
    // Pemetaan Rute dashboard (PenugasanRute). Aplikasi menampilkan keadaan
    // "belum ditugaskan — hubungi admin", bukan layar gagal.
    const penugasan = pencatat.penugasanRute
    if (penugasan.length === 0) {
      return ok(c, {
        pencatat: { id: pencatat.id, namaLapangan: pencatat.namaLapangan },
        rute: null,
        rutes: [],
        periode,
        target: 0,
        terbaca: 0,
        dicatatSaya,
        // Belum punya rute sama sekali — sebabnya penugasan, bukan daftar catat.
        daftarBelumTerbit: false,
        pelanggan: [],
      })
    }

    const ruteIds = penugasan.map((pg) => pg.ruteId)
    // Peta rute → { kode, seksiCater, urutan kerja } untuk memberi label per
    // baris pelanggan dan mengurutkan lintas rute.
    const ruteInfo = new Map(
      penugasan.map((pg) => [
        pg.ruteId,
        {
          kode: pg.rute.kode,
          seksiCater: pg.rute.seksiCater,
          urutan: pg.urutan,
        },
      ])
    )

    // DAFTAR KERJANYA DITENTUKAN DAFTAR CATAT PERIODE ITU, bukan isi tabel
    // Pelanggan.
    //
    // Sebelumnya baris di bawah hanya menyaring `ruteId`, dan itu keliru dengan
    // cara yang terukur: tabel Pelanggan bersifat AKUMULATIF — ia menampung
    // semua yang pernah ada. Pada data ini 22.630 pelanggan masih memegang
    // ruteId sementara daftar catat periode berjalan hanya 22.522; selisih 99
    // seluruhnya sambungan yang SUDAH DICABUT (51 TUTUP_SEMENTARA, 47
    // TUTUP_SPT, 1 belum pasti). Akibatnya tiap petugas menerima 6-19 rumah
    // yang tidak perlu didatangi lagi, dan angka targetnya menggelembung
    // sebanyak itu — persis alasan model DaftarCatat dibuat: "tidak ada satu
    // pun tabel yang bisa menjawab siapa saja yang harus dicatat bulan ini".
    //
    // PENUGASAN RUTE TETAP DIBACA HIDUP (`ruteIds` dari PenugasanRute hari
    // ini), bukan dari snapshot pencatat di daftar catat. Dua-duanya perlu:
    // daftar catat menentukan SIAPA yang harus dicatat bulan ini, PenugasanRute
    // menentukan OLEH SIAPA — sehingga rute yang dialihkan di tengah bulan
    // langsung sampai ke petugas barunya tanpa menunggu bulan depan.
    const anggotaDaftar = await prisma.daftarCatat.findMany({
      where: { periode, pelanggan: { ruteId: { in: ruteIds } } },
      select: { pelangganId: true },
    })
    const idDaftar = anggotaDaftar.map((d) => d.pelangganId)

    // Daftar kosong punya DUA sebab yang berbeda jauh akibatnya: daftar catat
    // bulan ini memang belum diterbitkan (admin belum menjalankan "buka bulan
    // baru"), atau rute petugas ini yang kebetulan tidak punya anggota.
    // Dibedakan supaya aplikasi bisa berkata "daftar kerja bulan ini belum
    // terbit, hubungi admin" alih-alih menampilkan layar kosong yang terbaca
    // seperti kerusakan. Query tambahannya HANYA jalan saat kosong.
    const daftarBelumTerbit =
      idDaftar.length === 0 &&
      (await prisma.daftarCatat.count({ where: { periode } })) === 0

    const pelanggan = await prisma.pelanggan.findMany({
      // TIDAK ADA penyaringan status: seluruh status (DISEGEL, TUTUP_SEMENTARA,
      // TUTUP_SPT) tetap masuk buku rute — petugas tetap lewat dan statusnya
      // ditampilkan di baris. Dulu `CABUT_PERMANEN` dikecualikan di sini, tapi
      // status itu sudah dihapus: di PDAM tidak ada pencabutan selamanya.
      // Yang mengeluarkan sebuah sambungan dari buku rute BUKAN statusnya,
      // melainkan ketidakhadirannya di daftar catat periode ini — aturan yang
      // sama persis dengan closing & buka bulan baru.
      where: { id: { in: idDaftar }, ruteId: { in: ruteIds }, deletedAt: null },
      // Urutan kunjungan DALAM rute (noUrutRute); urutan ANTAR rute diterapkan
      // di bawah mengikuti PenugasanRute.urutan.
      orderBy: [
        { noUrutRute: { sort: "asc", nulls: "last" } },
        { nomorLangganan: "asc" },
      ],
      select: {
        id: true,
        nomorLangganan: true,
        nama: true,
        alamat: true,
        rt: true,
        rw: true,
        status: true,
        notelp: true,
        geoLat: true,
        geoLong: true,
        noUrutRute: true,
        /// Dasar "No Urut DPM" yang dihitung di bawah — bukan untuk ditampilkan
        /// mentah.
        nomorPersil: true,
        ruteId: true,
        tarifGolongan: { select: { kodeAsli: true } },
        meter: {
          where: { isAktif: true },
          take: 1,
          select: { id: true, nomorMeter: true },
        },
      },
    })
    // Urutkan lintas rute: rute sesuai urutan kerja, lalu noUrutRute dalam rute.
    pelanggan.sort((a, b) => {
      const ua = ruteInfo.get(a.ruteId!)?.urutan ?? 0
      const ub = ruteInfo.get(b.ruteId!)?.urutan ?? 0
      if (ua !== ub) return ua - ub
      const na = a.noUrutRute ?? Number.MAX_SAFE_INTEGER
      const nb = b.noUrutRute ?? Number.MAX_SAFE_INTEGER
      if (na !== nb) return na - nb
      return a.nomorLangganan.localeCompare(b.nomorLangganan)
    })

    const meterIds = pelanggan.flatMap((p) => p.meter.map((m) => m.id))
    // Jendela riwayat: 6 bulan ke belakang dari periode berjalan — cukup untuk
    // memilih 3 pembacaan resmi terakhir per meter (pola period1..period3
    // Aurora: bahan jawaban petugas saat pelanggan menanyakan riwayatnya),
    // tanpa menyeret seluruh histori bertahun-tahun.
    const batasRiwayat = periodeToDate(periode)
    batasRiwayat.setMonth(batasRiwayat.getMonth() - 6)
    const pelangganIds = pelanggan.map((p) => p.id)
    const [bacaanResmi, laporanPeriode, tagihanTerakhir] = await Promise.all([
      meterIds.length
        ? prisma.pembacaanMeter.findMany({
            where: {
              meterId: { in: meterIds },
              periode: { gte: batasRiwayat },
            },
            orderBy: [{ meterId: "asc" }, { periode: "desc" }],
            select: {
              meterId: true,
              periode: true,
              standLalu: true,
              standAkhir: true,
              pemakaianM3: true,
              tanggalCatat: true,
            },
          })
        : Promise.resolve([]),
      prisma.laporanHarianPetugas.findMany({
        where: {
          periode,
          nomorLangganan: { in: pelanggan.map((p) => p.nomorLangganan) },
        },
        select: {
          id: true,
          nomorLangganan: true,
          standAkhir: true,
          kondisi: true,
          tanggalCatat: true,
        },
      }),
      // Komponen tetap tagihan (beban + admin) dari tagihan RESMI terakhir tiap
      // pelanggan — bahan estimasi total di layar catat (air progresif + beban
      // + admin, pola calculateTagihan Aurora). Per-tagihan, bukan per-golongan
      // (sumber CSV beabeban/beaadmin), jadi diambil dari riwayat pelanggan itu
      // sendiri; pelanggan tanpa tagihan sebelumnya → null (estimasi jatuh ke
      // air-saja). Terurut periode desc, elemen pertama = paling baru.
      pelangganIds.length
        ? prisma.tagihan.findMany({
            where: { pelangganId: { in: pelangganIds } },
            orderBy: [{ pelangganId: "asc" }, { periode: "desc" }],
            /// `periode` + `totalTagihan` ikut diambil untuk keperluan KEDUA:
            /// menempelkan nominal tagihan ke tiap baris riwayat pembacaan.
            /// Petugas ditanyai "bulan lalu bayar berapa?" di depan rumah, dan
            /// tanpa angka ini ia hanya bisa menyebut pemakaian m³ — bukan yang
            /// ditanyakan.
            select: {
              pelangganId: true,
              periode: true,
              totalTagihan: true,
              beaBeban: true,
              beaAdmin: true,
            },
          })
        : Promise.resolve([]),
    ])
    // Kelompokkan per meter; baris sudah terurut periode desc, jadi elemen
    // pertama = pembacaan resmi terakhir (prefill stand lalu).
    const riwayatPerMeter = new Map<string, typeof bacaanResmi>()
    for (const b of bacaanResmi) {
      const daftar = riwayatPerMeter.get(b.meterId) ?? []
      if (daftar.length < 3) riwayatPerMeter.set(b.meterId, [...daftar, b])
    }
    const laporanPerNomor = new Map(
      laporanPeriode.map((l) => [l.nomorLangganan, l])
    )
    // Ambil hanya tagihan terbaru per pelanggan (baris terurut periode desc).
    const biayaTetapPerPelanggan = new Map<
      string,
      { beaBeban: number; beaAdmin: number }
    >()
    /// Nominal tagihan per (pelanggan, periode) — dicocokkan ke baris riwayat
    /// lewat PERIODE, bukan lewat `Tagihan.pembacaanId`. Relasi itu memang ada
    /// dan lebih tepat secara model, tetapi baris warisan impor Aurora tidak
    /// semuanya membawanya; mencocokkan lewat periode bekerja untuk keduanya.
    const totalTagihanPerPeriode = new Map<string, number>()
    for (const t of tagihanTerakhir) {
      if (!biayaTetapPerPelanggan.has(t.pelangganId)) {
        biayaTetapPerPelanggan.set(t.pelangganId, {
          beaBeban: t.beaBeban,
          beaAdmin: t.beaAdmin,
        })
      }
      const kunci = `${t.pelangganId}|${dateToPeriode(t.periode)}`
      if (!totalTagihanPerPeriode.has(kunci)) {
        totalTagihanPerPeriode.set(kunci, t.totalTagihan)
      }
    }

    // Nomor urut fallback dihitung PER RUTE, bukan lintas seluruh beban kerja:
    // pelanggan tanpa noUrutRute harus bernomor 1..n di dalam rutenya sendiri
    // (petugas membaca "urutan 1 dari rute R-042"), bukan posisinya di daftar
    // datar gabungan semua rute. `pelanggan` sudah terurut (rute, lalu
    // noUrutRute), jadi baris tiap rute kontigu — cukup hitung berjalan per rute.
    // NO URUT DPM — urutan menurut hirarki data, dihitung dari nomor persil.
    //
    // Ini ANGKA KEDUA, dan sengaja bukan pengganti `urutan`. Aplikasi lama
    // menampilkan keduanya berdampingan karena artinya memang berbeda:
    // urut DPM menyusun sambungan menurut struktur wilayah (nomor persil
    // berbentuk kode-rute + blok + urut, mis. CD104010003), sedangkan urut
    // pencatatan menyusunnya menurut cara petugas benar-benar berjalan. Yang
    // dipakai mengurutkan buku rute adalah yang kedua; yang pertama untuk
    // dicocokkan dengan berkas DPM dan aplikasi lama.
    //
    // Dihitung di sini, tidak disimpan sebagai kolom: ia turunan murni dari
    // nomorPersil, dan kolom turunan hanya menambah satu hal lagi yang bisa
    // basi tanpa membeli apa pun.
    const urutDpm = new Map<string, number>()
    for (const [ruteId] of ruteInfo) {
      const anggota = pelanggan
        .filter((p) => p.ruteId === ruteId)
        .sort(
          (a, b) =>
            (a.nomorPersil ?? "").localeCompare(b.nomorPersil ?? "") ||
            a.nomorLangganan.localeCompare(b.nomorLangganan)
        )
      anggota.forEach((p, i) => urutDpm.set(p.id, i + 1))
    }

    const urutPerRute = new Map<string, number>()
    const rows = pelanggan.map((p) => {
      const meter = p.meter[0] ?? null
      const riwayat = (meter ? riwayatPerMeter.get(meter.id) : undefined) ?? []
      const bacaan = riwayat[0]
      const laporan = laporanPerNomor.get(p.nomorLangganan)
      const biayaTetap = biayaTetapPerPelanggan.get(p.id) ?? null
      const seqRute = (urutPerRute.get(p.ruteId ?? "") ?? 0) + 1
      urutPerRute.set(p.ruteId ?? "", seqRute)
      return {
        pelangganId: p.id,
        nomorLangganan: p.nomorLangganan,
        nama: p.nama,
        alamat: p.alamat,
        rt: p.rt,
        rw: p.rw,
        status: p.status,
        notelp: p.notelp,
        geoLat: p.geoLat,
        geoLong: p.geoLong,
        golonganTarif: p.tarifGolongan?.kodeAsli ?? null,
        /// Rute asal baris — mobile mengelompokkan daftar per rute sesuai
        /// urutan kerja.
        ruteId: p.ruteId,
        ruteKode: ruteInfo.get(p.ruteId!)?.kode ?? null,
        /// Urutan kunjungan RBM; fallback ke posisi DALAM RUTE (bukan lintas
        /// semua rute) untuk data lama yang belum punya noUrutRute.
        urutan: p.noUrutRute ?? seqRute,
        noUrutRute: p.noUrutRute,
        /// Urutan menurut hirarki data (nomor persil) — angka yang sama dengan
        /// "No Urut DPM" di aplikasi lama. Ditampilkan berdampingan dengan
        /// `urutan`, bukan menggantikannya.
        noUrutDpm: urutDpm.get(p.id) ?? null,
        meterId: meter?.id ?? null,
        nomorMeter: meter?.nomorMeter ?? null,
        /// Jam kunjungan terakhir yang tercatat — DASAR urutan rute di
        /// lapangan, jadi petugas bisa melihat sendiri kenapa sebuah rumah ada
        /// di posisi itu. Null bila belum pernah ada pembacaan resmi.
        waktuCatatTerakhir: bacaan?.tanggalCatat?.toISOString() ?? null,
        standLalu: bacaan?.standAkhir ?? null,
        pemakaianLalu: bacaan?.pemakaianM3 ?? null,
        /// Komponen tetap tagihan terakhir (null bila pelanggan belum pernah
        /// ditagih) — mobile menambahkannya ke estimasi uang air progresif.
        beaBeban: biayaTetap?.beaBeban ?? null,
        beaAdmin: biayaTetap?.beaAdmin ?? null,
        /// Maks. 3 pembacaan resmi terakhir, terbaru dulu (period1..period3
        /// di Aurora) — di-cache aplikasi untuk ditunjukkan ke pelanggan
        /// saat ada sengketa tagihan di lapangan.
        riwayat: riwayat.map((r) => ({
          periode: dateToPeriode(r.periode),
          standLalu: r.standLalu,
          standAkhir: r.standAkhir,
          pemakaianM3: r.pemakaianM3,
          /// Null bila periode itu belum/tidak pernah ditagih — dan itu keadaan
          /// yang wajar, bukan galat: pembacaan lebih dulu ada daripada
          /// tagihannya. Aplikasi menampilkannya sebagai "—", bukan "Rp 0".
          totalTagihan:
            totalTagihanPerPeriode.get(`${p.id}|${dateToPeriode(r.periode)}`) ??
            null,
        })),
        sudahDicatat: !!laporan,
        laporan: laporan
          ? {
              id: laporan.id,
              standAkhir: laporan.standAkhir,
              kondisi: laporan.kondisi,
              tanggalCatat: laporan.tanggalCatat,
            }
          : null,
      }
    })

    // Ringkasan per rute (urut kerja) — target = jumlah pelanggan rute,
    // terbaca = yang sudah dicatat periode ini. Header aplikasi memakai ini.
    const rutes = penugasan.map((pg) => {
      const barisRute = rows.filter((r) => r.ruteId === pg.ruteId)
      return {
        id: pg.ruteId,
        kode: pg.rute.kode,
        seksiCater: pg.rute.seksiCater,
        urutan: pg.urutan,
        target: barisRute.length,
        terbaca: barisRute.filter((r) => r.sudahDicatat).length,
      }
    })

    return ok(c, {
      pencatat: { id: pencatat.id, namaLapangan: pencatat.namaLapangan },
      // `rute` (tunggal, rute pertama) dipertahankan untuk kompatibilitas
      // aplikasi versi lama; `rutes` adalah daftar penuh yang dibaca versi baru.
      rute: rutes[0]
        ? {
            id: rutes[0].id,
            kode: rutes[0].kode,
            seksiCater: rutes[0].seksiCater,
          }
        : null,
      rutes,
      periode,
      target: rows.length,
      terbaca: rows.filter((r) => r.sudahDicatat).length,
      dicatatSaya,
      daftarBelumTerbit,
      pelanggan: rows,
    })
  }
)

// ── Petugas menyusun ulang urutan kunjungan rutenya sendiri ──────────────
//
// KENAPA LANGSUNG BERLAKU, BUKAN LEWAT PERSETUJUAN. Urutan kunjungan bukan
// data induk — ia catatan cara berjalan, dan satu-satunya orang yang tahu
// jalannya adalah yang berjalan. Aplikasi lama pun begitu, dan itulah
// kebiasaan yang mau ditiru. Menahannya di antrean persetujuan berarti
// petugas bekerja dengan urutan yang dia sendiri tahu keliru sampai ada
// supervisor sempat menekan tombol.
//
// KENAPA TIDAK BUTUH KOLOM "TERKUNCI". Sebelumnya urutan ini punya lawan:
// penyegaran otomatis dari urutan baris berkas impor. Mekanisme itu SUDAH
// DICABUT (premisnya keliru — kedua berkas sumber ternyata terurut menurut
// nomor langganan, bukan menurut jalan). Karena tidak ada lagi proses yang
// menulis noUrutRute di belakang layar, susunan petugas tidak bisa tertimpa,
// dan penanda kunci hanya akan jadi kolom yang tidak menjaga apa pun.
//
// YANG DIJAGA: petugas hanya boleh menyusun rute YANG DITUGASKAN KEPADANYA,
// dan hanya pelanggan di dalam rute itu. Tanpa penjagaan ini seorang petugas
// bisa mengacak buku rute rekannya lewat panggilan API biasa.
const susunUrutSchema = z.object({
  ruteId: z.string().min(1),
  /// Seluruh pelanggan rute itu, dalam urutan kunjungan yang dikehendaki.
  /// Dikirim UTUH, bukan sepasang "pindahkan A ke posisi 5": daftar penuh
  /// membuat hasilnya tidak bergantung pada urutan sampainya permintaan
  /// kalau petugas menggeser beberapa baris sekaligus di perjalanan.
  pelangganIds: z.array(z.string().min(1)).min(1).max(2000),
})

laporanHarianRouter.post(
  "/rute-saya/urutan",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("json", susunUrutSchema),
  async (c) => {
    const { ruteId, pelangganIds } = c.req.valid("json")
    const user = getSessionUser(c)
    const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

    const pencatat = await prisma.pencatat.findUnique({
      where: { userId: user.id },
      select: { id: true, namaLapangan: true },
    })
    if (!pencatat)
      throw new BadRequestError("Akun Anda belum tertaut ke data Pencatat.")

    const penugasan = await prisma.penugasanRute.findFirst({
      where: { ruteId, pencatatId: pencatat.id },
      select: { ruteId: true },
    })
    if (!penugasan) throw new ForbiddenError("Rute ini bukan penugasan Anda.")

    // Anggota rute dibaca dari database, bukan dipercaya dari kiriman:
    // id asing dalam daftar tidak boleh ikut ternomori.
    const anggota = await prisma.pelanggan.findMany({
      where: { ruteId, deletedAt: null },
      select: { id: true },
    })
    const sah = new Set(anggota.map((a) => a.id))
    const berurut = pelangganIds.filter((id) => sah.has(id))
    const asing = pelangganIds.length - berurut.length

    // Yang tidak disebut pengirim tetap dinomori, di ekor, mengikuti urutan
    // lamanya — daftar yang tidak lengkap tidak boleh menghapus urutan
    // pelanggan yang kebetulan tidak ikut terkirim.
    const disebut = new Set(berurut)
    const sisa = anggota.filter((a) => !disebut.has(a.id)).map((a) => a.id)
    const final = [...berurut, ...sisa]

    const UKURAN = 200
    for (let i = 0; i < final.length; i += UKURAN) {
      await prisma.$transaction(
        final.slice(i, i + UKURAN).map((id, j) =>
          prisma.pelanggan.update({
            where: { id },
            data: { noUrutRute: i + j + 1 },
          })
        )
      )
    }

    await prisma.$transaction(async (tx) => {
      await recordAudit(tx, {
        userId: user.id,
        aksi: "SUSUN_URUT_RUTE",
        entitas: "Rute",
        entitasId: ruteId,
        perubahan: {
          oleh: pencatat.namaLapangan,
          jumlah: final.length,
          diabaikan: asing,
        },
        ipAddress,
        userAgent,
      })
    })

    return ok(c, { ruteId, dinomori: final.length, diabaikan: asing })
  }
)

// ── Upload berkas bukti petugas (foto stand / segel / rumah, plus video
// pembacaan). multipart/form-data karena membawa berkas; validasi isi
// (magic bytes) + penamaan deterministik terjadi di simpanBerkas(). Client
// memanggil ini per berkas, lalu menyertakan URL-nya di POST / atau /batch
// (fotoStandUrl/fotoSegelUrl/fotoRumahUrl/videoUrl). Field form tetap
// bernama `foto` juga untuk video — kontrak satu pintu, jangan dipecah.
const JENIS_FOTO = ["stand", "segel", "rumah", "video"] as const

laporanHarianRouter.post(
  "/foto",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  async (c) => {
    const form = await c.req.formData()
    const parsed = z
      .object({
        nomorLangganan: z
          .string()
          .trim()
          .regex(/^\d{11}$/, "Nomor langganan harus 11 digit angka"),
        periode: z.coerce.number().int().min(190001).max(999912),
        jenis: z.enum(JENIS_FOTO),
      })
      .parse({
        nomorLangganan: form.get("nomorLangganan"),
        periode: form.get("periode"),
        jenis: form.get("jenis"),
      })

    const foto = form.get("foto")
    if (!(foto instanceof File))
      throw new BadRequestError("Foto wajib dilampirkan sebagai field `foto`.")

    try {
      const hasil = await simpanBerkas(foto, {
        prefix: "laporan-harian",
        namaBerkas: `${parsed.periode}_${parsed.jenis}_${parsed.nomorLangganan}`,
        subFolder: `${parsed.periode}`,
        jenisMedia: parsed.jenis === "video" ? "video" : "foto",
      })
      return created(c, {
        jenis: parsed.jenis,
        url: hasil.url,
        publicId: hasil.publicId,
      })
    } catch (err) {
      if (err instanceof BerkasTidakValidError)
        throw new BadRequestError(err.message)
      throw err
    }
  }
)

laporanHarianRouter.get(
  "/:id",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const row = await prisma.laporanHarianPetugas.findUnique({
      where: { id: c.req.param("id") },
      include: {
        pelanggan: {
          include: {
            tarifGolongan: { select: { kodeAsli: true } },
            rute: { select: { kode: true } },
          },
        },
        pencatat: true,
        pembacaan: true,
        meterVerif: { select: { id: true, nomorMeter: true } },
        verifiedBy: { select: { id: true, name: true } },
        verif1By: { select: { id: true, name: true } },
        verif2By: { select: { id: true, name: true } },
        verif3By: { select: { id: true, name: true } },
      },
    })
    if (!row) throw new NotFoundError("LaporanHarianPetugas")
    const daftarCatat = row.pelangganId
      ? await prisma.daftarCatat.findFirst({
          where: { periode: row.periode, pelangganId: row.pelangganId },
          select: { rute: { select: { kode: true } } },
        })
      : null
    const pembacaan = row.pelangganId
      ? await ambilPembacaanResmi([
          { pelangganId: row.pelangganId, periode: row.periode },
        ])
      : []
    const pemakaianPeriodeSebelumnya = await ambilPemakaianPeriodeSebelumnya([
      { pelangganId: row.pelangganId, periode: row.periode },
    ])
    return ok(c, {
      ...row,
      pemakaianLalu: pilihPemakaianLalu(
        row.pemakaianLalu,
        pemakaianPeriodeSebelumnya.get(`${row.periode}:${row.pelangganId}`)
      ),
      ruteKodeCatat:
        daftarCatat?.rute?.kode ?? row.pelanggan?.rute?.kode ?? null,
      pembacaan: denganSumberResmi(
        pembacaan.find((item) => item.meter.pelangganId === row.pelangganId) ??
          row.pembacaan
      ),
    })
  }
)

const urlFotoSchema = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (v) =>
      v.startsWith("https://") || v.startsWith("http://") || v.startsWith("/"),
    {
      message: "URL foto harus absolut (http/https) atau path relatif server",
    }
  )

const createSchema = z.object({
  nomorLangganan: z.string().trim().min(1).max(20),
  pelangganId: z.string().min(1).nullable().optional(),
  namaPelanggan: z.string().trim().max(200).nullable().optional(),
  alamatPelanggan: z.string().trim().max(500).nullable().optional(),
  periode: z.coerce.number().int().min(190001).max(999912),
  standAwal: z.coerce.number().int().min(0),
  standAkhir: z.coerce.number().int().min(0),
  pemakaianLalu: z.coerce.number().int().min(0).nullable().optional(),
  persentase: z.coerce.number().int().nullable().optional(),
  kondisi: z.enum(KondisiCatat).optional(),
  kategori: z.enum(KategoriPembacaan).optional(),
  nomorMeter: z.string().trim().max(50).nullable().optional(),
  pencatatId: z.string().min(1).nullable().optional(),
  tanggalCatat: z.coerce.date().nullable().optional(),
  /// Tiga foto bukti dari aplikasi petugas: stand meter, segel, rumah.
  /// Diterima juga path relatif ("/api/public/berkas/…") — bentuk URL yang
  /// dikembalikan simpanBerkas() pada fallback disk lokal saat development;
  /// z.string().url() murni akan menolaknya dan mematikan alur foto di dev.
  fotoStandUrl: urlFotoSchema.nullable().optional(),
  fotoSegelUrl: urlFotoSchema.nullable().optional(),
  fotoRumahUrl: urlFotoSchema.nullable().optional(),
  /// Video pembacaan (opsional) — unggah dulu lewat POST /foto jenis=video.
  videoUrl: urlFotoSchema.nullable().optional(),
  /// Posisi GPS petugas saat menyimpan catatan (pola bill_longlatcatat
  /// Aurora). jarakMeter TIDAK diterima dari client — dihitung server dari
  /// pasangan ini terhadap koordinat pelanggan.
  latCatat: z.coerce.number().min(-90).max(90).nullable().optional(),
  longCatat: z.coerce.number().min(-180).max(180).nullable().optional(),
  /// Kondisi segel yang ditemukan di lapangan (bill_issegel Aurora).
  isSegel: z.boolean().nullable().optional(),
  /// Usulan koreksi data pelanggan dari lapangan (bill_perubahan Aurora).
  usulanPerubahan: z.string().trim().max(1000).nullable().optional(),
  /// Usulan nomor urut kunjungan baru (bill_reqnourutbaru Aurora) — admin
  /// menerapkannya ke Pelanggan.noUrutRute saat closing.
  usulanNoUrut: z.coerce.number().int().min(1).nullable().optional(),
  /// Pembaruan No. HP pelanggan dari lapangan (bill_nohp Aurora) —
  /// diterapkan langsung ke Pelanggan.notelp bila laporan tertaut
  /// pelanggan; string kosong/null diabaikan (bukan perintah menghapus).
  notelpBaru: z.string().trim().max(30).nullable().optional(),
})

type CreateLaporanInput = z.infer<typeof createSchema>

/// Jarak (meter, bulat) posisi catat petugas ke titik pelanggan — bukti
/// kehadiran di lokasi (marginMeter di Aurora). Prioritas kolom PostGIS
/// `koordinat`; fallback geoLat/geoLong legacy HANYA bila masuk akal sebagai
/// koordinat (placeholder Excel-serial ~46168 di data lama harus tersaring).
/// $queryRawUnsafe + parameter posisi — JANGAN Prisma.raw (server/README.md).
async function hitungJarakMeter(
  pelangganId: string,
  latCatat: number,
  longCatat: number
): Promise<number | null> {
  const hasil = await prisma.$queryRawUnsafe<{ jarak: number | null }[]>(
    `SELECT ST_DistanceSphere(
        COALESCE(
          koordinat,
          CASE WHEN "geoLat" BETWEEN -90 AND 90 AND "geoLong" BETWEEN -180 AND 180
               THEN ST_SetSRID(ST_MakePoint("geoLong", "geoLat"), 4326) END
        ),
        ST_SetSRID(ST_MakePoint($1, $2), 4326)
     ) AS jarak
     FROM pelanggan WHERE id = $3`,
    longCatat,
    latCatat,
    pelangganId
  )
  const jarak = hasil[0]?.jarak
  return jarak == null ? null : Math.round(jarak)
}

/// Inti penyimpanan satu laporan — dipakai POST / dan POST /batch supaya
/// aturan bisnisnya (pemakaian dihitung server, snapshot identitas, jarak
/// GPS) tidak bercabang dua.
/// Hari terakhir bulan sebuah periode (TTTTBB), dalam UTC. Hari ke-0 bulan
/// berikutnya = hari terakhir bulan ini.
function akhirBulanPeriode(periode: number): Date {
  const tahun = Math.floor(periode / 100)
  const bulan = periode % 100
  return new Date(Date.UTC(tahun, bulan, 0))
}

async function simpanLaporan(
  input: CreateLaporanInput,
  pencatatIdDefault: string | null
) {
  // notelpBaru bukan kolom laporan — dipisah sebelum spread ke create().
  const { notelpBaru, ...body } = input
  // pemakaian dihitung server dari stand, bukan diterima dari client.
  const pemakaian = Math.max(0, body.standAkhir - body.standAwal)

  // Siapa pencatatnya, dengan tiga lapis — dari yang paling tahu ke yang
  // paling umum:
  //
  //   1. dikirim client        (jarang; hanya alat administratif)
  //   2. akun token            aplikasi petugas: pengirimnya sendiri
  //      (jembatan Pencatat.userId), tanpa memercayai client menyebut
  //      identitasnya sendiri
  //   3. PENUGASAN RUTE        entri manual dari layar Mutasi PBPK: yang
  //      menekan tombol adalah operator kantor, bukan pencatat, sehingga
  //      lapis 2 kosong. Petugas yang benar adalah yang ditugaskan pada
  //      rute pelanggan itu.
  //
  // Tanpa lapis ke-3, laporan hasil entri manual lahir tanpa petugas — dan
  // di layar verifikasi kolom Petugas kosong padahal rutenya jelas menunjuk
  // seseorang. Itu bukan sekadar tampilan: beban kerja per petugas jadi
  // tidak menghitung sambungan baru sama sekali.
  let pencatatId =
    body.pencatatId === undefined ? pencatatIdDefault : body.pencatatId
  if (!pencatatId && body.pelangganId) {
    const lewatRute = await prisma.pelanggan.findUnique({
      where: { id: body.pelangganId },
      select: {
        rute: {
          select: {
            penugasanRute: {
              select: { pencatatId: true },
              orderBy: { urutan: "asc" },
              take: 1,
            },
          },
        },
      },
    })
    pencatatId = lewatRute?.rute?.penugasanRute[0]?.pencatatId ?? null
  }

  // Snapshot identitas (nama/alamat) WAJIB terisi selama pelanggannya
  // dikenal — baris harus tetap terbaca di UI walau relasi pelanggan
  // kelak terputus (pola relasi+snapshot, lihat prisma/docs/README.md).
  let { namaPelanggan, alamatPelanggan } = body
  if (body.pelangganId && (!namaPelanggan || !alamatPelanggan)) {
    const p = await prisma.pelanggan.findUnique({
      where: { id: body.pelangganId },
      select: { nama: true, alamat: true },
    })
    namaPelanggan ??= p?.nama ?? null
    alamatPelanggan ??= p?.alamat ?? null
  }

  const jarakMeter =
    body.pelangganId && body.latCatat != null && body.longCatat != null
      ? await hitungJarakMeter(body.pelangganId, body.latCatat, body.longCatat)
      : null

  // tanggalCatat: kiriman aplikasi petugas selalu membawanya (waktu ia
  // berdiri di depan meter). Entri manual tidak — dan tanpa nilai, kolom
  // "Catat" di layar verifikasi kosong serta saringan rentang tanggal tidak
  // pernah menemukan barisnya.
  //
  // Bawaannya AKHIR BULAN PERIODE, bukan "sekarang". Periode yang dikerjakan
  // kerap tertinggal jauh dari kalender — mengisi waktu penyimpanan membuat
  // pembacaan Januari bertanggal catat Juli, yang salah di layar dan membuat
  // saringan rentang tanggal Januari tidak pernah menemukannya. Kapan baris
  // ini DIKETIK tetap terekam terpisah di createdAt; yang dicatat di sini
  // adalah kapan meternya dibaca, dan itu ada di dalam periodenya.
  const tanggalCatat = body.tanggalCatat ?? akhirBulanPeriode(body.periode)

  const row = await prisma.laporanHarianPetugas.create({
    data: {
      ...body,
      pencatatId,
      tanggalCatat,
      namaPelanggan,
      alamatPelanggan,
      pemakaian,
      jarakMeter,
      tanggalUpload: new Date(),
    },
  })

  // Pembaruan kontak dari lapangan diterapkan SETELAH laporan tersimpan —
  // gagalnya update notelp (mis. pelanggan terhapus) tidak boleh
  // menggagalkan laporan yang sudah susah payah dicatat.
  if (notelpBaru && body.pelangganId) {
    try {
      await prisma.pelanggan.update({
        where: { id: body.pelangganId },
        data: { notelp: notelpBaru },
      })
    } catch {
      // baris pelanggan hilang/berubah — laporan tetap sah tanpa update HP.
    }
  }
  return row
}

laporanHarianRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("json", createSchema),
  async (c) => {
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    let pencatatIdDefault: string | null = null
    if (body.pencatatId === undefined) {
      const pencatat = await prisma.pencatat.findUnique({
        where: { userId: requester.id },
        select: { id: true },
      })
      pencatatIdDefault = pencatat?.id ?? null
    }
    const row = await simpanLaporan(body, pencatatIdDefault)
    return created(c, row)
  }
)

// ── Sinkronisasi batch dari aplikasi petugas (pola dev_store_data.php
// Aurora): petugas bekerja OFFLINE seharian lalu mengunggah borongan.
// Kontraknya per-record, BUKAN semua-atau-gagal: satu baris bermasalah
// tidak boleh membatalkan ratusan baris lain yang sudah susah payah
// dicatat di lapangan. DUPLIKAT (P2002 pada [nomorLangganan, periode])
// diperlakukan sebagai sukses-idempoten — terjadi saat unggah ulang karena
// sinyal putus sebelum respons pertama sampai; client cukup menandai baris
// itu "sudah terunggah".
const batchSchema = z.object({
  laporan: z.array(createSchema).min(1).max(300),
})

laporanHarianRouter.post(
  "/batch",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("json", batchSchema),
  async (c) => {
    const { laporan } = c.req.valid("json")
    const requester = getSessionUser(c)
    const pencatat = await prisma.pencatat.findUnique({
      where: { userId: requester.id },
      select: { id: true },
    })
    const pencatatIdDefault = pencatat?.id ?? null

    const hasil: {
      index: number
      nomorLangganan: string
      periode: number
      status: "TERSIMPAN" | "DUPLIKAT" | "GAGAL"
      id?: string
      pesan?: string
    }[] = []

    // Sequential, bukan Promise.all — batch 300 baris paralel akan menghabiskan
    // pool koneksi dan urutan hasil harus stabil mengikuti urutan kiriman.
    for (const [index, item] of laporan.entries()) {
      const identitas = {
        index,
        nomorLangganan: item.nomorLangganan,
        periode: item.periode,
      }
      try {
        const row = await simpanLaporan(item, pencatatIdDefault)
        hasil.push({ ...identitas, status: "TERSIMPAN", id: row.id })
      } catch (err) {
        if (isPrismaKnownError(err) && err.code === "P2002") {
          hasil.push({
            ...identitas,
            status: "DUPLIKAT",
            pesan: "Laporan periode ini sudah pernah terunggah.",
          })
        } else if (isPrismaKnownError(err) && err.code === "P2003") {
          hasil.push({
            ...identitas,
            status: "GAGAL",
            pesan: "Referensi pelanggan/pencatat tidak valid.",
          })
        } else {
          // Pesan internal tidak diteruskan — bisa memuat detail infrastruktur.
          console.error("[laporan-harian/batch] baris gagal:", identitas, err)
          hasil.push({
            ...identitas,
            status: "GAGAL",
            pesan: "Terjadi kesalahan menyimpan baris ini.",
          })
        }
      }
    }

    const hitung = (s: "TERSIMPAN" | "DUPLIKAT" | "GAGAL") =>
      hasil.filter((h) => h.status === s).length
    return ok(c, {
      total: laporan.length,
      tersimpan: hitung("TERSIMPAN"),
      duplikat: hitung("DUPLIKAT"),
      gagal: hitung("GAGAL"),
      hasil,
    })
  }
)

// ── Impor cadangan lapangan (berkas backup aplikasi petugas → laporan).
// Dipakai halaman "Impor cadangan" dashboard.
//
// DUA PINTU TERPISAH, dan keduanya MENUNTUT periode disebut eksplisit.
//
// Versi sebelumnya satu pintu "lempar apa saja ke sini": periode dibaca dari
// nama berkas, jenis ditebak dari nama berkas, dan apa pun yang tidak cocok
// pola DILEWATI DIAM-DIAM. Itu keliru ke dua arah sekaligus. Sekantong foto
// periode lain masuk tanpa perlawanan ke periode yang kebetulan tertulis di
// namanya — tidak ada yang bisa menyanggah, karena tidak ada pernyataan niat
// untuk dibandingkan. Dan berkas yang salah nama lenyap tanpa jejak: admin
// melihat "0 gagal" lalu menyimpulkan semuanya masuk.
//
// Sekarang admin MENYATAKAN apa yang sedang ia impor — periode, dan untuk
// foto satu jenis — lalu tiap berkas diadu dengan pernyataan itu. Nama berkas
// tetap satu-satunya sumber pemetaan ke pelanggan (`periode_tipe_nomor.ext`,
// dibentuk aplikasi petugas), tapi ia kini harus SETUJU dengan formulirnya.
// Tidak cocok pola, atau cocok tapi beda periode/jenis = DILAPORKAN dengan
// alasan yang menyebut selisihnya. Tidak ada lagi berkas yang hilang diam.
//
// Urutan pemakaian: catatan (CSV) DULU, baru foto.
//  - catatan → MEMBUAT LaporanHarianPetugas lewat simpanLaporan() yang sama
//    dengan /batch (idempoten: P2002 → DUPLIKAT). Sumber angka stand/kondisi.
//  - foto/video → MELAMPIRKAN URL ke pembacaan yang SUDAH ADA pada
//    (nomorLangganan, periode). Belum ada induknya → TANPA_PENCATATAN, bukan
//    gagal: impor catatannya lebih dulu lalu ulangi.
const IMPOR_MAKS_ZIP_BYTE = 80 * 1024 * 1024
const IMPOR_MAKS_ENTRI = 5000
const TIPE_FOTO = ["stand", "segel", "rumah", "video"] as const
type TipeImpor = (typeof TIPE_FOTO)[number] | "catatan"
type JenisFoto = (typeof TIPE_FOTO)[number]
// Dikunci ke JenisFoto (bukan Record<string, …>): dengan kunci berhingga,
// pencarian FIELD_URL_FOTO[jenis] TOTAL — tidak bisa menghasilkan undefined
// yang diam-diam jadi nama kolom `undefined` saat dipakai sebagai computed
// property di updateMany.
const FIELD_URL_FOTO: Record<
  JenisFoto,
  "fotoStandUrl" | "fotoSegelUrl" | "fotoRumahUrl" | "videoUrl"
> = {
  stand: "fotoStandUrl",
  segel: "fotoSegelUrl",
  rumah: "fotoRumahUrl",
  video: "videoUrl",
}
// `periode_tipe_nomor.ext` pada nama-dasar berkas (abaikan prefix folder ZIP).
const POLA_FOTO =
  /(?:^|\/)(\d{6})_(stand|segel|rumah|video)_(\d{6,20})\.(jpe?g|png|webp|mp4)$/i

type StatusImpor =
  "TERSIMPAN" | "DUPLIKAT" | "DILAMPIRKAN" | "TANPA_PENCATATAN" | "GAGAL"
interface BarisHasil {
  index: number
  jenis: TipeImpor
  nomorLangganan: string
  periode: number
  status: StatusImpor
  id?: string
  pesan?: string
}

/// Entri sumber terunifikasi: berasal dari file lepasan atau isi ZIP.
interface EntriImpor {
  nama: string
  buffer: () => Promise<ArrayBuffer>
  teks: () => Promise<string>
}

/// Pengurai CSV RFC-4180 ringkas (tangani kutip, koma dalam kutip, CRLF).
function uraiCsv(teks: string): string[][] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQ = false
  for (let i = 0; i < teks.length; i++) {
    const ch = teks[i]
    if (inQ) {
      if (ch === '"') {
        if (teks[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += ch
      continue
    }
    if (ch === '"') inQ = true
    else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\r") {
      /* abaikan */
    } else if (ch === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else field += ch
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""))
}

/// Kumpulkan entri sumber dari field `berkas`: berkas lepasan apa adanya, ZIP
/// di-flatten. Dipakai kedua pintu impor.
async function kumpulkanEntri(form: FormData): Promise<EntriImpor[]> {
  const berkasMasuk = form
    .getAll("berkas")
    .filter((f): f is File => f instanceof File)
  if (berkasMasuk.length === 0)
    throw new BadRequestError(
      "Lampirkan minimal satu berkas di field `berkas`."
    )

  const entri: EntriImpor[] = []
  let totalByte = 0
  for (const f of berkasMasuk) {
    totalByte += f.size
    if (totalByte > IMPOR_MAKS_ZIP_BYTE)
      throw new BadRequestError("Total ukuran unggahan melebihi 80 MB.")
    const isZip =
      f.name.toLowerCase().endsWith(".zip") || f.type.includes("zip")
    if (!isZip) {
      entri.push({
        nama: f.name,
        buffer: () => f.arrayBuffer(),
        teks: () => f.text(),
      })
      continue
    }
    let zip: JSZip
    try {
      zip = await JSZip.loadAsync(await f.arrayBuffer())
    } catch {
      throw new BadRequestError(`Berkas "${f.name}" bukan ZIP yang valid.`)
    }
    for (const jalur of Object.keys(zip.files)) {
      const item = zip.files[jalur]
      // `item` dijaga eksplisit: JSZip.files bertipe indeks, jadi kunci hasil
      // Object.keys pun tetap bisa bertipe undefined bagi TS.
      if (!item || item.dir) continue
      // Sampah metadata (__MACOSX/, berkas titik) ikut terbawa saat admin
      // mem-ZIP lewat Finder. Itu bukan kiriman petugas, jadi ia dilewati
      // diam-diam — satu-satunya hal yang MASIH boleh dilewati diam-diam,
      // karena melaporkannya sebagai gagal justru menutupi kegagalan asli.
      const dasar = jalur.split("/").pop() ?? jalur
      if (jalur.startsWith("__MACOSX/") || dasar.startsWith(".")) continue
      entri.push({
        nama: jalur,
        buffer: () => item.async("arraybuffer"),
        teks: () => item.async("string"),
      })
    }
  }
  if (entri.length > IMPOR_MAKS_ENTRI)
    throw new BadRequestError(
      `Terlalu banyak berkas (maks ${IMPOR_MAKS_ENTRI}).`
    )
  return entri
}

function ringkasImpor(hasil: BarisHasil[]) {
  const hitung = (s: StatusImpor) => hasil.filter((h) => h.status === s).length
  return {
    total: hasil.length,
    tersimpan: hitung("TERSIMPAN"),
    duplikat: hitung("DUPLIKAT"),
    dilampirkan: hitung("DILAMPIRKAN"),
    tanpaPencatatan: hitung("TANPA_PENCATATAN"),
    gagal: hitung("GAGAL"),
    hasil,
  }
}

/// Periode WAJIB dan eksplisit di kedua pintu — lihat catatan blok di atas.
const periodeImpor = z.coerce.number().int().min(190001).max(999912)

// ── Pintu 1: FOTO / VIDEO ──────────────────────────────────────────────
// Satu jenis per unggahan. Admin memilih "foto stand periode 202607", lalu
// setiap berkas diadu dengan pernyataan itu sebelum menyentuh Cloudinary.
const imporFotoSchema = z.object({
  periode: periodeImpor,
  jenis: z.enum(TIPE_FOTO),
})

laporanHarianRouter.post(
  "/impor/foto",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const form = await c.req.formData()
    const { periode, jenis } = imporFotoSchema.parse({
      periode: form.get("periode"),
      jenis: form.get("jenis"),
    })
    const entri = await kumpulkanEntri(form)

    const hasil: BarisHasil[] = []
    let idx = 0
    for (const e of entri) {
      const dasar = e.nama.split("/").pop() ?? e.nama
      const m = POLA_FOTO.exec(e.nama)
      if (!m) {
        hasil.push({
          index: idx++,
          jenis,
          nomorLangganan: "?",
          periode,
          status: "GAGAL",
          pesan: `"${dasar}" tidak mengikuti pola periode_tipe_nomor.ext — tidak ada nomor langganan yang bisa dipetakan.`,
        })
        continue
      }
      const periodeBerkas = Number(m[1])
      const jenisBerkas = TIPE_FOTO.find((t) => t === m[2]!.toLowerCase())
      const nomor = m[3]!
      const identitas = {
        index: idx++,
        jenis,
        nomorLangganan: nomor,
        periode: periodeBerkas,
      }

      // Nama berkas HARUS setuju dengan formulir. Inilah gunanya menyebut
      // periode & jenis di depan: sekantong foto yang tercampur dari periode
      // lain berhenti di sini, bukan menyelinap masuk ke periode yang kebetulan
      // tertulis di namanya.
      if (periodeBerkas !== periode) {
        hasil.push({
          ...identitas,
          status: "GAGAL",
          pesan: `Berkas ini periode ${periodeBerkas}, sedang mengimpor ${periode}.`,
        })
        continue
      }
      if (jenisBerkas !== jenis) {
        hasil.push({
          ...identitas,
          status: "GAGAL",
          pesan: `Berkas ini foto ${jenisBerkas}, sedang mengimpor ${jenis}.`,
        })
        continue
      }

      try {
        const buf = await e.buffer()
        const berkasFoto = new File(
          [buf],
          `${periode}_${jenis}_${nomor}.${jenis === "video" ? "mp4" : "jpg"}`,
          {
            type: jenis === "video" ? "video/mp4" : "image/jpeg",
          }
        )
        let url: string
        try {
          const simpan = await simpanBerkas(berkasFoto, {
            prefix: "laporan-harian",
            namaBerkas: `${periode}_${jenis}_${nomor}`,
            subFolder: `${periode}`,
            jenisMedia: jenis === "video" ? "video" : "foto",
          })
          url = simpan.url
        } catch (err) {
          if (err instanceof BerkasTidakValidError) {
            hasil.push({
              ...identitas,
              status: "GAGAL",
              pesan: "Berkas foto/video rusak atau tak dikenal.",
            })
            continue
          }
          throw err
        }
        // Lampirkan ke pembacaan yang ada — tanpa membuat baris baru.
        const upd = await prisma.laporanHarianPetugas.updateMany({
          where: { nomorLangganan: nomor, periode },
          data: { [FIELD_URL_FOTO[jenis]]: url },
        })
        hasil.push(
          upd.count > 0
            ? { ...identitas, status: "DILAMPIRKAN" }
            : {
                ...identitas,
                status: "TANPA_PENCATATAN",
                pesan:
                  "Belum ada pencatatan periode ini — impor catatannya dulu.",
              }
        )
      } catch (err) {
        console.error("[impor/foto] gagal:", identitas, err)
        hasil.push({
          ...identitas,
          status: "GAGAL",
          pesan: "Terjadi kesalahan memproses berkas ini.",
        })
      }
    }

    return ok(c, ringkasImpor(hasil))
  }
)

// ── Pintu 2: CATATAN (CSV) ─────────────────────────────────────────────
// Sumber angka stand/kondisi; inilah yang MEMBUAT baris pembacaan, jadi ia
// harus diimpor lebih dulu sebelum fotonya punya induk untuk dilampiri.
const imporCatatanSchema = z.object({ periode: periodeImpor })

laporanHarianRouter.post(
  "/impor/catatan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const form = await c.req.formData()
    const { periode } = imporCatatanSchema.parse({
      periode: form.get("periode"),
    })
    const entri = await kumpulkanEntri(form)

    const entriCsv = entri.filter((e) => /\.csv$/i.test(e.nama))
    if (entriCsv.length === 0) {
      throw new BadRequestError(
        "Tidak ada berkas CSV di unggahan ini. Catatan pencatatan diekspor aplikasi sebagai `<periode>_catatan.csv`."
      )
    }

    const requester = getSessionUser(c)
    const pencatat = await prisma.pencatat.findUnique({
      where: { userId: requester.id },
      select: { id: true },
    })
    const pencatatIdDefault = pencatat?.id ?? null

    const hasil: BarisHasil[] = []
    let idx = 0
    for (const e of entriCsv) {
      let baris: string[][]
      try {
        baris = uraiCsv(await e.teks())
      } catch {
        hasil.push({
          index: idx++,
          jenis: "catatan",
          nomorLangganan: "?",
          periode,
          status: "GAGAL",
          pesan: `CSV "${e.nama}" gagal dibaca.`,
        })
        continue
      }
      const [barisHeader, ...isiCsv] = baris
      if (!barisHeader || isiCsv.length === 0) continue
      const header = barisHeader.map((h) => h.trim())

      for (const kolom of isiCsv) {
        const obj: Record<string, string> = {}
        header.forEach((h, i) => {
          const v = (kolom[i] ?? "").trim()
          if (v !== "") obj[h] = v
        })
        const nomorLangganan = obj.nomorLangganan ?? ""
        // Kolom periode boleh kosong — formulir yang menentukan. Tapi kalau
        // diisi, ia HARUS sama: satu CSV periode lain tidak boleh menumpang di
        // unggahan ini hanya karena admin salah pilih berkas.
        const periodeBaris = obj.periode ? Number(obj.periode) : periode
        const identitas = {
          index: idx++,
          jenis: "catatan" as const,
          nomorLangganan,
          periode: periodeBaris,
        }
        if (periodeBaris !== periode) {
          hasil.push({
            ...identitas,
            status: "GAGAL",
            pesan: `Baris ini periode ${periodeBaris}, sedang mengimpor ${periode}.`,
          })
          continue
        }

        // isSegel di CSV berupa teks "true"/"false"; createSchema mengharap
        // boolean asli (bukan z.coerce), jadi dikonversi sebelum validasi.
        const input: Record<string, unknown> = { ...obj, periode }
        if ("isSegel" in obj)
          input.isSegel = obj.isSegel === "true" || obj.isSegel === "1"
        // CSV aplikasi MEMBAWA pelangganId (kolomnya ada di backup.ts), tapi
        // CSV yang disusun tangan kerap tidak — maka nomorLangganan dipakai
        // sebagai cadangan supaya barisnya tetap tertaut ke pelanggan (snapshot
        // nama/alamat, jarak GPS, alur verifikasi) alih-alih jadi orphan.
        if (!input.pelangganId && nomorLangganan) {
          const p = await prisma.pelanggan.findFirst({
            where: { nomorLangganan, deletedAt: null },
            select: { id: true },
          })
          if (p) input.pelangganId = p.id
        }

        const parsed = createSchema.safeParse(input)
        if (!parsed.success) {
          hasil.push({
            ...identitas,
            status: "GAGAL",
            pesan: "Baris catatan tidak valid / stand tidak lengkap.",
          })
          continue
        }
        try {
          const row = await simpanLaporan(parsed.data, pencatatIdDefault)
          hasil.push({ ...identitas, status: "TERSIMPAN", id: row.id })
        } catch (err) {
          if (isPrismaKnownError(err) && err.code === "P2002") {
            hasil.push({
              ...identitas,
              status: "DUPLIKAT",
              pesan: "Pembacaan periode ini sudah ada.",
            })
          } else if (isPrismaKnownError(err) && err.code === "P2003") {
            hasil.push({
              ...identitas,
              status: "GAGAL",
              pesan: "Referensi pelanggan/pencatat tidak valid.",
            })
          } else {
            console.error("[impor/catatan] gagal:", identitas, err)
            hasil.push({
              ...identitas,
              status: "GAGAL",
              pesan: "Terjadi kesalahan menyimpan baris ini.",
            })
          }
        }
      }
    }

    return ok(c, ringkasImpor(hasil))
  }
)

// ── Verifikasi berjenjang V1 → V2 → V3. PembacaanMeter resmi BARU
// dibuat saat V3 — bukan di V1 seperti alur lama. Urutan ring wajib, tapi
// role di atasnya boleh mengerjakan ring bawah (V1 = SUPERVISOR_UP,
// V2 = MANAGEMENT_UP, V3 = SENIOR_UP).

const verif1Schema = z.object({
  /// Meter tujuan pembacaan resmi, dipilih di V1 (paling dekat ke lapangan).
  /// Wajib eksplisit: `nomorMeter` di laporan bisa duplikat/orphan (681
  /// duplikat di data lapangan), jadi penentuan meter yang benar adalah
  /// keputusan verifikator, bukan tebakan sistem.
  meterId: z.string().min(1),
  blokTarif: z.coerce.number().int().min(1).max(4),
  catatanVerif: z.string().trim().max(500).nullable().optional(),
  /// "ST akhir revisi": koreksi stand akhir bila petugas salah input.
  /// TIDAK menimpa standAkhir (angka catat) — keduanya tampil berdampingan;
  /// V3 memakai revisi (bila ada) sebagai stand pembacaan resmi.
  standAkhirRevisi: z.coerce.number().int().min(0).nullable().optional(),
  /// Stand angkat hanya dipakai untuk kondisi MB. standAwal laporan adalah
  /// stand meter lama pada awal periode; pembacaan meter baru dicatat
  /// terpisah agar pemakaian gabungan dapat dihitung.
  standAngkatLama: z.coerce.number().int().min(0).nullable().optional(),
  standMeterBaru: z.coerce.number().int().min(0).nullable().optional(),
  /// Koreksi keterangan/kondisi catat (DK, BMK/BMB, dst.) — stand revisi
  /// kumulatif kerap menuntut kondisi ikut dibenarkan. Ikut mengalir ke
  /// PembacaanMeter resmi saat V3 (V3 membaca laporan.kondisi).
  kondisi: z.enum(KondisiCatat).optional(),
  /// Dipertahankan pada schema bersama agar V3 dapat menetapkan nilai final.
  /// Handler V1 dan V2 menolak field ini secara eksplisit.
  pemakaianTagih: z.coerce.number().int().min(0).nullable().optional(),
})

function validasiStandAngkat(
  kondisi: string,
  standAngkatLama: number | null | undefined,
  standMeterBaru: number | null | undefined
) {
  if (kondisi !== "MB") return null
  if (standAngkatLama == null || standMeterBaru == null) {
    throw new BadRequestError(
      "Kondisi MB memerlukan stand angkat meter lama dan stand meter baru."
    )
  }
  return { standAngkatLama, standMeterBaru }
}

async function validasiMeterBaru(
  pelangganId: string | null,
  meterId: string | null | undefined
) {
  if (!meterId) throw new BadRequestError("Meter baru belum dipilih.")
  const meter = await prisma.meter.findUnique({ where: { id: meterId } })
  if (!meter) throw new NotFoundError("Meter")
  if (!pelangganId || meter.pelangganId !== pelangganId || !meter.isAktif) {
    throw new BadRequestError(
      "Kondisi MB harus menggunakan meter baru yang aktif milik pelanggan ini."
    )
  }
}

laporanHarianRouter.patch(
  "/:id/verif1",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", verif1Schema),
  async (c) => {
    const id = c.req.param("id")
    const body = c.req.valid("json")
    if (body.pemakaianTagih !== undefined) {
      pastikanV3UntukTagihan(getSessionUser(c).role, 1)
    }
    const requester = getSessionUser(c)

    const laporan = await prisma.laporanHarianPetugas.findUnique({
      where: { id },
    })
    if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
    if (laporan.pembacaanId)
      throw new ConflictError("Laporan sudah menjadi pembacaan resmi")
    if (laporan.verif1At)
      throw new ConflictError(
        "V1 sudah diisi — batalkan dulu bila perlu mengulang"
      )

    const meter = await prisma.meter.findUnique({
      where: { id: body.meterId },
    })
    if (!meter) throw new NotFoundError("Meter")
    const kondisiEfektif = body.kondisi ?? laporan.kondisi
    validasiStandAngkat(
      kondisiEfektif,
      body.standAngkatLama,
      body.standMeterBaru
    )
    if (
      kondisiEfektif === "MB" &&
      (meter.pelangganId !== laporan.pelangganId || !meter.isAktif)
    ) {
      throw new BadRequestError(
        "Kondisi MB harus menggunakan meter baru yang aktif milik pelanggan ini."
      )
    }

    const row = await prisma.laporanHarianPetugas.update({
      where: { id },
      data: {
        verif1At: new Date(),
        verif1ById: requester.id,
        meterVerifId: body.meterId,
        blokTarifVerif: body.blokTarif,
        standAkhirRevisi: body.standAkhirRevisi,
        standAngkatLama: kondisiEfektif === "MB" ? body.standAngkatLama : null,
        standMeterBaru: kondisiEfektif === "MB" ? body.standMeterBaru : null,
        pemakaianTagihVerif: body.pemakaianTagih,
        // undefined = kondisi tidak dikoreksi, nilai lama dipertahankan.
        kondisi: body.kondisi,
        // ?? null (bukan undefined): tanpa catatan baru, catatan penolakan
        // lama ikut terhapus — bukan menempel di laporan yang sudah lolos V1.
        catatanVerif: body.catatanVerif ?? null,
        // Laporan DITOLAK boleh diverifikasi ulang bila ternyata benar —
        // V1 baru menghapus jejak penolakan (penanda status DITOLAK adalah
        // verifiedAt terisi tanpa isVerified).
        verifiedAt: null,
        verifiedById: null,
      },
      include: { verif1By: { select: { id: true, name: true } } },
    })
    return ok(c, row)
  }
)

/// V2 & V3 BOLEH MENGOREKSI, bukan sekadar menandatangani.
///
/// Versi pertama hanya menerima catatan di kedua ring ini, dan akibatnya
/// janggal: kalau supervisor salah memasukkan angka di V1, manager dan
/// senior manager cuma punya dua pilihan — meloloskan yang salah, atau
/// menolak seluruh laporan sehingga PETUGAS yang disuruh mengulang padahal
/// kesalahannya bukan di dia. Wewenang yang lebih tinggi tapi kemampuan
/// yang lebih rendah tidak masuk akal.
///
/// Semua kolom koreksi bersifat OPSIONAL: mengirim body kosong = "saya
/// setuju apa adanya", persis perilaku lama. Yang dikirim akan menimpa
/// nilai V1, dan siapa yang terakhir mengubah tetap terbaca dari ring yang
/// mengisinya.
const catatanSchema = z.object({
  catatanVerif: z.string().trim().max(500).nullable().optional(),
  /// Koreksi yang sama persis yang tersedia di V1.
  meterId: z.string().min(1).optional(),
  blokTarif: z.coerce.number().int().min(1).max(4).optional(),
  standAkhirRevisi: z.coerce.number().int().min(0).nullable().optional(),
  standAngkatLama: z.coerce.number().int().min(0).nullable().optional(),
  standMeterBaru: z.coerce.number().int().min(0).nullable().optional(),
  pemakaianTagih: z.coerce.number().int().min(0).nullable().optional(),
  kondisi: z.enum(KondisiCatat).optional(),
})

/// Menerjemahkan koreksi opsional jadi potongan `data` Prisma. Kolom yang
/// TIDAK dikirim sengaja tidak masuk objek sama sekali — bukan diisi null —
/// supaya "tidak menyebut" tidak pernah berarti "kosongkan".
function koreksiDari(
  body: z.infer<typeof catatanSchema>
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (body.meterId !== undefined) data.meterVerifId = body.meterId
  if (body.blokTarif !== undefined) data.blokTarifVerif = body.blokTarif
  if (body.standAkhirRevisi !== undefined)
    data.standAkhirRevisi = body.standAkhirRevisi
  if (body.standAngkatLama !== undefined)
    data.standAngkatLama = body.standAngkatLama
  if (body.standMeterBaru !== undefined)
    data.standMeterBaru = body.standMeterBaru
  if (body.pemakaianTagih !== undefined)
    data.pemakaianTagihVerif = body.pemakaianTagih
  if (body.kondisi !== undefined) data.kondisi = body.kondisi
  return data
}

laporanHarianRouter.patch(
  "/:id/verif2",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  validate("json", catatanSchema),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const laporan = await prisma.laporanHarianPetugas.findUnique({
      where: { id },
    })
    if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
    if (laporan.pembacaanId)
      throw new ConflictError("Laporan sudah menjadi pembacaan resmi")
    if (laporan.verif2At)
      throw new ConflictError(
        "V2 sudah diisi — batalkan dulu bila perlu mengulang"
      )

    const body = c.req.valid("json")
    if (body.pemakaianTagih !== undefined) {
      pastikanV3UntukTagihan(requester.role, 2)
    }
    const kondisiEfektif = body.kondisi ?? laporan.kondisi
    const standAngkatLama =
      body.standAngkatLama !== undefined
        ? body.standAngkatLama
        : laporan.standAngkatLama
    const standMeterBaru =
      body.standMeterBaru !== undefined
        ? body.standMeterBaru
        : laporan.standMeterBaru
    validasiStandAngkat(kondisiEfektif, standAngkatLama, standMeterBaru)
    if (kondisiEfektif === "MB")
      await validasiMeterBaru(
        laporan.pelangganId,
        body.meterId ?? laporan.meterVerifId
      )
    const row = await prisma.laporanHarianPetugas.update({
      where: { id },
      data: {
        verif2At: new Date(),
        verif2ById: requester.id,
        ...(body.catatanVerif !== undefined
          ? { catatanVerif: body.catatanVerif }
          : {}),
        ...koreksiDari(body),
      },
    })
    return ok(c, row)
  }
)

/// V3 = final approval: satu-satunya tempat PembacaanMeter resmi dibuat.
/// Stand resmi = standAkhirRevisi (bila V1 mengoreksi) atau standAkhir catat.
///
/// M³ resmi ditetapkan V3: formulir mengusulkan selisih matematis (termasuk
/// rumus gabungan untuk MB), lalu V3 dapat mengubahnya sesuai kebijakan.
/// Baris lama yang belum memiliki nilai verifikasi mempertahankan pemakaian
/// impor. Pemakaian riil selalu dihitung terpisah dan koreksi manual dicatat.
laporanHarianRouter.patch(
  "/:id/verif3",
  requireRole(...ROLE_GROUPS.SENIOR_UP),
  validate("json", catatanSchema),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const body = c.req.valid("json")
    const laporan = await prisma.laporanHarianPetugas.findUnique({
      where: { id },
    })
    if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
    if (laporan.pembacaanId)
      throw new ConflictError("Laporan sudah menjadi pembacaan resmi")
    // Koreksi yang dikirim BERSAMA V3 berlaku untuk pembacaan yang terbit di
    // transaksi ini juga — bukan cuma tersimpan di laporan. Kalau tidak,
    // senior manager akan melihat angka yang ia perbaiki tetap terbit salah.
    const koreksi = koreksiDari(body)
    const meterVerifId =
      (koreksi.meterVerifId as string | undefined) ?? laporan.meterVerifId
    if (!meterVerifId)
      throw new BadRequestError("Meter tujuan belum dipilih di V1")

    const standAwal =
      (koreksi.standAwalRevisi as number | null | undefined) ??
      laporan.standAwalRevisi ??
      laporan.standAwal
    const standAkhir =
      (koreksi.standAkhirRevisi as number | null | undefined) ??
      laporan.standAkhirRevisi ??
      laporan.standAkhir
    const kondisiEfektif =
      (koreksi.kondisi as typeof laporan.kondisi | undefined) ?? laporan.kondisi
    const standAngkatLama =
      (koreksi.standAngkatLama as number | null | undefined) ??
      laporan.standAngkatLama
    const standMeterBaru =
      (koreksi.standMeterBaru as number | null | undefined) ??
      laporan.standMeterBaru
    const dataStandAngkat = validasiStandAngkat(
      kondisiEfektif,
      standAngkatLama,
      standMeterBaru
    )
    if (kondisiEfektif === "MB")
      await validasiMeterBaru(laporan.pelangganId, meterVerifId)
    const pemakaianTagihVerif =
      (koreksi.pemakaianTagih as number | null | undefined) ??
      laporan.pemakaianTagihVerif
    const pemakaianRiil = dataStandAngkat
      ? hitungPemakaianGantiMeter({
          standAwalLama: standAwal,
          standAngkatLama: dataStandAngkat.standAngkatLama,
          standMeterBaru: dataStandAngkat.standMeterBaru,
        })
      : standAkhir - standAwal
    if (pemakaianRiil < 0)
      throw new BadRequestError(
        "Pemakaian hasil stand negatif. Koreksi dan tinjau datanya sebelum pengesahan V3."
      )

    // TIDAK ADA TAKSASI OTOMATIS.
    //
    // Aturan taksiran (minimum 5 m3, taksiran dari bulan lalu) DIHAPUS dari
    // jalur otomatis atas keputusan pemilik data. Alasannya: angka yang
    // dibawa lapdatameter & ProgresCater sudah matang — ia keluaran
    // verifikasi berjenjang di Aurora — sehingga menaksirnya ulang berarti
    // menimpa keputusan manusia dengan tebakan mesin.
    //
    // Aturan sistem tetap ada, tapi nilai Tagihan hanya ditetapkan V3
    // melalui kolom pemakaianTagihVerif. Dengan begitu setiap penyimpangan
    // dari angka catat
    // selalu punya nama orang di belakangnya dan bisa ditelusuri.
    // OVERRIDE_MANUAL HANYA bila operator yang menetapkannya — lihat catatan
    // yang sama di verif-massal.ts.
    const pemakaianTagih =
      pemakaianTagihVerif ??
      (kondisiEfektif === "MB" ? pemakaianRiil : laporan.pemakaian)
    const alasanTaksir =
      laporan.jenisInput === "MANUAL_MASSAL" &&
      pemakaianTagih === laporan.pemakaian
        ? "MANUAL_ADD"
        : pemakaianTagihVerif != null && pemakaianTagihVerif !== pemakaianRiil
          ? "OVERRIDE_MANUAL"
          : null

    const kini = new Date()

    const row = await prisma.$transaction(async (tx) => {
      const pembacaan = await simpanPembacaanResmi(tx, {
        pelangganId: laporan.pelangganId,
        nomorLangganan: laporan.nomorLangganan,
        meterId: meterVerifId,
        periode: laporan.periode,
        sumber: "PETUGAS",
        laporanId: laporan.id,
        aktor: {
          userId: requester.id,
          ...auditMetaFromRequest(c.req.raw),
        },
        data: {
          ...(meterVerifId ? { meterId: meterVerifId } : {}),
          standLalu: laporan.standAwalRevisi ?? laporan.standAwal,
          standAkhir,
          pemakaianM3: pemakaianTagih,
          pemakaianRiil,
          alasanTaksir,
          blokTarif:
            (koreksi.blokTarifVerif as number | undefined) ??
            laporan.blokTarifVerif ??
            tentukanBlok(pemakaianTagih),
          pemakaianLalu: laporan.pemakaianLalu,
          kondisi: kondisiEfektif,
          kategori: laporan.kategori,
          pencatatId: laporan.pencatatId,
          tanggalCatat: laporan.tanggalCatat,
          // Foto stand ikut ke pembacaan resmi (cermin alur laporan mandiri
          // yang menyalin fotoUrl pelapor).
          fotoBukti: laporan.fotoStandUrl,
        },
      })
      // TUTUP LINGKARNYA: baris daftar catat ditandai DICATAT begitu pembacaan
      // resminya lahir. Tanpa ini statusnya membeku di nilai saat baris dibuat,
      // dan layar closing selamanya melaporkan "belum menghasilkan pembacaan"
      // untuk sambungan yang JUSTRU sudah dibaca — karena tidak ada satu pun
      // jalur yang memperbaruinya.
      //
      // updateMany (bukan update): baris DPM bisa saja tidak ada — mis. laporan
      // susulan atas sambungan yang belum masuk daftar kerja periode itu — dan
      // itu bukan alasan menggagalkan penerbitan pembacaan.
      if (laporan.pelangganId) {
        await tx.daftarCatat.updateMany({
          where: { periode: laporan.periode, pelangganId: laporan.pelangganId },
          data: { status: "DICATAT", selesaiAt: kini },
        })
      }

      return tx.laporanHarianPetugas.update({
        where: { id },
        data: {
          verif3At: kini,
          verif3ById: requester.id,
          // Koreksi ikut TERSIMPAN di laporan, bukan cuma dipakai sekali —
          // supaya jejaknya bisa ditelusuri dan angka di layar sama dengan
          // angka yang terbit.
          ...koreksi,
          ...(body.catatanVerif !== undefined
            ? { catatanVerif: body.catatanVerif }
            : {}),
          // Penanda final legacy tetap diisi supaya filter statusVerif,
          // stats, dan konsumen lama (mobile) membaca status yang sama.
          isVerified: true,
          verifiedAt: kini,
          verifiedById: requester.id,
          pembacaanId: pembacaan.id,
        },
        include: { pembacaan: true },
      })
    })
    return ok(c, row)
  }
)

/// Verifikasi satu klik: akun menandai tahap miliknya dengan data yang sudah
/// tersimpan. Koreksi data dilakukan lewat endpoint /koreksi, bukan di sini.
laporanHarianRouter.patch(
  "/:id/verifikasi-langsung",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const ring = (ROLE_GROUPS.SENIOR_UP as readonly string[]).includes(
      requester.role
    )
      ? 3
      : (ROLE_GROUPS.MANAGEMENT_UP as readonly string[]).includes(
            requester.role
          )
        ? 2
        : 1
    const laporan = await prisma.laporanHarianPetugas.findUnique({
      where: { id },
    })
    if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
    if (laporan.pembacaanId || laporan.isVerified)
      throw new ConflictError("Laporan sudah menjadi pembacaan resmi")

    const kini = new Date()
    const auditMeta = auditMetaFromRequest(c.req.raw)
    if (ring === 1) {
      if (laporan.verif1At)
        throw new ConflictError("Tahap V1 sudah ditandai diverifikasi")
      if (laporan.verif2At || laporan.verif3At)
        throw new ConflictError(
          "V1 tidak dapat diulang setelah tahap berikutnya diverifikasi"
        )
      if (!laporan.pelangganId)
        throw new BadRequestError(
          "Alamat belum tertaut ke data pelanggan; koreksi data pelanggan sebelum verifikasi."
        )
      const meterId = laporan.meterVerifId
        ? (
            await prisma.meter.findFirst({
              where: {
                id: laporan.meterVerifId,
                pelangganId: laporan.pelangganId,
              },
              select: { id: true },
            })
          )?.id
        : (
              await prisma.meter.findMany({
                where: { pelangganId: laporan.pelangganId, isAktif: true },
                select: { id: true },
                take: 2,
              })
            ).length === 1
          ? (
              await prisma.meter.findFirst({
                where: { pelangganId: laporan.pelangganId, isAktif: true },
                select: { id: true },
              })
            )?.id
          : null
      if (!meterId)
        throw new BadRequestError(
          "Meter aktif tidak dapat ditentukan dengan pasti. Lengkapi pilihan meter lewat Edit sebelum verifikasi."
        )

      const row = await prisma.$transaction(async (tx) => {
        const berubah = await tx.laporanHarianPetugas.updateMany({
          where: {
            id,
            verif1At: null,
            verif2At: null,
            verif3At: null,
            pembacaanId: null,
            isVerified: false,
          },
          data: {
            verif1At: kini,
            verif1ById: requester.id,
            meterVerifId: meterId,
            verifiedAt: null,
            verifiedById: null,
          },
        })
        if (berubah.count !== 1)
          throw new ConflictError(
            "Status laporan berubah. Muat ulang sebelum mencoba lagi."
          )
        await recordAudit(tx, {
          userId: requester.id,
          aksi: "VERIFIKASI_V1_LANGSUNG",
          entitas: "LaporanHarianPetugas",
          entitasId: id,
          perubahan: {
            sebelum: {
              verif1At: laporan.verif1At,
              verif1ById: laporan.verif1ById,
            },
            sesudah: {
              verif1At: kini,
              verif1ById: requester.id,
              meterVerifId: meterId,
            },
          },
          ...auditMeta,
        })
        return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
      })
      return ok(c, { ring, laporan: row })
    }

    if (ring === 2) {
      if (laporan.verif2At)
        throw new ConflictError("Tahap V2 sudah ditandai diverifikasi")
      if (laporan.verif3At)
        throw new ConflictError(
          "V2 tidak dapat diulang setelah tahap V3 diverifikasi"
        )
      const row = await prisma.$transaction(async (tx) => {
        const berubah = await tx.laporanHarianPetugas.updateMany({
          where: {
            id,
            verif2At: null,
            verif3At: null,
            pembacaanId: null,
            isVerified: false,
          },
          data: { verif2At: kini, verif2ById: requester.id },
        })
        if (berubah.count !== 1)
          throw new ConflictError(
            "Status laporan berubah. Muat ulang sebelum mencoba lagi."
          )
        await recordAudit(tx, {
          userId: requester.id,
          aksi: "VERIFIKASI_V2_LANGSUNG",
          entitas: "LaporanHarianPetugas",
          entitasId: id,
          perubahan: {
            sebelum: {
              verif2At: laporan.verif2At,
              verif2ById: laporan.verif2ById,
            },
            sesudah: { verif2At: kini, verif2ById: requester.id },
          },
          ...auditMeta,
        })
        return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
      })
      return ok(c, { ring, laporan: row })
    }

    if (laporan.verif3At)
      throw new ConflictError("Tahap V3 sudah ditandai diverifikasi")
    if (!laporan.pelangganId)
      throw new BadRequestError(
        "Alamat belum tertaut ke data pelanggan; koreksi data pelanggan sebelum pengesahan V3."
      )
    const meter = laporan.meterVerifId
      ? await prisma.meter.findFirst({
          where: {
            id: laporan.meterVerifId,
            pelangganId: laporan.pelangganId,
          },
        })
      : await (async () => {
          const aktif = await prisma.meter.findMany({
            where: { pelangganId: laporan.pelangganId!, isAktif: true },
            take: 2,
          })
          return aktif.length === 1 ? (aktif[0] ?? null) : null
        })()
    if (!meter)
      throw new BadRequestError(
        "Meter aktif tidak dapat ditentukan dengan pasti. Lengkapi pilihan meter lewat Edit sebelum pengesahan V3."
      )

    const kondisi = laporan.kondisiRevisi ?? laporan.kondisi
    const standAwal = laporan.standAwalRevisi ?? laporan.standAwal
    const standAkhir = laporan.standAkhirRevisi ?? laporan.standAkhir
    let pemakaianRiil: number
    let standLalu = standAwal
    if (kondisi === "MB") {
      const dataStandAngkat = validasiStandAngkat(
        kondisi,
        laporan.standAngkatLama,
        laporan.standMeterBaru
      )
      pemakaianRiil = hitungPemakaianGantiMeter({
        standAwalLama: standAwal,
        standAngkatLama: dataStandAngkat!.standAngkatLama,
        standMeterBaru: dataStandAngkat!.standMeterBaru,
      })
      standLalu = standAwal
    } else {
      pemakaianRiil = standAkhir - standAwal
    }
    if (pemakaianRiil < 0)
      throw new BadRequestError(
        "Pemakaian hasil stand negatif. Koreksi dan tinjau datanya sebelum pengesahan V3."
      )
    const pemakaianTagih =
      laporan.pemakaianTagihVerif ??
      (kondisi === "MB" ? pemakaianRiil : laporan.pemakaian)
    if (pemakaianTagih < 0)
      throw new BadRequestError(
        "Pemakaian tagih bernilai negatif dan harus ditinjau sebelum pengesahan V3."
      )

    const hasil = await prisma.$transaction(async (tx) => {
      const berubah = await tx.laporanHarianPetugas.updateMany({
        where: {
          id,
          verif3At: null,
          pembacaanId: null,
          isVerified: false,
        },
        data: { verif3At: kini, verif3ById: requester.id },
      })
      if (berubah.count !== 1)
        throw new ConflictError(
          "Status laporan berubah. Muat ulang sebelum mencoba lagi."
        )

      const pembacaan = await simpanPembacaanResmi(tx, {
        pelangganId: laporan.pelangganId,
        nomorLangganan: laporan.nomorLangganan,
        meterId: meter.id,
        periode: laporan.periode,
        sumber: "PETUGAS",
        laporanId: id,
        aktor: {
          userId: requester.id,
          ...auditMetaFromRequest(c.req.raw),
        },
        data: {
          standLalu,
          standAkhir,
          pemakaianM3: pemakaianTagih,
          pemakaianRiil,
          alasanTaksir:
            laporan.jenisInput === "MANUAL_MASSAL" &&
            pemakaianTagih === laporan.pemakaian
              ? "MANUAL_ADD"
              : laporan.pemakaianTagihVerif != null &&
                  laporan.pemakaianTagihVerif !== pemakaianRiil
                ? "OVERRIDE_MANUAL"
                : null,
          blokTarif: laporan.blokTarifVerif ?? tentukanBlok(pemakaianTagih),
          pemakaianLalu: laporan.pemakaianLalu,
          kondisi,
          kategori: laporan.kategori,
          pencatatId: laporan.pencatatId,
          tanggalCatat: laporan.tanggalCatat,
          fotoBukti: laporan.fotoStandUrl,
        },
      })
      if (laporan.pelangganId) {
        await tx.daftarCatat.updateMany({
          where: { periode: laporan.periode, pelangganId: laporan.pelangganId },
          data: { status: "DICATAT", selesaiAt: kini },
        })
      }
      const row = await tx.laporanHarianPetugas.update({
        where: { id },
        data: {
          isVerified: true,
          verifiedAt: kini,
          verifiedById: requester.id,
          pembacaanId: pembacaan.id,
        },
        include: { pembacaan: true },
      })
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "VERIFIKASI_V3_LANGSUNG",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          sebelum: {
            verif3At: laporan.verif3At,
            pembacaanId: laporan.pembacaanId,
          },
          sesudah: { verif3At: kini, pembacaanId: pembacaan.id },
        },
        ...auditMeta,
      })
      return row
    })
    return ok(c, { ring, laporan: hasil })
  }
)

const koreksiLaporanSchema = z.object({
  standAwalRevisi: z.coerce.number().int().min(0).nullable().optional(),
  standAkhirRevisi: z.coerce.number().int().min(0).nullable().optional(),
  pemakaianTagihVerif: z.coerce.number().int().min(0).nullable().optional(),
  kondisiRevisi: z.enum(KondisiCatat).nullable().optional(),
  standAngkatLama: z.coerce.number().int().min(0).nullable().optional(),
  standMeterBaru: z.coerce.number().int().min(0).nullable().optional(),
  meterVerifId: z.string().nullable().optional(),
})

laporanHarianRouter.patch(
  "/:id/koreksi",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", koreksiLaporanSchema),
  async (c) => {
    const id = c.req.param("id")
    const body = c.req.valid("json")
    const requester = getSessionUser(c)
    const laporan = await prisma.laporanHarianPetugas.findUnique({
      where: { id },
    })
    if (!laporan) throw new NotFoundError("LaporanHarianPetugas")

    const staff = requester.role === "STAFF"
    const bolehSenior = (ROLE_GROUPS.SENIOR_UP as readonly string[]).includes(
      requester.role
    )
    const bolehManajemen = (
      ROLE_GROUPS.MANAGEMENT_UP as readonly string[]
    ).includes(requester.role)
    const bolehSupervisor = (
      ROLE_GROUPS.SUPERVISOR_UP as readonly string[]
    ).includes(requester.role)
    if (body.pemakaianTagihVerif !== undefined) {
      pastikanV3UntukTagihan(requester.role)
    }
    const koreksiDiizinkan =
      staff ||
      (laporan.verif3At || laporan.pembacaanId
        ? bolehSenior
        : laporan.verif2At
          ? bolehSenior
          : laporan.verif1At
            ? bolehManajemen
            : bolehSupervisor)
    if (!koreksiDiizinkan)
      throw new ForbiddenError(
        "Role Anda tidak berwenang mengoreksi tahap laporan ini."
      )

    if (laporan.pembacaanId) {
      const tagihan = await prisma.tagihan.findUnique({
        where: { pembacaanId: laporan.pembacaanId },
        select: { id: true },
      })
      if (tagihan)
        throw new ConflictError(
          "Pembacaan ini sudah digunakan tagihan; koreksi biasa ditolak."
        )
    }
    const periode = await prisma.periodePenagihan.findUnique({
      where: { periode: laporan.periode },
      select: { status: true },
    })
    if (periode?.status === "TERKUNCI")
      throw new ConflictError(
        "Periode sudah ditutup; laporan tidak dapat dikoreksi."
      )

    const kondisiRevisi =
      body.kondisiRevisi !== undefined
        ? body.kondisiRevisi
        : laporan.kondisiRevisi
    const kondisiEfektif = kondisiRevisi ?? laporan.kondisi
    const standAwalRevisi =
      body.standAwalRevisi !== undefined
        ? body.standAwalRevisi
        : laporan.standAwalRevisi
    if (kondisiEfektif === "REV_PENCATAT" && standAwalRevisi == null)
      throw new BadRequestError(
        "Kondisi Revisi Pencatat memerlukan nilai ST Awal revisi."
      )
    if (kondisiEfektif !== "REV_PENCATAT" && standAwalRevisi != null)
      throw new BadRequestError(
        "ST Awal revisi hanya boleh diisi untuk kondisi Revisi Pencatat."
      )

    const standAkhirRevisi =
      body.standAkhirRevisi !== undefined
        ? body.standAkhirRevisi
        : laporan.standAkhirRevisi
    const pemakaianTagihVerif =
      body.pemakaianTagihVerif !== undefined
        ? body.pemakaianTagihVerif
        : laporan.pemakaianTagihVerif
    const standAngkatLama =
      body.standAngkatLama !== undefined
        ? body.standAngkatLama
        : laporan.standAngkatLama
    const standMeterBaru =
      body.standMeterBaru !== undefined
        ? body.standMeterBaru
        : laporan.standMeterBaru
    const meterVerifId =
      body.meterVerifId !== undefined ? body.meterVerifId : laporan.meterVerifId
    if (meterVerifId) {
      if (!laporan.pelangganId)
        throw new BadRequestError(
          "Pelanggan laporan belum tertaut; meter tujuan tidak dapat divalidasi."
        )
      const meter = await prisma.meter.findFirst({
        where: {
          id: meterVerifId,
          pelangganId: laporan.pelangganId,
        },
        select: { id: true },
      })
      if (!meter)
        throw new BadRequestError(
          "Meter tujuan bukan milik pelanggan laporan ini."
        )
    }
    if (kondisiEfektif === "MB") {
      validasiStandAngkat(kondisiEfektif, standAngkatLama, standMeterBaru)
      await validasiMeterBaru(laporan.pelangganId, meterVerifId)
    }
    if (laporan.pembacaanId && !meterVerifId)
      throw new BadRequestError(
        "Pembacaan resmi harus tetap terhubung ke meter pelanggan."
      )

    const standAwalAktif = standAwalRevisi ?? laporan.standAwal
    const standAkhirAktif = standAkhirRevisi ?? laporan.standAkhir
    const pemakaianRiil =
      kondisiEfektif === "MB"
        ? hitungPemakaianGantiMeter({
            standAwalLama: standAwalAktif,
            standAngkatLama: standAngkatLama!,
            standMeterBaru: standMeterBaru!,
          })
        : standAkhirAktif - standAwalAktif
    if (pemakaianRiil < 0)
      throw new BadRequestError(
        "Pemakaian hasil koreksi negatif. Periksa kembali stand dan kondisi meter."
      )
    const perubahan = {
      standAwalRevisi,
      standAkhirRevisi,
      pemakaianTagihVerif,
      kondisiRevisi,
      standAngkatLama,
      standMeterBaru,
      meterVerifId,
    }
    const dataLaporan = {
      standAwalRevisi,
      standAkhirRevisi,
      pemakaianTagihVerif,
      kondisiRevisi,
      standAngkatLama,
      standMeterBaru,
      meterVerifId,
      ...(kondisiEfektif === "REV_PENCATAT"
        ? { pemakaian: pemakaianRiil }
        : {}),
    }
    const hasil = await prisma.$transaction(async (tx) => {
      const row = await tx.laporanHarianPetugas.update({
        where: { id },
        data: dataLaporan,
      })
      if (laporan.pembacaanId) {
        const pakaiTagih = pemakaianTagihVerif ?? laporan.pemakaian
        await tx.pembacaanMeter.update({
          where: { id: laporan.pembacaanId },
          data: {
            standLalu: standAwalAktif,
            standAkhir: standAkhirAktif,
            pemakaianM3: pakaiTagih,
            pemakaianRiil,
            alasanTaksir:
              laporan.jenisInput === "MANUAL_MASSAL" &&
              pakaiTagih === laporan.pemakaian
                ? "MANUAL_ADD"
                : pemakaianTagihVerif != null &&
                    pemakaianTagihVerif !== pemakaianRiil
                  ? "OVERRIDE_MANUAL"
                  : null,
            kondisi: kondisiEfektif,
          },
        })
      }
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "KOREKSI_LAPORAN_PETUGAS",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          sebelum: {
            standAwalRevisi: laporan.standAwalRevisi,
            standAkhirRevisi: laporan.standAkhirRevisi,
            pemakaianTagihVerif: laporan.pemakaianTagihVerif,
            kondisiRevisi: laporan.kondisiRevisi,
            standAngkatLama: laporan.standAngkatLama,
            standMeterBaru: laporan.standMeterBaru,
            meterVerifId: laporan.meterVerifId,
          },
          sesudah: perubahan,
          pemakaianRiil,
        },
        ...auditMetaFromRequest(c.req.raw),
      })
      return row
    })
    return ok(c, hasil)
  }
)

const penilaianFotoSchema = z
  .object({
    sesuai: z.boolean(),
    keterangan: z.string().trim().max(500).default(""),
  })
  .refine(
    (nilai) => nilai.sesuai || nilai.keterangan.length >= 5,
    "Keterangan minimal 5 karakter wajib diisi jika kondisi foto tidak sesuai."
  )

laporanHarianRouter.post(
  "/:id/kondisi-foto",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", penilaianFotoSchema),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const { sesuai, keterangan } = c.req.valid("json")
    const hasil = await prisma.$transaction(async (tx) => {
      const laporan = await tx.laporanHarianPetugas.findUnique({
        where: { id },
        select: {
          id: true,
          nomorLangganan: true,
          periode: true,
        },
      })
      if (!laporan) throw new NotFoundError("LaporanHarianPetugas")

      await recordAudit(tx, {
        userId: requester.id,
        aksi: "PENILAIAN_KONDISI_FOTO_LAPORAN_PETUGAS",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          sesuai,
          keterangan,
          nomorLangganan: laporan.nomorLangganan,
          periode: laporan.periode,
        },
        ...auditMetaFromRequest(c.req.raw),
      })

      return { id, sesuai, keterangan }
    })
    return created(c, hasil)
  }
)

// ── Verifikasi massal (V1/V2/V3 untuk banyak baris sekaligus) ────────────
//
// Wewenangnya MENGIKUTI RING, bukan diseragamkan: V1 supervisor ke atas,
// V2 manajemen ke atas, V3 senior ke atas — sama persis dengan endpoint
// satuannya. Borongan tidak boleh jadi pintu belakang yang lebih longgar.
const verifMassalSchema = z.object({
  ring: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  ids: z.array(z.string().min(1)).min(1).max(500),
  /// Bawaannya false: baris anomali dilewati & dilaporkan, tidak diloloskan
  /// diam-diam. Pemanggil harus menyatakan niatnya secara eksplisit.
  sertakanAnomali: z.boolean().optional(),
})

const RING_ROLE = {
  1: ROLE_GROUPS.SUPERVISOR_UP,
  2: ROLE_GROUPS.MANAGEMENT_UP,
  3: ROLE_GROUPS.SENIOR_UP,
} as const

laporanHarianRouter.post(
  "/verif-massal",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", verifMassalSchema),
  async (c) => {
    const { ring, ids, sertakanAnomali } = c.req.valid("json")
    const requester = getSessionUser(c)
    // Penjagaan ring KEDUA, setelah penjagaan kasar di middleware: middleware
    // hanya bisa memeriksa satu daftar role, sedangkan ring-nya baru diketahui
    // dari body.
    if (!(RING_ROLE[ring] as readonly string[]).includes(requester.role)) {
      throw new ForbiddenError(
        `Verifikasi V${ring} memerlukan salah satu role: ${RING_ROLE[ring].join(", ")}`
      )
    }

    const konf = await prisma.konfigurasi.findUnique({
      where: { kunci: "AMBANG_ANOMALI_PERSEN" },
    })
    const ambangAnomali = Number.parseInt(konf?.nilai ?? "", 10) || 50

    const hasil = await verifikasiMassal({
      ids,
      ring,
      userId: requester.id,
      auditMeta: auditMetaFromRequest(c.req.raw),
      ambangAnomali,
      sertakanAnomali: sertakanAnomali ?? false,
    })
    return ok(c, hasil)
  }
)

const rejectSchema = z.object({
  catatanVerif: z.string().trim().min(1).max(500),
})

/// "Baca ulang": kembalikan laporan nonfinal ke petugas. Ring dan koreksi
/// periode aktif direset dalam transaksi; nilai sebelumnya dan alasan tetap
/// tersimpan pada audit agar pengiriman ulang tidak menghapus histori.
laporanHarianRouter.patch(
  "/:id/reject",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", rejectSchema),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const laporan = await prisma.laporanHarianPetugas.findUnique({
      where: { id },
    })
    if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
    if (laporan.pembacaanId || laporan.isVerified || laporan.verif3At)
      throw new ConflictError(
        "Laporan sudah mencapai tahap final; gunakan alur pembatalan V3 yang sesuai."
      )

    const alasan = c.req.valid("json").catatanVerif
    const kini = new Date()
    const row = await prisma.$transaction(async (tx) => {
      const berubah = await tx.laporanHarianPetugas.updateMany({
        where: {
          id,
          isVerified: false,
          verifiedAt: null,
          pembacaanId: null,
          verif3At: null,
          verif1At: laporan.verif1At,
          verif2At: laporan.verif2At,
          standAwalRevisi: laporan.standAwalRevisi,
          standAkhirRevisi: laporan.standAkhirRevisi,
          kondisiRevisi: laporan.kondisiRevisi,
          standAngkatLama: laporan.standAngkatLama,
          standMeterBaru: laporan.standMeterBaru,
          pemakaianTagihVerif: laporan.pemakaianTagihVerif,
          meterVerifId: laporan.meterVerifId,
          blokTarifVerif: laporan.blokTarifVerif,
        },
        data: {
          isVerified: false,
          verifiedAt: kini,
          verifiedById: requester.id,
          catatanVerif: alasan,
          verif1At: null,
          verif1ById: null,
          verif2At: null,
          verif2ById: null,
          verif3At: null,
          verif3ById: null,
          standAwalRevisi: null,
          standAkhirRevisi: null,
          kondisiRevisi: null,
          standAngkatLama: null,
          standMeterBaru: null,
          pemakaianTagihVerif: null,
          meterVerifId: null,
          blokTarifVerif: null,
        },
      })
      if (berubah.count !== 1)
        throw new ConflictError(
          "Status laporan berubah. Muat ulang sebelum mengirim baca ulang."
        )

      await recordAudit(tx, {
        userId: requester.id,
        aksi: "KIRIM_BACA_ULANG_LAPORAN_PETUGAS",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          alasan,
          sebelum: {
            catatanVerif: laporan.catatanVerif,
            verifiedAt: laporan.verifiedAt,
            verifiedById: laporan.verifiedById,
            verif1At: laporan.verif1At,
            verif1ById: laporan.verif1ById,
            verif2At: laporan.verif2At,
            verif2ById: laporan.verif2ById,
            verif3At: laporan.verif3At,
            verif3ById: laporan.verif3ById,
            standAwalRevisi: laporan.standAwalRevisi,
            standAkhirRevisi: laporan.standAkhirRevisi,
            kondisiRevisi: laporan.kondisiRevisi,
            standAngkatLama: laporan.standAngkatLama,
            standMeterBaru: laporan.standMeterBaru,
            pemakaianTagihVerif: laporan.pemakaianTagihVerif,
            meterVerifId: laporan.meterVerifId,
            blokTarifVerif: laporan.blokTarifVerif,
          },
          sesudah: {
            status: "DITOLAK",
            verifiedAt: kini,
            verifiedById: requester.id,
            catatanVerif: alasan,
            verif1At: null,
            verif2At: null,
            verif3At: null,
            koreksiDireset: true,
          },
        },
        ...auditMetaFromRequest(c.req.raw),
      })

      return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
    })
    return ok(c, row)
  }
)

/// "Unverifikasi": membatalkan SATU tahap terakhir (V3 → V2 → V1 → kosong;
/// baris DITOLAK kembali ke MENUNGGU). Role minimal mengikuti ring yang
/// dibatalkan. Pembatalan V3 menghapus PembacaanMeter resmi — ditolak bila
/// pembacaan sudah dipakai Tagihan (angka penagihan tidak boleh berubah
/// diam-diam).
laporanHarianRouter.patch(
  "/:id/unverify",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  async (c) => {
    const id = c.req.param("id")
    const requester = getSessionUser(c)
    const laporan = await prisma.laporanHarianPetugas.findUnique({
      where: { id },
    })
    if (!laporan) throw new NotFoundError("LaporanHarianPetugas")

    const bolehSenior = (ROLE_GROUPS.SENIOR_UP as readonly string[]).includes(
      requester.role
    )
    const bolehManajemen = (
      ROLE_GROUPS.MANAGEMENT_UP as readonly string[]
    ).includes(requester.role)

    if (laporan.pembacaanId) {
      if (!bolehSenior)
        throw new ForbiddenError(
          "Membatalkan approve final (V3) memerlukan Senior Manager ke atas"
        )
      const tagihan = await prisma.tagihan.findUnique({
        where: { pembacaanId: laporan.pembacaanId },
      })
      if (tagihan)
        throw new ConflictError(
          "Pembacaan resmi laporan ini sudah dipakai tagihan — tidak bisa dibatalkan"
        )

      const pembacaanId = laporan.pembacaanId
      const row = await prisma.$transaction(async (tx) => {
        const diperbarui = await tx.laporanHarianPetugas.update({
          where: { id },
          data: {
            verif3At: null,
            verif3ById: null,
            isVerified: false,
            verifiedAt: null,
            verifiedById: null,
            pembacaanId: null,
          },
        })
        await tx.pembacaanMeter.delete({ where: { id: pembacaanId } })
        return diperbarui
      })
      return ok(c, row)
    }

    if (laporan.isVerified) {
      if (!bolehSenior)
        throw new ForbiddenError(
          "Membatalkan approve final (V3) memerlukan Senior Manager ke atas"
        )
      return ok(
        c,
        await prisma.laporanHarianPetugas.update({
          where: { id },
          data: {
            verif3At: null,
            verif3ById: null,
            isVerified: false,
            verifiedAt: null,
            verifiedById: null,
          },
        })
      )
    }

    if (laporan.verif2At) {
      if (!bolehManajemen)
        throw new ForbiddenError("Membatalkan V2 memerlukan Manager ke atas")
      return ok(
        c,
        await prisma.laporanHarianPetugas.update({
          where: { id },
          data: { verif2At: null, verif2ById: null },
        })
      )
    }

    if (laporan.verif1At) {
      return ok(
        c,
        await prisma.laporanHarianPetugas.update({
          where: { id },
          data: {
            verif1At: null,
            verif1ById: null,
            standAwalRevisi: null,
            standAkhirRevisi: null,
            kondisiRevisi: null,
            standAngkatLama: null,
            standMeterBaru: null,
            pemakaianTagihVerif: null,
            meterVerifId: null,
            blokTarifVerif: null,
          },
        })
      )
    }

    if (laporan.verifiedAt) {
      // Baris DITOLAK (cek ulang) — kembalikan ke MENUNGGU.
      return ok(
        c,
        await prisma.laporanHarianPetugas.update({
          where: { id },
          data: { verifiedAt: null, verifiedById: null, catatanVerif: null },
        })
      )
    }

    throw new BadRequestError("Belum ada tahap verifikasi yang bisa dibatalkan")
  }
)
