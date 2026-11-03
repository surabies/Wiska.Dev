import { Prisma, type GolonganTarif } from "@db"
import { prisma } from "@db"
import { dateToPeriode, periodeToDate } from "../../lib/Periode"
import { DAFTAR_TARIF_DRD } from "@/features/dashboard/drd/types/TipeDrd"
import type {
  BarisDomestikDrd,
  BarisCakupanDrd,
  BarisKelurahanDrd,
  BarisPelangganDrd,
  BarisTaaKelurahanDrd,
  BarisTarifDrd,
  HasilDataDrd,
  RingkasanDrd,
  TabDrd,
  TitikGrafikDrd,
  TabDataDrd,
} from "@/features/dashboard/drd/types/TipeDrd"

const KODE_TARIF_DOMESTIK: GolonganTarif[] = [
  "GOL_1A",
  "GOL_2A1",
  "GOL_2A2",
  "GOL_2A3",
  "GOL_2A4",
  "GOL_2A5",
  "GOL_3A",
  "GOL_3B",
  "GOL_3C",
]

const UKURAN_HALAMAN_MAKS = 5000

export async function ambilPeriodeDrd(): Promise<number[]> {
  const hasil = await prisma.tagihan.groupBy({
    by: ["periode"],
    orderBy: { periode: "desc" },
  })
  return hasil.map((baris) => dateToPeriode(baris.periode))
}

export async function ambilRingkasanDrd(
  periode: number
): Promise<RingkasanDrd> {
  const tanggalPeriode = periodeToDate(periode)
  const [
    tagihan,
    jumlahTaa,
    jumlahDomestik,
    jumlahKelurahan,
    rawKelurahan,
    rawDomestik,
    rawTarif,
    rawTaaKelurahan,
    rawCakupan,
    rawTaaTarif,
  ] = await Promise.all([
    prisma.tagihan.aggregate({
      where: { periode: tanggalPeriode },
      _count: { _all: true },
      _sum: {
        pemakaianM3: true,
        totalTagihan: true,
        jmlHargaAir: true,
        beaBeban: true,
        beaAdmin: true,
        airKotor: true,
        lainLain: true,
      },
    }),
    prisma.tagihan.count({
      where: {
        periode: tanggalPeriode,
        pembacaan: { is: { kondisi: "TIDAK_ADA_AIR" } },
      },
    }),
    prisma.tagihan.count({
      where: {
        periode: tanggalPeriode,
        tarifGolongan: { is: { kode: { in: KODE_TARIF_DOMESTIK } } },
      },
    }),
    prisma.$queryRaw<Array<{ jumlah: number }>>`
      SELECT COUNT(DISTINCT COALESCE(k.nama, 'Tidak diketahui'))::int AS jumlah
        FROM tagihan t
        JOIN pelanggan p ON p.id = t."pelangganId"
        LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
       WHERE t.periode = ${tanggalPeriode}
    `,
    // 1. Data Kelurahan (Top 8 berdasarkan total tagihan)
    prisma.$queryRaw<
      Array<{
        kelurahan: string
        jumlahPelanggan: number
        pemakaianM3: string
        totalTagihan: string
      }>
    >`
      SELECT COALESCE(k.nama, 'Tidak diketahui') AS kelurahan,
             COUNT(*)::int AS "jumlahPelanggan",
             COALESCE(SUM(t."pemakaianM3"), 0)::text AS "pemakaianM3",
             COALESCE(SUM(t."totalTagihan"), 0)::text AS "totalTagihan"
        FROM tagihan t
        JOIN pelanggan p ON p.id = t."pelangganId"
        LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
       WHERE t.periode = ${tanggalPeriode}
       GROUP BY COALESCE(k.nama, 'Tidak diketahui')
       ORDER BY SUM(t."totalTagihan") DESC, COALESCE(k.nama, 'Tidak diketahui') ASC
       LIMIT 8
    `,
    // 2. Data Domestik (Tangga tarif rumah tangga)
    prisma.$queryRaw<
      Array<{
        kode: string
        nama: string
        jumlahPelanggan: number
        pemakaianM3: string
        totalTagihan: string
      }>
    >`
      SELECT COALESCE(REPLACE(tg.kode::text, 'GOL_', ''), 'Tidak diketahui') AS kode,
             COALESCE(tg.nama, 'Tarif tidak diketahui') AS nama,
             COUNT(*)::int AS "jumlahPelanggan",
             COALESCE(SUM(t."pemakaianM3"), 0)::text AS "pemakaianM3",
             COALESCE(SUM(t."totalTagihan"), 0)::text AS "totalTagihan"
        FROM tagihan t
        JOIN tarif_golongan tg ON tg.id = t."tarifGolonganId"
       WHERE t.periode = ${tanggalPeriode}
         AND tg.kode::text = ANY(${KODE_TARIF_DOMESTIK}::text[])
       GROUP BY tg.kode, tg.nama
       ORDER BY tg.kode ASC
    `,
    // 3. Data Tarif (Seluruh Golongan Tarif)
    prisma.$queryRaw<
      Array<{
        kode: string
        nama: string
        jumlahPelanggan: number
        pemakaianM3: string
        totalTagihan: string
      }>
    >`
      SELECT COALESCE(REPLACE(tg.kode::text, 'GOL_', ''), 'Tanpa tarif') AS kode,
             COALESCE(tg.nama, 'Tanpa tarif') AS nama,
             COUNT(*)::int AS "jumlahPelanggan",
             COALESCE(SUM(t."pemakaianM3"), 0)::text AS "pemakaianM3",
             COALESCE(SUM(t."totalTagihan"), 0)::text AS "totalTagihan"
        FROM tagihan t
        LEFT JOIN tarif_golongan tg ON tg.id = t."tarifGolonganId"
       WHERE t.periode = ${tanggalPeriode}
       GROUP BY tg.kode, tg.nama
       ORDER BY SUM(t."totalTagihan") DESC
    `,
    // 4. Data TAA per Kelurahan
    prisma.$queryRaw<
      Array<{
        kelurahan: string
        jumlahTaa: number
      }>
    >`
      SELECT COALESCE(k.nama, 'Tidak diketahui') AS kelurahan,
             COUNT(*)::int AS "jumlahTaa"
        FROM tagihan t
        JOIN pembacaan_meter b ON b.id = t."pembacaanId"
        JOIN pelanggan p ON p.id = t."pelangganId"
        LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
       WHERE t.periode = ${tanggalPeriode}
         AND b.kondisi = 'TIDAK_ADA_AIR'
       GROUP BY COALESCE(k.nama, 'Tidak diketahui')
       ORDER BY COUNT(*) DESC, COALESCE(k.nama, 'Tidak diketahui') ASC
       LIMIT 8
    `,
    // 5. Data Cakupan (Top 8 Kelurahan - SL & Pemakaian)
    prisma.$queryRaw<
      Array<{
        kelurahan: string
        sl: number
        pemakaianM3: string
        totalTagihan: string
      }>
    >`
      SELECT COALESCE(k.nama, 'Tidak diketahui') AS kelurahan,
             COUNT(*)::int AS sl,
             COALESCE(SUM(t."pemakaianM3"), 0)::text AS "pemakaianM3",
             COALESCE(SUM(t."totalTagihan"), 0)::text AS "totalTagihan"
        FROM tagihan t
        JOIN pelanggan p ON p.id = t."pelangganId"
        LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
       WHERE t.periode = ${tanggalPeriode}
       GROUP BY COALESCE(k.nama, 'Tidak diketahui')
       ORDER BY COUNT(*) DESC, COALESCE(k.nama, 'Tidak diketahui') ASC
       LIMIT 8
    `,
    // 6. Data TAA Sebaran Tarif
    prisma.$queryRaw<
      Array<{
        kode: string
        jumlahTaa: number
      }>
    >`
      SELECT COALESCE(REPLACE(tg.kode::text, 'GOL_', ''), 'Tanpa tarif') AS kode,
             COUNT(*)::int AS "jumlahTaa"
        FROM tagihan t
        JOIN pembacaan_meter b ON b.id = t."pembacaanId"
        LEFT JOIN tarif_golongan tg ON tg.id = t."tarifGolonganId"
       WHERE t.periode = ${tanggalPeriode}
         AND b.kondisi = 'TIDAK_ADA_AIR'
       GROUP BY tg.kode
       ORDER BY COUNT(*) DESC
       LIMIT 6
    `,
  ])

  const totalPelanggan = tagihan._count._all
  const dataKelurahan = rawKelurahan.map((r) => ({
    kelurahan: r.kelurahan,
    jumlahPelanggan: r.jumlahPelanggan,
    pemakaianM3: Number(r.pemakaianM3),
    totalTagihan: Number(r.totalTagihan),
  }))

  const dataDomestik = rawDomestik.map((r) => ({
    kode: r.kode,
    nama: r.nama,
    jumlahPelanggan: r.jumlahPelanggan,
    pemakaianM3: Number(r.pemakaianM3),
    totalTagihan: Number(r.totalTagihan),
  }))

  const dataTarif = rawTarif.map((r) => ({
    kode: r.kode,
    nama: r.nama,
    jumlahPelanggan: r.jumlahPelanggan,
    pemakaianM3: Number(r.pemakaianM3),
    totalTagihan: Number(r.totalTagihan),
  }))

  const dataTaaKelurahan = rawTaaKelurahan.map((r) => ({
    kelurahan: r.kelurahan,
    jumlahTaa: r.jumlahTaa,
    persentaseTaa:
      totalPelanggan > 0
        ? Number(((r.jumlahTaa / totalPelanggan) * 100).toFixed(1))
        : 0,
  }))

  const dataCakupan = rawCakupan.map((r) => ({
    kelurahan: r.kelurahan,
    sl: r.sl,
    pemakaianM3: Number(r.pemakaianM3),
    totalTagihan: Number(r.totalTagihan),
  }))

  const dataTaaStatus = {
    normal: Math.max(0, totalPelanggan - jumlahTaa),
    taa: jumlahTaa,
    persenTaa:
      totalPelanggan > 0
        ? Number(((jumlahTaa / totalPelanggan) * 100).toFixed(1))
        : 0,
    sebaranTarif: rawTaaTarif.map((r) => ({
      kode: r.kode,
      jumlahTaa: r.jumlahTaa,
    })),
  }

  const dataTagihanKomposisi = {
    hargaAir: tagihan._sum.jmlHargaAir ?? 0,
    beaBeban: tagihan._sum.beaBeban ?? 0,
    beaAdmin: tagihan._sum.beaAdmin ?? 0,
    airKotor: tagihan._sum.airKotor ?? 0,
    lainLain: tagihan._sum.lainLain ?? 0,
    totalTagihan: tagihan._sum.totalTagihan ?? 0,
  }

  return {
    periode,
    jumlahPelanggan: totalPelanggan,
    pemakaianM3: tagihan._sum.pemakaianM3 ?? 0,
    totalTagihan: tagihan._sum.totalTagihan ?? 0,
    jumlahTaa,
    jumlahDomestik,
    jumlahKelurahan: jumlahKelurahan[0]?.jumlah ?? 0,
    dataKelurahan,
    dataDomestik,
    dataTarif,
    dataTaaKelurahan,
    dataCakupan,
    dataTaaStatus,
    dataTagihanKomposisi,
  }
}

export async function ambilGrafikDrd(
  periode: number,
  tab: TabDrd
): Promise<TitikGrafikDrd[]> {
  const tanggalPeriode = periodeToDate(periode)
  const berdasarkanKelurahan = [
    "kelurahan",
    "taa-kelurahan",
    "cakupan",
  ].includes(tab)
  const kategori = berdasarkanKelurahan
    ? Prisma.sql`COALESCE(k.nama, 'Tidak diketahui')`
    : Prisma.sql`COALESCE(REPLACE(tg.kode::text, 'GOL_', ''), 'Tanpa tarif')`
  const filterTaa =
    tab === "taa" || tab === "taa-kelurahan"
      ? Prisma.sql`AND b.kondisi = 'TIDAK_ADA_AIR'`
      : Prisma.empty
  const filterDomestik =
    tab === "domestik"
      ? Prisma.sql`AND tg.kode::text = ANY(${KODE_TARIF_DOMESTIK}::text[])`
      : Prisma.empty

  const hasil = await prisma.$queryRaw<
    Array<{
      kategori: string
      jumlahPelanggan: number
      pemakaianM3: string
      totalTagihan: string
    }>
  >(Prisma.sql`
    SELECT ${kategori} AS kategori,
           COUNT(*)::int AS "jumlahPelanggan",
           COALESCE(SUM(t."pemakaianM3"), 0)::text AS "pemakaianM3",
           COALESCE(SUM(t."totalTagihan"), 0)::text AS "totalTagihan"
      FROM tagihan t
      JOIN pelanggan p ON p.id = t."pelangganId"
      LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
      LEFT JOIN tarif_golongan tg ON tg.id = t."tarifGolonganId"
      LEFT JOIN pembacaan_meter b ON b.id = t."pembacaanId"
     WHERE t.periode = ${tanggalPeriode}
       ${filterTaa}
       ${filterDomestik}
     GROUP BY ${kategori}
     ORDER BY SUM(t."totalTagihan") DESC, ${kategori} ASC
     LIMIT 8
  `)

  return hasil.map((baris) => ({
    kategori: baris.kategori,
    jumlahPelanggan: baris.jumlahPelanggan,
    pemakaianM3: Number(baris.pemakaianM3),
    totalTagihan: Number(baris.totalTagihan),
  }))
}

export async function ambilDataDrd(params: {
  periode: number
  tab: TabDataDrd
  halaman: number
  ukuranHalaman: number
  pencarian: string
}): Promise<HasilDataDrd> {
  const ukuranHalaman = Math.min(params.ukuranHalaman, UKURAN_HALAMAN_MAKS)
  const offset = (params.halaman - 1) * ukuranHalaman
  const pencarian = params.pencarian.trim()

  if (params.tab === "kelurahan") {
    return ambilKelurahanDrd(
      params.periode,
      pencarian,
      params.halaman,
      ukuranHalaman,
      offset
    )
  }
  if (params.tab === "domestik") {
    return ambilDomestikDrd(
      params.periode,
      pencarian,
      params.halaman,
      ukuranHalaman,
      offset
    )
  }
  if (params.tab === "tarif") {
    return ambilTarifDrd(
      params.periode,
      pencarian,
      params.halaman,
      ukuranHalaman,
      offset
    )
  }
  if (params.tab === "taa-kelurahan") {
    return ambilTaaKelurahanDrd(
      params.periode,
      pencarian,
      params.halaman,
      ukuranHalaman,
      offset
    )
  }
  if (params.tab === "cakupan") {
    return ambilCakupanDrd(
      params.periode,
      pencarian,
      params.halaman,
      ukuranHalaman,
      offset
    )
  }

  const umum = {
    periode: params.periode,
    halaman: params.halaman,
    ukuranHalaman,
    pencarian,
    offset,
  }
  if (params.tab === "taa") return ambilPelangganDrd({ ...umum, tab: "taa" })
  if (params.tab === "tagihan")
    return ambilPelangganDrd({ ...umum, tab: "tagihan" })
  if (params.tab === "pelanggan")
    return ambilPelangganDrd({ ...umum, tab: "pelanggan" })
  throw new Error(`Tab DRD tidak dikenal: ${params.tab}`)
}

async function ambilTarifDrd(
  periode: number,
  pencarian: string,
  halaman: number,
  ukuranHalaman: number,
  offset: number
): Promise<Extract<HasilDataDrd, { tab: "tarif" }>> {
  const tanggalPeriode = periodeToDate(periode)
  const hasil = await prisma.$queryRawUnsafe<
    Array<
      Omit<BarisTarifDrd, "pemakaianM3" | "totalTagihan"> & {
        pemakaianM3: string
        totalTagihan: string
        totalBaris: number
      }
    >
  >(
    `
    WITH kelompok AS (
      SELECT COALESCE(tg.kode::text, 'TANPA_TARIF') AS id,
             COALESCE(REPLACE(tg.kode::text, 'GOL_', ''), 'Tidak diketahui') AS tarif,
             COALESCE(tg.nama, 'Tarif tidak diketahui') AS "namaTarif",
             COUNT(*)::int AS "jumlahPelanggan",
             COALESCE(SUM(t."pemakaianM3"), 0)::text AS "pemakaianM3",
             COALESCE(SUM(t."totalTagihan"), 0)::text AS "totalTagihan"
        FROM tagihan t
        LEFT JOIN tarif_golongan tg ON tg.id = t."tarifGolonganId"
       WHERE t.periode = $1
       GROUP BY tg.kode, tg.nama
    )
    SELECT kelompok.*,
           COUNT(*) OVER()::int AS "totalBaris"
      FROM kelompok
     WHERE ($2::text IS NULL OR tarif ILIKE $2 OR "namaTarif" ILIKE $2)
     ORDER BY tarif ASC
     LIMIT $3
    OFFSET $4
    `,
    tanggalPeriode,
    pencarian ? `%${pencarian}%` : null,
    ukuranHalaman,
    offset
  )

  const total = hasil[0]?.totalBaris ?? 0
  const baris: BarisTarifDrd[] = hasil.map((baris) => ({
    id: baris.id,
    tarif: baris.tarif,
    namaTarif: baris.namaTarif,
    jumlahPelanggan: baris.jumlahPelanggan,
    pemakaianM3: Number(baris.pemakaianM3),
    totalTagihan: Number(baris.totalTagihan),
  }))

  return {
    tab: "tarif",
    baris,
    halaman,
    ukuranHalaman,
    total,
    totalHalaman: Math.max(1, Math.ceil(total / ukuranHalaman)),
  }
}

async function ambilTaaKelurahanDrd(
  periode: number,
  pencarian: string,
  halaman: number,
  ukuranHalaman: number,
  offset: number
): Promise<Extract<HasilDataDrd, { tab: "taa-kelurahan" }>> {
  const tanggalPeriode = periodeToDate(periode)
  const hasil = await prisma.$queryRawUnsafe<
    Array<
      Omit<BarisTaaKelurahanDrd, "pemakaianM3" | "totalTagihan"> & {
        pemakaianM3: string
        totalTagihan: string
        totalBaris: number
      }
    >
  >(
    `
    WITH kelompok AS (
      SELECT COALESCE(k.id, 'tidak-diketahui') AS id,
             COALESCE(k.nama, 'Tidak diketahui') AS kelurahan,
             COUNT(*)::int AS "jumlahPelanggan",
             COALESCE(SUM(t."pemakaianM3"), 0)::text AS "pemakaianM3",
             COALESCE(SUM(t."totalTagihan"), 0)::text AS "totalTagihan"
        FROM tagihan t
        JOIN pembacaan_meter b ON b.id = t."pembacaanId"
        JOIN pelanggan p ON p.id = t."pelangganId"
        LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
       WHERE t.periode = $1
         AND b.kondisi = 'TIDAK_ADA_AIR'
       GROUP BY COALESCE(k.id, 'tidak-diketahui'),
                COALESCE(k.nama, 'Tidak diketahui')
    )
    SELECT kelompok.*,
           COUNT(*) OVER()::int AS "totalBaris"
      FROM kelompok
     WHERE ($2::text IS NULL OR kelurahan ILIKE $2)
     ORDER BY kelurahan ASC
     LIMIT $3
    OFFSET $4
    `,
    tanggalPeriode,
    pencarian ? `%${pencarian}%` : null,
    ukuranHalaman,
    offset
  )

  const total = hasil[0]?.totalBaris ?? 0
  const baris: BarisTaaKelurahanDrd[] = hasil.map((baris) => ({
    id: baris.id,
    kelurahan: baris.kelurahan,
    jumlahPelanggan: baris.jumlahPelanggan,
    pemakaianM3: Number(baris.pemakaianM3),
    totalTagihan: Number(baris.totalTagihan),
  }))

  return {
    tab: "taa-kelurahan",
    baris,
    halaman,
    ukuranHalaman,
    total,
    totalHalaman: Math.max(1, Math.ceil(total / ukuranHalaman)),
  }
}

async function ambilCakupanDrd(
  periode: number,
  pencarian: string,
  halaman: number,
  ukuranHalaman: number,
  offset: number
): Promise<Extract<HasilDataDrd, { tab: "cakupan" }>> {
  const tanggalPeriode = periodeToDate(periode)
  const hasil = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      kelurahan: string
      tarif: string | null
      jumlahPelanggan: number
      pemakaianM3: string
      totalTagihan: string
    }>
  >(
    `
    SELECT COALESCE(k.id, 'tidak-diketahui') AS id,
           COALESCE(k.nama, 'Tidak diketahui') AS kelurahan,
           tg.kode::text AS tarif,
           COUNT(*)::int AS "jumlahPelanggan",
           COALESCE(SUM(t."pemakaianM3"), 0)::text AS "pemakaianM3",
           COALESCE(SUM(t."totalTagihan"), 0)::text AS "totalTagihan"
      FROM tagihan t
      JOIN pelanggan p ON p.id = t."pelangganId"
      LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
      LEFT JOIN tarif_golongan tg ON tg.id = t."tarifGolonganId"
     WHERE t.periode = $1
       AND ($2::text IS NULL OR COALESCE(k.nama, 'Tidak diketahui') ILIKE $2)
     GROUP BY COALESCE(k.id, 'tidak-diketahui'),
              COALESCE(k.nama, 'Tidak diketahui'),
              tg.kode
     ORDER BY kelurahan ASC, tarif ASC
    `,
    tanggalPeriode,
    pencarian ? `%${pencarian}%` : null
  )

  const kelompok = new Map<string, BarisCakupanDrd>()
  for (const data of hasil) {
    let baris = kelompok.get(data.id)
    if (!baris) {
      baris = { id: data.id, kelurahan: data.kelurahan }
      for (const tarif of DAFTAR_TARIF_DRD) {
        baris[`sl_${tarif.kode}`] = 0
        baris[`pemakaianM3_${tarif.kode}`] = 0
        baris[`totalTagihan_${tarif.kode}`] = 0
      }
      baris.sl_TANPA_TARIF = 0
      baris.pemakaianM3_TANPA_TARIF = 0
      baris.totalTagihan_TANPA_TARIF = 0
      kelompok.set(data.id, baris)
    }

    const tarif = data.tarif ?? "TANPA_TARIF"
    baris[`sl_${tarif}`] = data.jumlahPelanggan
    baris[`pemakaianM3_${tarif}`] = Number(data.pemakaianM3)
    baris[`totalTagihan_${tarif}`] = Number(data.totalTagihan)
  }

  const semuaBaris = Array.from(kelompok.values())
  const total = semuaBaris.length
  return {
    tab: "cakupan",
    baris: semuaBaris.slice(offset, offset + ukuranHalaman),
    halaman,
    ukuranHalaman,
    total,
    totalHalaman: Math.max(1, Math.ceil(total / ukuranHalaman)),
  }
}

async function ambilKelurahanDrd(
  periode: number,
  pencarian: string,
  halaman: number,
  ukuranHalaman: number,
  offset: number
): Promise<Extract<HasilDataDrd, { tab: "kelurahan" }>> {
  const tanggalPeriode = periodeToDate(periode)

  const hasil = await prisma.$queryRawUnsafe<
    Array<
      Omit<BarisKelurahanDrd, "pemakaianM3" | "totalTagihan"> & {
        pemakaianM3: string
        totalTagihan: string
        totalBaris: number
      }
    >
  >(
    `
    WITH kelompok AS (
      SELECT COALESCE(k.id, 'tidak-diketahui') AS id,
             COALESCE(k.nama, 'Tidak diketahui') AS kelurahan,
             COUNT(*)::int AS "jumlahPelanggan",
             COALESCE(SUM(t."pemakaianM3"), 0)::text AS "pemakaianM3",
             COALESCE(SUM(t."totalTagihan"), 0)::text AS "totalTagihan"
        FROM tagihan t
        JOIN pelanggan p ON p.id = t."pelangganId"
        LEFT JOIN kelurahan k ON k.id = p."kelurahanId"
       WHERE t.periode = $1
       GROUP BY COALESCE(k.id, 'tidak-diketahui'),
                COALESCE(k.nama, 'Tidak diketahui')
    )
    SELECT kelompok.*,
           COUNT(*) OVER()::int AS "totalBaris"
      FROM kelompok
     WHERE ($2::text IS NULL OR kelurahan ILIKE $2)
     ORDER BY kelurahan ASC
     LIMIT $3
    OFFSET $4
    `,
    tanggalPeriode,
    pencarian ? `%${pencarian}%` : null,
    ukuranHalaman,
    offset
  )

  const total = hasil[0]?.totalBaris ?? 0
  return {
    tab: "kelurahan",
    baris: hasil.map((baris) => ({
      id: baris.id,
      kelurahan: baris.kelurahan,
      jumlahPelanggan: baris.jumlahPelanggan,
      pemakaianM3: Number(baris.pemakaianM3),
      totalTagihan: Number(baris.totalTagihan),
    })),
    halaman,
    ukuranHalaman,
    total,
    totalHalaman: Math.max(1, Math.ceil(total / ukuranHalaman)),
  }
}

async function ambilDomestikDrd(
  periode: number,
  pencarian: string,
  halaman: number,
  ukuranHalaman: number,
  offset: number
): Promise<Extract<HasilDataDrd, { tab: "domestik" }>> {
  const tanggalPeriode = periodeToDate(periode)

  const hasil = await prisma.$queryRawUnsafe<
    Array<
      Omit<BarisDomestikDrd, "pemakaianM3" | "totalTagihan"> & {
        pemakaianM3: string
        totalTagihan: string
        totalBaris: number
      }
    >
  >(
    `
    WITH kelompok AS (
      SELECT tg.kode::text AS id,
             REPLACE(tg.kode::text, 'GOL_', '') AS tarif,
             tg.nama AS "namaTarif",
             COUNT(*)::int AS "jumlahPelanggan",
             COALESCE(SUM(t."pemakaianM3"), 0)::text AS "pemakaianM3",
             COALESCE(SUM(t."totalTagihan"), 0)::text AS "totalTagihan"
        FROM tagihan t
        JOIN tarif_golongan tg ON tg.id = t."tarifGolonganId"
       WHERE t.periode = $1
         AND tg.kode::text = ANY($2::text[])
       GROUP BY tg.kode, tg.nama
    )
    SELECT kelompok.*,
           COUNT(*) OVER()::int AS "totalBaris"
      FROM kelompok
     WHERE ($3::text IS NULL OR tarif ILIKE $3 OR "namaTarif" ILIKE $3)
     ORDER BY tarif ASC
     LIMIT $4
    OFFSET $5
    `,
    tanggalPeriode,
    KODE_TARIF_DOMESTIK,
    pencarian ? `%${pencarian}%` : null,
    ukuranHalaman,
    offset
  )

  const total = hasil[0]?.totalBaris ?? 0
  return {
    tab: "domestik",
    baris: hasil.map((baris) => ({
      id: baris.id,
      tarif: baris.tarif,
      namaTarif: baris.namaTarif,
      jumlahPelanggan: baris.jumlahPelanggan,
      pemakaianM3: Number(baris.pemakaianM3),
      totalTagihan: Number(baris.totalTagihan),
    })),
    halaman,
    ukuranHalaman,
    total,
    totalHalaman: Math.max(1, Math.ceil(total / ukuranHalaman)),
  }
}

async function ambilPelangganDrd(params: {
  periode: number
  tab: "taa" | "tagihan" | "pelanggan"
  halaman: number
  ukuranHalaman: number
  pencarian: string
  offset: number
}): Promise<HasilDataDrd> {
  const tanggalPeriode = periodeToDate(params.periode)
  const filterPelanggan: Prisma.PelangganWhereInput = params.pencarian
    ? {
        OR: [
          {
            nomorLangganan: {
              contains: params.pencarian,
              mode: "insensitive",
            },
          },
          { nama: { contains: params.pencarian, mode: "insensitive" } },
          { alamat: { contains: params.pencarian, mode: "insensitive" } },
          {
            kelurahan: {
              is: {
                nama: { contains: params.pencarian, mode: "insensitive" },
              },
            },
          },
        ],
      }
    : {}
  const where: Prisma.TagihanWhereInput = {
    periode: tanggalPeriode,
    ...(params.tab === "taa" && {
      pembacaan: { is: { kondisi: "TIDAK_ADA_AIR" } },
    }),
    ...(params.pencarian && { pelanggan: { is: filterPelanggan } }),
  }

  const [total, tagihan] = await prisma.$transaction([
    prisma.tagihan.count({ where }),
    prisma.tagihan.findMany({
      where,
      orderBy: { pelanggan: { nomorLangganan: "asc" } },
      skip: params.offset,
      take: params.ukuranHalaman,
      select: {
        id: true,
        pemakaianM3: true,
        jmlHargaAir: true,
        beaBeban: true,
        beaAdmin: true,
        airKotor: true,
        lainLain: true,
        totalTagihan: true,
        tarifGolongan: { select: { kode: true, nama: true } },
        pembacaan: {
          select: { standLalu: true, standAkhir: true, kondisi: true },
        },
        pelanggan: {
          select: {
            nomorLangganan: true,
            nama: true,
            alamat: true,
            kelurahan: { select: { nama: true } },
          },
        },
      },
    }),
  ])

  const baris: BarisPelangganDrd[] = tagihan.map((item) => ({
    id: item.id,
    nomorLangganan: item.pelanggan.nomorLangganan,
    nama: item.pelanggan.nama,
    alamat: item.pelanggan.alamat,
    tarif: item.tarifGolongan?.kode.replace("GOL_", "") ?? "—",
    namaTarif: item.tarifGolongan?.nama ?? "Tidak diketahui",
    kelurahan: item.pelanggan.kelurahan?.nama ?? "Tidak diketahui",
    kondisi: item.pembacaan?.kondisi ?? "—",
    standLalu: item.pembacaan?.standLalu ?? null,
    standAkhir: item.pembacaan?.standAkhir ?? null,
    pemakaianM3: item.pemakaianM3,
    hargaAir: item.jmlHargaAir,
    beaBeban: item.beaBeban,
    beaAdmin: item.beaAdmin,
    airKotor: item.airKotor,
    lainLain: item.lainLain,
    totalTagihan: item.totalTagihan,
  }))

  const hasil = {
    baris,
    halaman: params.halaman,
    ukuranHalaman: params.ukuranHalaman,
    total,
    totalHalaman: Math.max(1, Math.ceil(total / params.ukuranHalaman)),
  }

  if (params.tab === "taa") return { ...hasil, tab: "taa" }
  if (params.tab === "tagihan") return { ...hasil, tab: "tagihan" }
  return { ...hasil, tab: "pelanggan" }
}
