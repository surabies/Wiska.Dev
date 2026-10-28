import "server-only"

// features/dashboard/lib/queries-meter.ts — query khusus baca meter untuk
// dashboard. Berdampingan dengan queries.ts (ambilTren & ambilPerluTindakan
// tetap dipakai apa adanya).
import { prisma } from "@db"

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

/** Periode kerja = periode terbaru yang sudah punya daftar catat / laporan. */
export async function periodeKerja(): Promise<number | null> {
  const [d, l] = await Promise.all([
    prisma.daftarCatat.aggregate({ _max: { periode: true } }),
    prisma.laporanHarianPetugas.aggregate({ _max: { periode: true } }),
  ])
  const nilai = [d._max.periode, l._max.periode].filter((x): x is number => x != null)
  return nilai.length ? Math.max(...nilai) : null
}

/** KPI capaian baca + jumlah anomali untuk satu periode. */
export async function ambilCapaian(periode: number) {
  // Tahap 1: ambil sekaligus — semua lewat agregasi database.
  const [perStatus, laporanTotal, anomali, pelangganAktif] = await Promise.all([
    prisma.daftarCatat.groupBy({ by: ["status"], where: { periode }, _count: true }),
    prisma.laporanHarianPetugas.count({ where: { periode } }),
    prisma.laporanHarianPetugas.count({ where: { periode, kondisi: { not: "NORMAL" } } }),
    prisma.pelanggan.count({ where: { deletedAt: null, status: "AKTIF" } }),
  ])

  const hitung = (s: string) => perStatus.find((x) => x.status === s)?._count ?? 0
  const adaDaftar = perStatus.length > 0

  // Tahap 2: DICABUT tetap ada di daftar tapi bukan target baca lagi.
  // Bila DaftarCatat periode ini belum terisi, pakai cadangan:
  // pembilang = jumlah laporan, penyebut = pelanggan aktif.
  const dicabut = hitung("DICABUT")
  const total = adaDaftar
    ? perStatus.reduce((a, x) => a + x._count, 0) - dicabut
    : pelangganAktif
  const dicatat = adaDaftar ? hitung("DICATAT") : laporanTotal
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

export interface TitikAnomali {
  periode: number
  DK: number
  TTB: number
  BMK_BMB: number
  MTA: number
  lainnya: number
}

/** Jumlah anomali per periode (6 periode terakhir), dipecah per kode kondisi. */
export async function ambilTrenAnomali(periode: number): Promise<TitikAnomali[]> {
  const mulai = geserPeriode(periode, -5)

  const baris = await prisma.laporanHarianPetugas.groupBy({
    by: ["periode", "kondisi"],
    where: { periode: { gte: mulai, lte: periode }, kondisi: { not: "NORMAL" } },
    _count: true,
  })

  // Isi semua 6 periode (nol bila kosong) supaya sumbu X tidak bolong.
  const peta = new Map<number, TitikAnomali>()
  for (let i = 0; i < 6; i++) {
    const p = geserPeriode(mulai, i)
    peta.set(p, { periode: p, DK: 0, TTB: 0, BMK_BMB: 0, MTA: 0, lainnya: 0 })
  }

  for (const b of baris) {
    const titik = peta.get(b.periode)
    if (!titik) continue
    const kunci = (KODE_ANOMALI_UTAMA as readonly string[]).includes(b.kondisi)
      ? (b.kondisi as (typeof KODE_ANOMALI_UTAMA)[number])
      : "lainnya"
    titik[kunci] += b._count
  }

  return [...peta.values()]
}

export interface BarisPetugas {
  id: string
  nama: string
  total: number
  dicatat: number
  tidakTercatat: number
  persen: number
}

/** Progres baca per petugas, yang paling tertinggal di atas. */
export async function ambilProgresPetugas(periode: number): Promise<BarisPetugas[]> {
  const baris = await prisma.daftarCatat.groupBy({
    by: ["pencatatId", "status"],
    where: { periode, status: { not: "DICABUT" } },
    _count: true,
  })
  if (baris.length === 0) return []

  const ids = [...new Set(baris.map((b) => b.pencatatId).filter((x): x is string => x != null))]
  const pencatat = await prisma.pencatat.findMany({
    where: { id: { in: ids } },
    select: { id: true, namaLapangan: true },
  })
  const nama = new Map(pencatat.map((p) => [p.id, p.namaLapangan]))

  // Kelompokkan per petugas (null = baris tanpa petugas).
  const peta = new Map<string, BarisPetugas>()
  for (const b of baris) {
    const id = b.pencatatId ?? "-"
    const r = peta.get(id) ?? {
      id,
      nama: b.pencatatId ? (nama.get(b.pencatatId) ?? "Tidak dikenal") : "Belum ada petugas",
      total: 0,
      dicatat: 0,
      tidakTercatat: 0,
      persen: 0,
    }
    r.total += b._count
    if (b.status === "DICATAT") r.dicatat += b._count
    if (b.status === "TIDAK_TERCATAT") r.tidakTercatat += b._count
    peta.set(id, r)
  }

  return [...peta.values()]
    .map((r) => ({ ...r, persen: r.total > 0 ? (r.dicatat / r.total) * 100 : 0 }))
    .sort((a, b) => a.persen - b.persen)
}