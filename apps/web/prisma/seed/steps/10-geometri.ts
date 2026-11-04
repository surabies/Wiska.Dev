// prisma/seed/steps/10-geometri.ts — mengisi kolom geometri PostGIS dari
// dua sumber GeoJSON di prisma/data. Sebelum step ini ada, SEMUA kolom
// geometri kosong (diukur 2026-07-19: 0/21 kelurahan ber-area, 0/22.534
// pelanggan ber-koordinat) sehingga seluruh fitur spasial — auto-tag
// wilayah pengaduan (ST_Contains), /pelanggan/near, peta — tidak punya
// data untuk bekerja.
//
// SUMBER (keduanya arsip immutable, lihat "Filosofi ETL" di prisma/docs/README):
//   1. Area_layanan_Wilayah_5.geojson — 32 MultiPolygon batas kelurahan
//      (properti DESA = nama kelurahan). Dicocokkan ke Kelurahan lewat
//      NAMA (bukan kode: KODE_DESA di file adalah kode Kemendagri
//      3273xxxx, sedangkan Kelurahan.kode di DB adalah kode internal PDAM
//      "KD3" dst — dua sistem kode berbeda tanpa peta silang). Area
//      Kecamatan lalu DITURUNKAN via ST_Union dari kelurahan anggotanya
//      (alasan MultiPolygon: union bagian yang tidak nempel).
//   2. Data_progres_verifikasi_pelanggan_PW_5_2026.geojson — 1.875 titik
//      survei lapangan ber-"Nomor Pelanggan" → Pelanggan.koordinat.
//      INI SATU-SATUNYA sumber koordinat pelanggan: kolom goe_lat/goe_long
//      PBPK terbukti kosong di data sumber (0 baris valid).
//
// Idempoten: update by kode/nomorLangganan; dijalankan ulang aman.
// Geometri ditulis lewat $executeRawUnsafe + parameter posisi (identifier
// dari kode literal di file ini, BUKAN dari input) — aturan yang sama
// dengan server/lib/spatial.ts: JANGAN Prisma.raw().
//
// Wilayah operasional PDAM (WilayahAdm/Dist/SeksiCater/WilayahSeksi/Zona/
// Rute) SENGAJA tidak diisi: tidak ada sumber polygon-nya di prisma/data —
// jangan dikarang; tercatat sebagai warning agar terlihat manusia.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { parseIsoDate, trimOrNull } from "../lib/normalize"

const STEP = "10-geometri"
// Pola path sama dengan lib/csv.ts: relatif cwd (seed dijalankan dari root
// repo via pnpm db:seed), bukan __dirname — tsx/ESM tidak menjaminnya.
const DATA_DIR = join(process.cwd(), "prisma", "data")

interface FiturGeoJson {
  geometry: { type: string; coordinates: unknown } | null
  properties: Record<string, unknown>
}

interface TitikGeoJson {
  longitude: number
  latitude: number
}

function bacaGeoJson(nama: string): FiturGeoJson[] {
  const raw = JSON.parse(readFileSync(join(DATA_DIR, nama), "utf8")) as {
    features?: FiturGeoJson[]
  }
  return raw.features ?? []
}

/// Nama kelurahan dinormalkan untuk pencocokan: kapital + spasi tunggal.
/// Diverifikasi pada data nyata: 21 kelurahan DB semuanya ketemu di 32
/// fitur file (file mencakup wilayah layanan lebih luas dari data
/// pelanggan yang terimpor — sisanya dilewati dengan catatan skipped).
function kunciNama(nama: string): string {
  return nama.toUpperCase().replace(/\s+/g, " ").trim()
}

function teksProperti(fitur: FiturGeoJson, nama: string): string | null {
  const nilai = fitur.properties[nama]
  return typeof nilai === "string" || typeof nilai === "number"
    ? trimOrNull(String(nilai))
    : null
}

function titikSurvei(fitur: FiturGeoJson): TitikGeoJson | null {
  if (fitur.geometry?.type !== "Point" || !Array.isArray(fitur.geometry.coordinates))
    return null
  const [longitude, latitude] = fitur.geometry.coordinates
  if (
    typeof longitude !== "number" ||
    typeof latitude !== "number" ||
    latitude < -8 ||
    latitude > -6 ||
    longitude < 106 ||
    longitude > 109
  )
    return null
  return { longitude, latitude }
}

function nomorEksPelanggan(raw: string | null): string | null {
  if (!raw) return null
  const kandidat = (raw.match(/\d+/g) ?? []).filter(
    (angka) => angka.length >= 8 && angka.length <= 11,
  )
  return kandidat.length === 1 ? kandidat[0]!.padStart(11, "0") : null
}

function periodeSurvei(fitur: FiturGeoJson, report: SeedReport): number {
  const tanggalCabut = teksProperti(fitur, "Tanggal Cabut")
  const tanggalSurvei =
    teksProperti(fitur, "Tanggal Survei") ??
    teksProperti(fitur, "Submitted On")
  const tanggal = parseIsoDate(tanggalCabut) ?? parseIsoDate(tanggalSurvei)
  if (tanggal)
    return tanggal.getUTCFullYear() * 100 + tanggal.getUTCMonth() + 1

  report.warn(
    STEP,
    "Tanggal pencabutan dan tanggal survei tidak terbaca; periode laporan fallback ke Mei 2026 (tanggal pencabutan tetap kosong).",
    { key: teksProperti(fitur, "Response Code") ?? undefined },
  )
  return 202605
}

async function isiAreaKelurahan(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const fitur = bacaGeoJson("Area_layanan_Wilayah_5.geojson")
  const kelurahan = await prisma.kelurahan.findMany({ select: { id: true, nama: true } })
  const byNama = new Map(kelurahan.map((k) => [kunciNama(k.nama), k.id]))

  for (const f of fitur) {
    const nama = kunciNama(String(f.properties["DESA"] ?? f.properties["DESA_KELUR"] ?? ""))
    if (!nama || !f.geometry) {
      report.skipped(STEP)
      continue
    }
    const id = byNama.get(nama)
    if (!id) {
      // Fitur di luar cakupan pelanggan terimpor — bukan error; kelurahan
      // barunya akan otomatis kebagian area saat suatu saat ikut terimpor.
      report.skipped(STEP)
      continue
    }
    // ST_Multi: 29/32 fitur memang MultiPolygon, tapi jaga-jaga bila
    // sumber berikutnya mengirim Polygon tunggal. ST_MakeValid: polygon
    // hasil digitasi kerap punya self-intersection kecil yang membuat
    // ST_Contains diam-diam salah.
    await prisma.$executeRawUnsafe(
      `UPDATE kelurahan
         SET area = ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)))
       WHERE id = $2`,
      JSON.stringify(f.geometry),
      id
    )
    report.updated(STEP)
  }

  // Prisma tidak bisa memfilter kolom Unsupported — hitung via SQL.
  const sisa = await prisma.$queryRawUnsafe<{ kode: string; nama: string }[]>(
    `SELECT kode, nama FROM kelurahan WHERE area IS NULL`
  )
  for (const k of sisa) {
    report.warn(STEP, `Kelurahan ${k.kode} (${k.nama}) tidak ketemu di GeoJSON area layanan — area tetap kosong`, {
      key: k.kode,
    })
  }
}

/// Kecamatan = ST_Union area kelurahan anggotanya (bukan dari file — file
/// hanya menyediakan level kelurahan).
async function turunkanAreaKecamatan(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const jumlah = await prisma.$executeRawUnsafe(
    `UPDATE kecamatan kc
        SET area = sub.gabungan
       FROM (
         SELECT "kecamatanId", ST_Multi(ST_Union(area)) AS gabungan
           FROM kelurahan
          WHERE area IS NOT NULL
          GROUP BY "kecamatanId"
       ) sub
      WHERE sub."kecamatanId" = kc.id`
  )
  for (let i = 0; i < jumlah; i++) report.updated(STEP)
}

async function isiKoordinatPelanggan(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const fitur = bacaGeoJson("Data_progres_verifikasi_pelanggan_PW_5_2026.geojson")
  const pelanggan = await prisma.pelanggan.findMany({
    select: { id: true, nomorLangganan: true },
  })
  const pelangganByNomor = new Map(
    pelanggan.map((row) => [row.nomorLangganan.trim(), row.id]),
  )
  const fiturByNomor = new Map<string, FiturGeoJson[]>()
  const koordinatPelanggan: Array<{
    id: string
    longitude: number
    latitude: number
  }> = []

  for (const f of fitur) {
    if (teksProperti(f, "Status Kepelangganan")?.toLocaleUpperCase("id-ID") !== "PELANGGAN")
      continue
    const nomorMentah = teksProperti(f, "Nomor Pelanggan")?.replace(/\D/g, "")
    if (!nomorMentah) {
      report.skipped(STEP)
      report.warn(STEP, "Survei berstatus pelanggan tidak memiliki nomor pelanggan.", {
        key: teksProperti(f, "Response Code") ?? undefined,
      })
      continue
    }
    const nomor = nomorMentah.padStart(11, "0")
    const baris = fiturByNomor.get(nomor) ?? []
    baris.push(f)
    fiturByNomor.set(nomor, baris)
  }

  for (const [nomor, baris] of fiturByNomor) {
    const id = pelangganByNomor.get(nomor)
    if (!id) {
      report.skipped(STEP)
      report.warn(STEP, "Nomor pelanggan survei tidak ditemukan pada master pelanggan.", {
        key: nomor,
      })
      continue
    }

    const titik = baris.map(titikSurvei)
    if (titik.some((koordinat) => koordinat === null)) {
      report.skipped(STEP)
      report.warn(STEP, "Titik koordinat pelanggan survei tidak valid.", { key: nomor })
      continue
    }
    const koordinatUnik = new Set(
      titik.map((koordinat) =>
        `${koordinat!.longitude.toFixed(7)},${koordinat!.latitude.toFixed(7)}`,
      ),
    )
    if (koordinatUnik.size > 1) {
      report.skipped(STEP)
      report.warn(
        STEP,
        "Nomor pelanggan muncul pada beberapa titik survei yang berbeda; koordinat master tidak ditimpa.",
        { key: nomor },
      )
      continue
    }

    const koordinat = titik[0]!
    koordinatPelanggan.push({ id, ...koordinat })
  }

  if (koordinatPelanggan.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE pelanggan p
          SET koordinat = ST_SetSRID(ST_MakePoint(titik.longitude, titik.latitude), 4326)
         FROM jsonb_to_recordset($1::jsonb) AS titik(
           id text, longitude double precision, latitude double precision
         )
        WHERE p.id = titik.id`,
      JSON.stringify(koordinatPelanggan),
    )
    for (let i = 0; i < koordinatPelanggan.length; i++) report.updated(STEP)
  }
}

async function petaNamaWilayah(prisma: PrismaClientLike) {
  const [kelurahan, kecamatan] = await Promise.all([
    prisma.kelurahan.findMany({
      select: { id: true, nama: true },
    }),
    prisma.kecamatan.findMany({
      select: { id: true, nama: true },
    }),
  ])
  return {
    kelurahan: new Map(kelurahan.map((row) => [kunciNama(row.nama), row.id])),
    kecamatan: new Map(kecamatan.map((row) => [kunciNama(row.nama), row.id])),
  }
}

async function isiPotensiPelanggan(
  prisma: PrismaClientLike,
  report: SeedReport,
): Promise<void> {
  const fitur = bacaGeoJson("Data_progres_verifikasi_pelanggan_PW_5_2026.geojson")
  const wilayah = await petaNamaWilayah(prisma)
  const survei: Array<{
    kodeSurvei: string
    alamat: string
    kategori: string | null
    catatan: string | null
    kelurahanId: string | null
    longitude: number
    latitude: number
  }> = []

  for (const f of fitur) {
    if (
      teksProperti(f, "Status Kepelangganan")?.toLocaleUpperCase("id-ID") !==
      "NON PELANGGAN"
    )
      continue
    const kodeSurvei = teksProperti(f, "Response Code")
    const alamat = teksProperti(f, "Alamat")
    const titik = titikSurvei(f)
    if (!kodeSurvei || !alamat || !titik) {
      report.skipped(STEP)
      report.warn(
        STEP,
        "Survei calon pelanggan tidak memiliki kode, alamat, atau titik valid.",
        { key: kodeSurvei ?? undefined },
      )
      continue
    }

    const kelurahanNama = teksProperti(f, "KELURAHAN")
    const kecamatanNama = teksProperti(f, "KECAMATAN")
    const kelurahanId = kelurahanNama
      ? wilayah.kelurahan.get(kunciNama(kelurahanNama))
      : undefined
    if (!kelurahanId) {
      report.warn(STEP, "Kelurahan calon pelanggan tidak cocok dengan master wilayah.", {
        key: kodeSurvei,
      })
    }
    if (
      kecamatanNama &&
      !wilayah.kecamatan.has(kunciNama(kecamatanNama))
    ) {
      report.warn(STEP, "Kecamatan calon pelanggan tidak cocok dengan master wilayah.", {
        key: kodeSurvei,
      })
    }

    survei.push({
      kodeSurvei,
      alamat,
      kategori: teksProperti(f, "Kategori Pelanggan"),
      catatan: teksProperti(f, "Catatan Survei"),
      kelurahanId: kelurahanId ?? null,
      ...titik,
    })
  }

  if (survei.length > 0) {
    const dibuat = await prisma.potensiPelanggan.createMany({
      data: survei.map((data) => ({
        kodeSurvei: data.kodeSurvei,
        alamat: data.alamat,
        kategori: data.kategori,
        catatan: data.catatan,
        kelurahanId: data.kelurahanId,
        status: "PROSPEK",
      })),
      skipDuplicates: true,
    })
    await prisma.$executeRawUnsafe(
      `UPDATE potensi_pelanggan p
          SET alamat = survei.alamat,
              kategori = survei.kategori,
              catatan = survei.catatan,
              "kelurahanId" = survei."kelurahanId",
              koordinat = ST_SetSRID(ST_MakePoint(survei.longitude, survei.latitude), 4326),
              "updatedAt" = CURRENT_TIMESTAMP
         FROM jsonb_to_recordset($1::jsonb) AS survei(
           "kodeSurvei" text, alamat text, kategori text, catatan text,
           "kelurahanId" text, longitude double precision, latitude double precision
         )
        WHERE p."kodeSurvei" = survei."kodeSurvei"`,
      JSON.stringify(survei),
    )
    for (let i = 0; i < dibuat.count; i++) report.created(STEP)
    for (let i = dibuat.count; i < survei.length; i++) report.updated(STEP)
  }
}

async function isiEksPelanggan(
  prisma: PrismaClientLike,
  report: SeedReport,
): Promise<void> {
  const fitur = bacaGeoJson("Data_progres_verifikasi_pelanggan_PW_5_2026.geojson")
  const wilayah = await petaNamaWilayah(prisma)
  const pelanggan = await prisma.pelanggan.findMany({
    select: { id: true, nama: true, nomorLangganan: true },
  })
  const pelangganByNomor = new Map(
    pelanggan.map((row) => [
      row.nomorLangganan.trim(),
      { id: row.id, nama: row.nama },
    ]),
  )
  const survei: Array<{
    kodeSurvei: string
    pelangganId: string | null
    kelurahanId: string | null
    kecamatanId: string | null
    nomorLangganan: string | null
    namaPelanggan: string | null
    periode: number
    tanggalCabut: Date | null
    catatanSurveiAsli: string | null
    catatan: string | null
    longitude: number
    latitude: number
  }> = []

  for (const f of fitur) {
    if (
      teksProperti(f, "Status Kepelangganan")?.toLocaleUpperCase("id-ID") !==
      "EKS PELANGGAN"
    )
      continue
    const kodeSurvei = teksProperti(f, "Response Code")
    const titik = titikSurvei(f)
    if (!kodeSurvei || !titik) {
      report.skipped(STEP)
      report.warn(STEP, "Survei eks-pelanggan tidak memiliki kode atau titik valid.", {
        key: kodeSurvei ?? undefined,
      })
      continue
    }

    const catatanSurveiAsli = teksProperti(f, "Nomor Eks Pelanggan")
    const nomor = nomorEksPelanggan(catatanSurveiAsli)
    const pelangganTerkait = nomor ? pelangganByNomor.get(nomor) : undefined
    if (catatanSurveiAsli && !nomor) {
      report.warn(
        STEP,
        "Nomor eks-pelanggan tidak dapat dipasangkan secara pasti; teks asli tetap disimpan.",
        { key: kodeSurvei },
      )
    } else if (nomor && !pelangganTerkait) {
      report.warn(
        STEP,
        "Nomor eks-pelanggan hasil parsing tidak ditemukan pada master; nomor dan teks asli tetap disimpan.",
        { key: kodeSurvei },
      )
    }
    const tanggalCabut = parseIsoDate(teksProperti(f, "Tanggal Cabut"))
    const periode = periodeSurvei(f, report)
    const kelurahanNama = teksProperti(f, "KELURAHAN")
    const kecamatanNama = teksProperti(f, "KECAMATAN")
    const kelurahanId = kelurahanNama
      ? wilayah.kelurahan.get(kunciNama(kelurahanNama))
      : undefined
    const kecamatanId = kecamatanNama
      ? wilayah.kecamatan.get(kunciNama(kecamatanNama))
      : undefined
    if (!kelurahanId || !kecamatanId) {
      report.warn(STEP, "Wilayah survei eks-pelanggan tidak lengkap atau tidak cocok.", {
        key: kodeSurvei,
      })
    }

    survei.push({
      kodeSurvei,
      pelangganId: pelangganTerkait?.id ?? null,
      kelurahanId: kelurahanId ?? null,
      kecamatanId: kecamatanId ?? null,
      nomorLangganan: nomor,
      namaPelanggan: pelangganTerkait?.nama ?? null,
      periode,
      tanggalCabut,
      catatanSurveiAsli,
      catatan: teksProperti(f, "Catatan Survei"),
      ...titik,
    })
  }

  if (survei.length > 0) {
    const dibuat = await prisma.pemutusan.createMany({
      data: survei.map((data) => ({
        kodeSurvei: data.kodeSurvei,
        pelangganId: data.pelangganId,
        kelurahanId: data.kelurahanId,
        kecamatanId: data.kecamatanId,
        nomorLangganan: data.nomorLangganan,
        namaPelanggan: data.namaPelanggan,
        periode: data.periode,
        tanggalCabut: data.tanggalCabut,
        catatanSurveiAsli: data.catatanSurveiAsli,
        catatan: data.catatan,
        jenis: "LAINNYA",
        sumberData: "SURVEI_GEOJSON",
      })),
      skipDuplicates: true,
    })
    await prisma.$executeRawUnsafe(
      `UPDATE pemutusan p
          SET "pelangganId" = survei."pelangganId",
              "kelurahanId" = survei."kelurahanId",
              "kecamatanId" = survei."kecamatanId",
              "nomorLangganan" = survei."nomorLangganan",
              "namaPelanggan" = survei."namaPelanggan",
              periode = survei.periode,
              "tanggalCabut" = survei."tanggalCabut",
              "catatanSurveiAsli" = survei."catatanSurveiAsli",
              catatan = survei.catatan,
              "koordinatVerifikasi" =
                ST_SetSRID(ST_MakePoint(survei.longitude, survei.latitude), 4326),
              "updatedAt" = CURRENT_TIMESTAMP
         FROM jsonb_to_recordset($1::jsonb) AS survei(
           "kodeSurvei" text, "pelangganId" text, "kelurahanId" text,
           "kecamatanId" text, "nomorLangganan" text, "namaPelanggan" text,
           periode integer, "tanggalCabut" timestamptz, "catatanSurveiAsli" text,
           catatan text, longitude double precision, latitude double precision
         )
        WHERE p."kodeSurvei" = survei."kodeSurvei"`,
      JSON.stringify(survei),
    )
    for (let i = 0; i < dibuat.count; i++) report.created(STEP)
    for (let i = dibuat.count; i < survei.length; i++) report.updated(STEP)
  }
}

export async function seedGeometri(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  await isiAreaKelurahan(prisma, report)
  await turunkanAreaKecamatan(prisma, report)
  await isiKoordinatPelanggan(prisma, report)
  await isiPotensiPelanggan(prisma, report)
  await isiEksPelanggan(prisma, report)

  report.warn(
    STEP,
    "Area wilayah operasional PDAM (WilayahAdm/Dist/SeksiCater/WilayahSeksi/Zona/Rute) belum ada sumber polygon-nya di prisma/data — tetap kosong sampai file batasnya tersedia"
  )
}
