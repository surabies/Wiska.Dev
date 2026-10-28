// server/modules/dashboard/dashboard.router.ts — angka ringkasan untuk
// halaman dashboard.
//
// SEMUA lewat agregasi database (count/aggregate/groupBy), TIDAK PERNAH
// menarik baris lalu menghitung di JavaScript: tabel pelanggan & tagihan
// masing-masing >22.000 baris, dan `findMany` lalu `.length`/`.reduce()`
// akan menyeret puluhan ribu baris melintasi jaringan tiap kali halaman
// dibuka. Semua field yang di-filter di sini sudah terindeks (lihat
// prisma/*.prisma).
import { Hono } from "hono"
import { prisma } from "@db"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { ok } from "../../lib/response"
import { dateToPeriode } from "../../lib/periode"

export const dashboardRouter = new Hono()

/// Periode terbaru yang PUNYA data — bukan bulan berjalan. Data berasal dari
/// closing bulanan yang bisa tertinggal beberapa minggu; memakai bulan
/// berjalan akan menampilkan nol besar di awal bulan dan membuat dashboard
/// terlihat rusak padahal datanya memang belum masuk.
async function periodeTerakhir(): Promise<Date | null> {
  const baris = await prisma.tagihan.findFirst({
    orderBy: { periode: "desc" },
    select: { periode: true },
  })
  return baris?.periode ?? null
}

dashboardRouter.get(
  "/ringkasan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const periode = await periodeTerakhir()

    const [
      pelangganAktif,
      pelangganNonAktif,
      tagihanPeriode,
      tunggakan,
      pengaduanBelumSelesai,
      pengaduanDarurat,
      laporanMenunggu,
      meterAktif,
    ] = await Promise.all([
      prisma.pelanggan.count({ where: { deletedAt: null, status: "AKTIF" } }),
      prisma.pelanggan.count({
        where: { deletedAt: null, status: { not: "AKTIF" } },
      }),
      periode
        ? prisma.tagihan.aggregate({
            where: { periode },
            _count: true,
            _sum: { totalTagihan: true, pemakaianM3: true },
          })
        : null,
      prisma.tagihan.aggregate({
        where: { status: { in: ["BELUM_BAYAR", "JATUH_TEMPO"] } },
        _count: true,
        _sum: { totalTagihan: true },
      }),
      prisma.pengaduan.count({
        where: { status: { in: ["BARU", "DITUGASKAN", "DIPROSES"] } },
      }),
      prisma.pengaduan.count({
        where: {
          status: { notIn: ["SELESAI", "DITOLAK"] },
          prioritas: "DARURAT",
        },
      }),
      prisma.laporanMandiri.count({ where: { status: "MENUNGGU" } }),
      prisma.meter.count({ where: { isAktif: true } }),
    ])

    return ok(c, {
      periode: periode ? dateToPeriode(periode) : null,
      pelanggan: { aktif: pelangganAktif, nonAktif: pelangganNonAktif },
      meterAktif,
      tagihanPeriode: {
        jumlah: tagihanPeriode?._count ?? 0,
        nilai: tagihanPeriode?._sum.totalTagihan ?? 0,
        pemakaianM3: tagihanPeriode?._sum.pemakaianM3 ?? 0,
      },
      tunggakan: {
        jumlah: tunggakan._count,
        nilai: tunggakan._sum.totalTagihan ?? 0,
      },
      pengaduan: {
        belumSelesai: pengaduanBelumSelesai,
        darurat: pengaduanDarurat,
      },
      laporanMandiriMenunggu: laporanMenunggu,
    })
  },
)

/// Tren 6 periode terakhir untuk grafik. groupBy di database, bukan 6 query
/// terpisah maupun tarik-semua-lalu-kelompokkan di JS.
dashboardRouter.get(
  "/tren",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const terakhir = await periodeTerakhir()
    if (!terakhir) return ok(c, [])

    // 6 bulan ke belakang dari periode terakhir yang ada datanya.
    const mulai = new Date(
      Date.UTC(terakhir.getUTCFullYear(), terakhir.getUTCMonth() - 5, 1),
    )

    const baris = await prisma.tagihan.groupBy({
      by: ["periode"],
      where: { periode: { gte: mulai, lte: terakhir } },
      _sum: { totalTagihan: true, pemakaianM3: true },
      _count: true,
      orderBy: { periode: "asc" },
    })

    return ok(
      c,
      baris.map((b) => ({
        periode: dateToPeriode(b.periode),
        jumlahTagihan: b._count,
        nilai: b._sum.totalTagihan ?? 0,
        pemakaianM3: b._sum.pemakaianM3 ?? 0,
      })),
    )
  },
)

/// Yang butuh tindakan petugas — inti dashboard operasional: bukan sekadar
/// angka, tapi "apa yang harus saya kerjakan sekarang".
dashboardRouter.get(
  "/perlu-tindakan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const [pengaduan, laporan] = await Promise.all([
      prisma.pengaduan.findMany({
        where: { status: { in: ["BARU", "DITUGASKAN", "DIPROSES"] } },
        orderBy: [{ prioritas: "desc" }, { createdAt: "asc" }],
        take: 5,
        select: {
          id: true,
          nomorTiket: true,
          jenis: true,
          judul: true,
          status: true,
          prioritas: true,
          createdAt: true,
          alamatKejadian: true,
        },
      }),
      prisma.laporanMandiri.findMany({
        where: { status: "MENUNGGU" },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
          id: true,
          nomorLangganan: true,
          periode: true,
          standDilaporkan: true,
          namaPelapor: true,
          createdAt: true,
          pelanggan: { select: { nama: true } },
        },
      }),
    ])

    return ok(c, { pengaduan, laporanMandiri: laporan })
  },
)
