// server/modules/anomali/anomali.router.ts — API modul anomali.
//
// DUA JENIS PEMAKAI, SATU DAFTAR:
//   - staf kantor (STAFF_UP) memantau tren & memeriksa detail;
//   - penyelia anomali (PELAKSANA berjenis PENYELIA_ANOMALI) mengunduh
//     seluruh daftar lalu memilih sendiri mana yang didatangi.
//
// TIDAK ADA ENDPOINT PENUGASAN, dan itu disengaja — lihat catatan pada model
// KunjunganAnomali. Penyelia tidak menunggu dibagi alamat; ia menerima
// daftar utuh dan keberhasilannya diukur dari turunnya jumlah anomali.

import { Hono } from "hono"
import { z } from "zod"
import { prisma } from "@db"
import {
  AMBANG_BULAN_DEFAULT,
  KONDISI_TIDAK_TERUKUR,
  SEMUA_KATEGORI,
} from "@/lib/domain/anomali"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created } from "../../lib/response"
import { NotFoundError, BadRequestError, ConflictError } from "../../lib/errors"
import { daftarAnomali, trenAnomali, riwayatSambungan } from "./anomali.service"

export const anomaliRouter = new Hono()

const daftarQuerySchema = z.object({
  ambangBulan: z.coerce.number().int().min(1).max(24).optional(),
  kategori: z.enum(SEMUA_KATEGORI as [string, ...string[]]).optional(),
  /// Satu kondisi catat saja (mis. "DK") — lebih sempit dari kategori, yang
  /// mengelompokkan beberapa kondisi bertindakan sama.
  kondisi: z.enum(KONDISI_TIDAK_TERUKUR as [string, ...string[]]).optional(),
  hanyaPrioritas: z.coerce.boolean().optional(),
  sembunyikanSudahDikunjungi: z.coerce.boolean().optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

/// Daftar lengkap. Dijaga LAPANGAN, bukan STAFF_UP: penyelia anomali adalah
/// PELAKSANA, dan endpoint inilah miliknya. Atasannya ikut tercakup grup itu.
anomaliRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("query", daftarQuerySchema),
  async (c) => {
    const q = c.req.valid("query")
    const baris = await daftarAnomali({
      ambangBulan: q.ambangBulan,
      kategori: q.kategori as never,
      kondisi: q.kondisi,
      hanyaPrioritas: q.hanyaPrioritas,
      sembunyikanSudahDikunjungi: q.sembunyikanSudahDikunjungi,
      periode: q.periode,
    })
    return ok(c, {
      ambangBulan: q.ambangBulan ?? AMBANG_BULAN_DEFAULT,
      total: baris.length,
      prioritas: baris.filter((b) => b.prioritas).length,
      perKategori: Object.fromEntries(
        SEMUA_KATEGORI.map((k) => [
          k,
          baris.filter((b) => b.kategori === k).length,
        ]),
      ),
      baris,
    })
  },
)

anomaliRouter.get("/tren", requireRole(...ROLE_GROUPS.LAPANGAN), async (c) => {
  const jumlah = Number(c.req.query("periode") ?? 6)
  return ok(
    c,
    await trenAnomali(
      Number.isFinite(jumlah) ? Math.min(Math.max(jumlah, 2), 24) : 6,
    ),
  )
})

anomaliRouter.get(
  "/:pelangganId/riwayat",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  async (c) => {
    const hasil = await riwayatSambungan(c.req.param("pelangganId"))
    if (!hasil) throw new NotFoundError("Pelanggan")
    return ok(c, hasil)
  },
)

const kunjunganSchema = z.object({
  pelangganId: z.string().min(1),
  periode: z.coerce.number().int().min(190001).max(999912),
  kategori: z.enum(SEMUA_KATEGORI as [string, ...string[]]),
  bulanBerturut: z.coerce.number().int().min(1),
  m3TanpaDasar: z.coerce.number().int().min(0),
  hasil: z.enum([
    "BERTEMU_TERBACA",
    "BERTEMU_TIDAK_TERBACA",
    "TETAP_TERKUNCI",
    "KOSONG_TERKONFIRMASI",
    "METER_DIPINDAH",
    "PERLU_GANTI_METER",
    "USUL_TUTUP_SEMENTARA",
    "ALAMAT_TIDAK_DITEMUKAN",
  ]),
  standDitemukan: z.coerce.number().int().min(0).max(9_999_999).optional(),
  /// Tiga foto bukti, sama seperti pencatatan rutin. `fotoUrl` = foto STAND.
  /// Diunggah lebih dulu lewat POST /laporan-harian/foto, yang mengembalikan
  /// URL-nya; di sini yang datang hanya URL, bukan berkasnya.
  fotoUrl: z.string().optional(),
  fotoPublicId: z.string().optional(),
  fotoSegelUrl: z.string().optional(),
  fotoRumahUrl: z.string().optional(),
  /// z.boolean(), BUKAN z.coerce.boolean(): coerce mengubah string "false"
  /// menjadi true. Badannya JSON, jadi boolean-nya sudah boolean.
  isSegel: z.boolean().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  catatan: z.string().trim().max(1000).optional(),
})

/// Merekam hasil kunjungan.
///
/// ANGKA METER TIDAK LANGSUNG JADI PEMBACAAN RESMI. Bila petugas berhasil
/// membaca meternya, angka itu masuk ANTREAN VERIFIKASI lewat
/// LaporanHarianPetugas — jalur yang sama dengan pencatatan biasa, dengan
/// ring V1->V2->V3 yang sudah ada. Alasannya sederhana: angka ini mengubah
/// tagihan, dan satu orang di lapangan tidak boleh mengubah tagihan tanpa
/// pemeriksaan kedua. Laporan mandiri warga pun sudah tunduk pada aturan
/// yang sama.
anomaliRouter.post(
  "/kunjungan",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("json", kunjunganSchema),
  async (c) => {
    const b = c.req.valid("json")
    const user = getSessionUser(c)

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: b.pelangganId },
      select: {
        id: true,
        nomorLangganan: true,
        nama: true,
        alamat: true,
        deletedAt: true,
      },
    })
    if (!pelanggan || pelanggan.deletedAt) throw new NotFoundError("Pelanggan")

    if (b.hasil === "BERTEMU_TERBACA" && b.standDitemukan === undefined) {
      throw new BadRequestError(
        "Hasil BERTEMU_TERBACA harus disertai angka meter yang terbaca — itu satu-satunya gunanya.",
      )
    }

    const pencatat = await prisma.pencatat.findUnique({
      where: { userId: user.id },
      select: { id: true, namaLapangan: true },
    })

    const sudahAda = await prisma.kunjunganAnomali.findUnique({
      where: {
        pelangganId_periode: { pelangganId: b.pelangganId, periode: b.periode },
      },
    })
    if (sudahAda) {
      throw new ConflictError(
        `Sambungan ${pelanggan.nomorLangganan} sudah dikunjungi pada periode ${b.periode} (hasil: ${sudahAda.hasil}). Satu kunjungan per periode.`,
      )
    }

    const row = await prisma.$transaction(async (tx) => {
      const kunjungan = await tx.kunjunganAnomali.create({
        data: {
          pelangganId: b.pelangganId,
          periode: b.periode,
          kategori: b.kategori as never,
          bulanBerturut: b.bulanBerturut,
          m3TanpaDasar: b.m3TanpaDasar,
          pencatatId: pencatat?.id ?? null,
          hasil: b.hasil as never,
          standDitemukan: b.standDitemukan ?? null,
          fotoUrl: b.fotoUrl ?? null,
          fotoPublicId: b.fotoPublicId ?? null,
          fotoSegelUrl: b.fotoSegelUrl ?? null,
          fotoRumahUrl: b.fotoRumahUrl ?? null,
          isSegel: b.isSegel ?? null,
          catatan: b.catatan ?? null,
        },
      })

      // Koordinat lewat raw SQL — kolom PostGIS tidak bisa disentuh query
      // builder Prisma (lihat panduan di prisma/docs/README.md).
      if (b.latitude !== undefined && b.longitude !== undefined) {
        await tx.$executeRaw`
        UPDATE kunjungan_anomali
        SET koordinat = ST_SetSRID(ST_MakePoint(${b.longitude}, ${b.latitude}), 4326)
        WHERE id = ${kunjungan.id}`
      }

      // Angka terbaca -> antrean verifikasi, BUKAN pembacaan resmi.
      if (b.hasil === "BERTEMU_TERBACA" && b.standDitemukan !== undefined) {
        const sebelumnya = await tx.pembacaanMeter.findFirst({
          where: { meter: { pelangganId: b.pelangganId } },
          select: { standAkhir: true, pemakaianM3: true },
          orderBy: { periode: "desc" },
        })
        const standAwal = sebelumnya?.standAkhir ?? 0
        await tx.laporanHarianPetugas.create({
          data: {
            nomorLangganan: pelanggan.nomorLangganan,
            pelangganId: pelanggan.id,
            namaPelanggan: pelanggan.nama,
            alamatPelanggan: pelanggan.alamat,
            periode: b.periode,
            standAwal,
            standAkhir: b.standDitemukan,
            pemakaian: Math.max(0, b.standDitemukan - standAwal),
            pemakaianLalu: sebelumnya?.pemakaianM3 ?? null,
            kondisi: "NORMAL",
            // OFFSITE: dibaca saat kunjungan anomali, bukan pada kunjungan
            // rutin rute — bedanya perlu terlihat saat verifikator menilai.
            kategori: "OFFSITE",
            pencatatId: pencatat?.id ?? null,
            tanggalCatat: new Date(),
            tanggalUpload: new Date(),
            // Ketiga foto DIBAWA SERTA ke antrean verifikasi. Verifikator
            // menilai angka ini lewat panel yang sama dengan pencatatan rutin;
            // kalau fotonya tertinggal di tabel kunjungan, ia harus membuka dua
            // layar untuk satu keputusan — dan yang biasanya terjadi adalah ia
            // memutuskan tanpa melihat fotonya sama sekali.
            fotoStandUrl: b.fotoUrl ?? null,
            fotoSegelUrl: b.fotoSegelUrl ?? null,
            fotoRumahUrl: b.fotoRumahUrl ?? null,
            isSegel: b.isSegel ?? null,
            latCatat: b.latitude ?? null,
            longCatat: b.longitude ?? null,
            catatanVerif: `Dari kunjungan anomali (${b.kategori}, ${b.bulanBerturut} bulan tidak terbaca).`,
          },
        })
      }

      return kunjungan
    })

    return created(c, {
      ...row,
      masukAntreanVerifikasi: b.hasil === "BERTEMU_TERBACA",
      pesan:
        b.hasil === "BERTEMU_TERBACA"
          ? "Kunjungan tercatat. Angka meter masuk antrean verifikasi — belum menjadi pembacaan resmi sampai diperiksa."
          : "Kunjungan tercatat.",
    })
  },
)

/// Kunjungan yang SUDAH dilakukan penyelia ini — bukan daftar tugas, tapi
/// catatan kerjanya sendiri.
anomaliRouter.get(
  "/kunjungan/saya",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  async (c) => {
    const user = getSessionUser(c)
    const pencatat = await prisma.pencatat.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!pencatat) return ok(c, { total: 0, baris: [] })
    const baris = await prisma.kunjunganAnomali.findMany({
      where: { pencatatId: pencatat.id },
      select: {
        id: true,
        periode: true,
        kategori: true,
        hasil: true,
        standDitemukan: true,
        catatan: true,
        dikunjungiAt: true,
        pelanggan: {
          select: { nomorLangganan: true, nama: true, alamat: true },
        },
      },
      orderBy: { dikunjungiAt: "desc" },
      take: 200,
    })
    return ok(c, { total: baris.length, baris })
  },
)
