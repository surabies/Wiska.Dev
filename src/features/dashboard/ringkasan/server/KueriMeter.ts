import "server-only"

// features/dashboard/ringkasan/server/KueriMeter.ts — query khusus baca meter untuk
// dashboard. Berdampingan dengan queries.ts (ambilTren & ambilPerluTindakan
// tetap dipakai apa adanya).
import { prisma } from "@db"
import { dateToPeriode } from "@/lib/domain/Periode"
import type {
  BarisPetugas,
  StatPeriode,
  TitikAnomali,
} from "../types/TipeRingkasan"

// Kode kondisi yang ditampilkan sendiri-sendiri di grafik anomali; sisanya
// digabung ke "lainnya" supaya warna grafik tetap 5 (--chart-1..5).
// Sesuaikan dengan kode yang paling sering muncul di lapangan.
export const KODE_ANOMALI_UTAMA = ["DK", "TTB", "BMK_BMB", "MTA"] as const
export type KodeAnomali = (typeof KODE_ANOMALI_UTAMA)[number] | "lainnya"

/** Geser periode YYYYMM sebanyak n bulan. geserPeriode(202601, -2) = 202511 */
export function geserPeriode(periode: number, n: number): number {
  const total = Math.floor(periode / 100) * 12 + ((periode % 100) - 1) + n
  return Math.floor(total / 12) * 100 + (total % 12) + 1
}

/** YYYYMM → tanggal 1 bulan itu (UTC), sesuai cara PembacaanMeter.periode disimpan. */
function periodeKeTanggal(periode: number): Date {
  return new Date(Date.UTC(Math.floor(periode / 100), (periode % 100) - 1, 1))
}

/** Periode kerja = periode terbaru yang sudah punya daftar catat / laporan. */
export async function periodeKerja(): Promise<number | null> {
  const [d, l] = await Promise.all([
    prisma.daftarCatat.aggregate({ _max: { periode: true } }),
    prisma.laporanHarianPetugas.aggregate({ _max: { periode: true } }),
  ])
  const nilai = [d._max.periode, l._max.periode].filter(
    (x): x is number => x != null
  )
  return nilai.length ? Math.max(...nilai) : null
}

/** KPI capaian baca + jumlah anomali untuk satu periode. */
export async function ambilCapaian(periode: number) {
  // Tahap 1: ambil sekaligus — semua lewat agregasi database.
  const [perStatus, laporanMasuk, pembacaanResmi, anomali, pelangganAktif] =
    await Promise.all([
      prisma.daftarCatat.groupBy({
        by: ["status"],
        where: { periode },
        _count: true,
      }),
      prisma.laporanHarianPetugas.count({ where: { periode } }),
      prisma.pembacaanMeter.count({
        where: { periode: periodeKeTanggal(periode) },
      }),
      prisma.laporanHarianPetugas.count({
        where: { periode, kondisi: { not: "NORMAL" } },
      }),
      prisma.pelanggan.count({ where: { deletedAt: null, status: "AKTIF" } }),
    ])
  // Laporan harian dan PembacaanMeter merekam bacaan yang SAMA pada tahap
  // berbeda: periode berjalan → laporan lebih banyak (belum diverifikasi),
  // periode lama/closing → pembacaan resmi (laporan harian mungkin tak ada).
  const laporanTotal = Math.max(laporanMasuk, pembacaanResmi)

  const hitung = (s: string) =>
    perStatus.find((x) => x.status === s)?._count ?? 0
  const adaDaftar = perStatus.length > 0

  // Tahap 2: DICABUT tetap ada di daftar tapi bukan target baca lagi.
  // Bila DaftarCatat periode ini belum terisi, pakai cadangan:
  // pembilang = jumlah laporan, penyebut = pelanggan aktif.
  const dicabut = hitung("DICABUT")
  const total = adaDaftar
    ? perStatus.reduce((a, x) => a + x._count, 0) - dicabut
    : pelangganAktif
  // "Dicatat" = laporan harian yang SUDAH MASUK. DaftarCatat.status baru
  // berubah jadi DICATAT saat laporan diverifikasi, jadi memakainya di sini
  // membuat capaian tampak ~0% padahal ribuan meter sudah terbaca.
  const dicatat = laporanTotal
  const tidakTercatat = hitung("TIDAK_TERCATAT")

  return {
    periode,
    total,
    dicatat,
    tidakTercatat,
    persen: total > 0 ? (dicatat / total) * 100 : 0,
    anomali,
    // Persentase anomali terhadap yang sudah dilaporkan, bukan terhadap total.
    persenAnomali: laporanTotal > 0 ? (anomali / laporanTotal) * 100 : 0,
    sumber: adaDaftar ? ("daftar-catat" as const) : ("cadangan" as const),
  }
}

/**
 * Jumlah anomali per periode (6 periode berakhir di `periode`), dipecah per
 * kode kondisi.
 *
 * DUA SUMBER, dipilih per periode:
 *  - LaporanHarianPetugas: hanya ada untuk periode sejak aplikasi lapangan
 *    dipakai. Dipakai bila periode itu punya laporan.
 *  - PembacaanMeter: riwayat lengkap termasuk hasil impor data lama
 *    (kondisi dipetakan dari ketcatat/Nm_Kel). Dipakai untuk periode yang
 *    belum punya laporan harian.
 * Dulu hanya sumber pertama dipakai, sehingga memilih periode lama membuat
 * grafik kosong padahal tren tagihan (yang bersumber dari Tagihan) terisi.
 */
export async function ambilTrenAnomali(
  periode: number
): Promise<TitikAnomali[]> {
  const mulai = geserPeriode(periode, -5)

  const [laporan, pembacaan] = await Promise.all([
    // Tanpa filter NORMAL: baris NORMAL dibutuhkan hanya untuk tahu bahwa
    // periode itu memang punya laporan (agar tidak jatuh ke cadangan).
    prisma.laporanHarianPetugas.groupBy({
      by: ["periode", "kondisi"],
      where: { periode: { gte: mulai, lte: periode } },
      _count: true,
    }),
    prisma.pembacaanMeter.groupBy({
      by: ["periode", "kondisi"],
      where: {
        periode: {
          gte: periodeKeTanggal(mulai),
          lte: periodeKeTanggal(periode),
        },
        kondisi: { not: "NORMAL" },
      },
      _count: true,
    }),
  ])

  // Isi semua 6 periode (nol bila kosong) supaya sumbu X tidak bolong.
  const peta = new Map<number, TitikAnomali>()
  for (let i = 0; i < 6; i++) {
    const p = geserPeriode(mulai, i)
    peta.set(p, { periode: p, DK: 0, TTB: 0, BMK_BMB: 0, MTA: 0, lainnya: 0 })
  }

  const tambah = (p: number, kondisi: string, jumlah: number) => {
    const titik = peta.get(p)
    if (!titik) return
    const kunci = (KODE_ANOMALI_UTAMA as readonly string[]).includes(kondisi)
      ? (kondisi as (typeof KODE_ANOMALI_UTAMA)[number])
      : "lainnya"
    titik[kunci] += jumlah
  }

  const periodeAdaLaporan = new Set(laporan.map((b) => b.periode))

  for (const b of laporan) {
    if (b.kondisi === "NORMAL") continue
    tambah(b.periode, b.kondisi, b._count)
  }
  for (const b of pembacaan) {
    const p = dateToPeriode(b.periode)
    if (periodeAdaLaporan.has(p)) continue // sudah dihitung dari laporan harian
    tambah(p, b.kondisi, b._count)
  }

  return [...peta.values()]
}

/**
 * Progres baca per petugas, yang paling banyak membaca di atas.
 *
 * - total   = beban kerja petugas di DaftarCatat (tanpa yang DICABUT)
 * - dicatat = laporan harian yang sudah masuk dari petugas itu. BUKAN dari
 *   DaftarCatat.status === "DICATAT": status itu baru berubah saat laporan
 *   diverifikasi, sehingga hampir semua petugas tampak 0% padahal sudah
 *   membaca ribuan meter.
 */
export async function ambilProgresPetugas(
  periode: number
): Promise<BarisPetugas[]> {
  const [beban, laporan] = await Promise.all([
    prisma.daftarCatat.groupBy({
      by: ["pencatatId", "status"],
      where: { periode, status: { not: "DICABUT" } },
      _count: true,
    }),
    prisma.laporanHarianPetugas.groupBy({
      by: ["pencatatId"],
      where: { periode },
      _count: true,
    }),
  ])
  if (beban.length === 0) return []

  const ids = [
    ...new Set(
      [
        ...beban.map((b) => b.pencatatId),
        ...laporan.map((l) => l.pencatatId),
      ].filter((x): x is string => x != null)
    ),
  ]
  const pencatat = await prisma.pencatat.findMany({
    where: { id: { in: ids } },
    select: { id: true, namaLapangan: true },
  })
  const nama = new Map(pencatat.map((p) => [p.id, p.namaLapangan]))

  const baru = (pencatatId: string | null): BarisPetugas => ({
    id: pencatatId ?? "-",
    nama: pencatatId
      ? (nama.get(pencatatId) ?? "Tidak dikenal")
      : "Belum ada petugas",
    total: 0,
    dicatat: 0,
    tidakTercatat: 0,
    persen: 0,
  })

  // Kelompokkan per petugas (null = baris tanpa petugas).
  const peta = new Map<string, BarisPetugas>()
  const ambil = (pencatatId: string | null) => {
    const id = pencatatId ?? "-"
    let r = peta.get(id)
    if (!r) {
      r = baru(pencatatId)
      peta.set(id, r)
    }
    return r
  }

  for (const b of beban) {
    const r = ambil(b.pencatatId)
    r.total += b._count
    if (b.status === "TIDAK_TERCATAT") r.tidakTercatat += b._count
  }
  for (const l of laporan) {
    ambil(l.pencatatId).dicatat += l._count
  }

  return (
    [...peta.values()]
      .map((r) => {
        // Laporan bisa datang dari petugas yang bukan pemilik daftar (rute
        // dipindah) → jangan sampai melewati 100% atau total lebih kecil dari
        // yang dicatat.
        const total = Math.max(r.total, r.dicatat)
        return {
          ...r,
          total,
          persen: total > 0 ? (r.dicatat / total) * 100 : 0,
        }
      })
      // Yang paling banyak membaca di atas; seri → beban kerja lebih besar dulu.
      .sort(
        (a, b) =>
          b.persen - a.persen || b.dicatat - a.dicatat || b.total - a.total
      )
  )
}

/**
 * Angka kartu ringkasan untuk SATU periode, apa adanya pada periode itu:
 *  - sudah ada Tagihan → angka resmi dari Tagihan (sama dengan grafik tren);
 *  - belum ada Tagihan (periode berjalan) → angka sementara dari bacaan yang
 *    sudah masuk. Sumbernya yang lebih lengkap antara laporan harian dan
 *    PembacaanMeter, karena pembacaan resmi baru terbentuk saat verifikasi.
 */
export async function ambilStatPeriode(periode: number): Promise<StatPeriode> {
  const tanggal = periodeKeTanggal(periode)
  const [tagihan, laporan, pembacaan] = await Promise.all([
    prisma.tagihan.aggregate({
      where: { periode: tanggal },
      _count: true,
      _sum: { totalTagihan: true, pemakaianM3: true },
    }),
    prisma.laporanHarianPetugas.aggregate({
      where: { periode },
      _count: true,
      // Di LaporanHarianPetugas kolom "Pakai" bernama `pemakaian` (bukan
      // `pemakaianM3` seperti di PembacaanMeter/Tagihan).
      _sum: { pemakaian: true },
    }),
    prisma.pembacaanMeter.aggregate({
      where: { periode: tanggal },
      _count: true,
      _sum: { pemakaianM3: true },
    }),
  ])

  if (tagihan._count > 0) {
    return {
      periode,
      status: "terbit",
      sl: tagihan._count,
      kubikasi: tagihan._sum.pemakaianM3 ?? 0,
      nilai: tagihan._sum.totalTagihan ?? 0,
    }
  }

  const pakaiLaporan = laporan._count >= pembacaan._count
  return {
    periode,
    status: "berjalan",
    sl: pakaiLaporan ? laporan._count : pembacaan._count,
    kubikasi:
      (pakaiLaporan ? laporan._sum.pemakaian : pembacaan._sum.pemakaianM3) ?? 0,
    nilai: null,
  }
}
