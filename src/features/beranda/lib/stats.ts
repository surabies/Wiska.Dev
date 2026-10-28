import "server-only"

// features/beranda/lib/stats.ts — angka nyata untuk landing page, diambil
// langsung dari database (pola yang sama dengan features/dashboard/lib/
// queries.ts: server component baca DB langsung, bukan fetch ke API sendiri).
//
// SEMUA angka di landing page berasal dari sini — tidak ada satu pun angka
// pemasaran yang dikarang di JSX. Kalau datanya belum ada (DB kosong),
// komponen pemanggil menyembunyikan barisnya, bukan menampilkan nol palsu.
//
// Di-cache 1 jam: landing page dirender dinamis (header membaca sesi), dan
// tanpa cache setiap pengunjung anonim memicu 4 agregasi. Angka-angka ini
// bergerak sebulan sekali (closing), jadi 1 jam pun sudah terlalu rajin.
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { dateToPeriode } from "@/lib/domain/periode"

export interface StatsBeranda {
  pelangganAktif: number
  kelurahanTerlayani: number
  kecamatanTerlayani: number
  /** Periode tagihan terakhir yang ada datanya (thbl, mis. 202605) — bukan
   *  bulan berjalan; closing bulanan bisa tertinggal (lihat aturan dashboard
   *  di FRONTEND.md). null bila belum ada tagihan sama sekali. */
  periodeTerakhir: number | null
  tagihanPeriodeTerakhir: number
}

export const getStatsBeranda = unstable_cache(
  async (): Promise<StatsBeranda> => {
    const [pelangganAktif, kelurahanTerlayani, kecamatanTerlayani, tagihanTerbaru] = await Promise.all([
      prisma.pelanggan.count({ where: { status: "AKTIF", deletedAt: null } }),
      prisma.kelurahan.count({ where: { pelanggan: { some: { deletedAt: null } } } }),
      prisma.kecamatan.count({ where: { pelanggan: { some: { deletedAt: null } } } }),
      prisma.tagihan.findFirst({ orderBy: { periode: "desc" }, select: { periode: true } }),
    ])

    const periodeTerakhir = tagihanTerbaru ? dateToPeriode(tagihanTerbaru.periode) : null
    const tagihanPeriodeTerakhir = tagihanTerbaru
      ? await prisma.tagihan.count({ where: { periode: tagihanTerbaru.periode } })
      : 0

    return { pelangganAktif, kelurahanTerlayani, kecamatanTerlayani, periodeTerakhir, tagihanPeriodeTerakhir }
  },
  ["stats-beranda"],
  { revalidate: 3600 }
)
