// server/lib/spatial.ts — satu-satunya tempat raw SQL PostGIS dipanggil.
// Kolom geometry Prisma dideklarasikan Unsupported(...) sehingga TIDAK bisa
// dibaca/ditulis lewat query builder biasa (lihat panduan di
// prisma/docs/README.md) — semua akses lewat raw SQL di sini.
//
// KENAPA $queryRawUnsafe / $executeRawUnsafe, BUKAN tagged template
// $queryRaw + Prisma.raw()?
// Versi tagged-template SUDAH DICOBA dan TERBUKTI RUSAK di dev: nama tabel/
// kolom yang dibungkus Prisma.raw() diam-diam di-bind sebagai PARAMETER,
// bukan di-inline sebagai SQL, sehingga query jadi `... FROM $3` dan
// Postgres menolak dengan `syntax error at or near "$3"` (Prisma P2010).
// Sebabnya: Prisma memutuskan inline-vs-bind lewat cek `instanceof Sql`.
// PrismaClient di-cache di globalThis (lib/prisma.ts, wajib supaya dev tidak
// kehabisan koneksi), sementara HMR Next.js me-reload modul ini beserta
// namespace `Prisma`-nya — hasilnya objek Sql dari CLASS yang berbeda dengan
// milik runtime client yang ter-cache, `instanceof` gagal, fragmen raw jatuh
// jadi parameter. Reprodusibel: fresh start jalan, sekali file ini kena HMR
// semua query geo 500. `$queryRawUnsafe` menerima string biasa + positional
// params, tidak melibatkan objek Sql sama sekali, jadi kebal masalah ini di
// dev maupun produksi.
//
// KEAMANAN (kenapa "Unsafe" di sini tetap aman): satu-satunya bagian yang
// di-inline ke string SQL adalah IDENTIFIER (nama tabel/kolom), dan itu
// SELALU berasal dari konstanta GEO di bawah — tidak pernah dari request
// body/query string. ident() juga mem-validasi bentuk nama sebagai
// defense-in-depth. SEMUA nilai turunan user (koordinat, id, radius, limit)
// dikirim lewat positional parameter ($1, $2, ...), bukan interpolasi
// string.
import type { Prisma } from "@db"

export interface GeoColumnConfig {
  /** Nama tabel fisik (@@map), bukan nama model Prisma. */
  table: string
  /** Kolom geometry, mis. "koordinat" / "area". */
  column: string
  /** Default "id". */
  idColumn?: string
}

/** Konfigurasi kolom geometry per model — daftar tunggal supaya tidak
 * bertebaran nama tabel/kolom hardcoded di banyak file service. Ini juga
 * yang berfungsi sebagai whitelist identifier untuk ident(). */
export const GEO = {
  pelanggan: { table: "pelanggan", column: "koordinat" },
  pengaduan: { table: "pengaduan", column: "koordinat" },
  // Field-field ini TIDAK punya @map di schema (beda dari nama tabelnya
  // yang @@map snake_case) -> nama kolom fisik tetap persis camelCase asli.
  mutasiPelanggan: { table: "mutasi_pelanggan", column: "koordinatMutasi" },
  pemutusan: { table: "pemutusan", column: "koordinatVerifikasi" },
  potensiPelanggan: { table: "potensi_pelanggan", column: "koordinat" },
  wilayahAdm: { table: "wilayah_adm", column: "area" },
  wilayahDist: { table: "wilayah_dist", column: "area" },
  seksiCater: { table: "seksi_cater", column: "area" },
  wilayahSeksi: { table: "wilayah_seksi", column: "area" },
  zona: { table: "zona", column: "area" },
  rute: { table: "rute", column: "area" },
  kecamatan: { table: "kecamatan", column: "area" },
  kelurahan: { table: "kelurahan", column: "area" },
} as const satisfies Record<string, GeoColumnConfig>

export interface GeoJsonPoint {
  type: "Point"
  coordinates: [number, number]
}

export interface GeoJsonGeometry {
  type: string
  coordinates: unknown
}

/** Client raw-SQL — cocok untuk `prisma` singleton maupun `tx` di dalam
 * `$transaction(async (tx) => ...)`. */
type SpatialClient = Prisma.TransactionClient

/** Quote identifier + pastikan bentuknya memang identifier polos.
 * Defense-in-depth: semua pemanggil sudah mengoper konstanta dari GEO,
 * assert ini yang membuat sifat aman itu terlihat di titik pemakaian dan
 * langsung meledak kalau suatu saat ada yang mengoper nilai dinamis. */
function ident(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Identifier SQL tidak valid: ${name}`)
  }
  return `"${name}"`
}

function cols(cfg: GeoColumnConfig) {
  return {
    table: ident(cfg.table),
    column: ident(cfg.column),
    id: ident(cfg.idColumn ?? "id"),
  }
}

export async function setPoint(
  client: SpatialClient,
  cfg: GeoColumnConfig,
  id: string,
  lat: number,
  lng: number,
) {
  const { table, column, id: idCol } = cols(cfg)
  await client.$executeRawUnsafe(
    `UPDATE ${table} SET ${column} = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE ${idCol} = $3`,
    lng,
    lat,
    id,
  )
}

/** Generik: berlaku untuk kolom geometry apapun (point maupun area). */
export async function clearGeometry(
  client: SpatialClient,
  cfg: GeoColumnConfig,
  id: string,
) {
  const { table, column, id: idCol } = cols(cfg)
  await client.$executeRawUnsafe(
    `UPDATE ${table} SET ${column} = NULL WHERE ${idCol} = $1`,
    id,
  )
}

export const clearPoint = clearGeometry
export const clearArea = clearGeometry

export async function getPointGeoJson(
  client: SpatialClient,
  cfg: GeoColumnConfig,
  id: string,
): Promise<GeoJsonPoint | null> {
  const { table, column, id: idCol } = cols(cfg)
  const rows = await client.$queryRawUnsafe<{ geojson: GeoJsonPoint | null }[]>(
    `SELECT ST_AsGeoJSON(${column})::json AS geojson FROM ${table} WHERE ${idCol} = $1`,
    id,
  )
  return rows[0]?.geojson ?? null
}

function placeholders(count: number, offset = 0): string {
  return Array.from({ length: count }, (_, i) => `$${i + 1 + offset}`).join(
    ", ",
  )
}

async function getGeoJsonMany<T>(
  client: SpatialClient,
  cfg: GeoColumnConfig,
  ids: string[],
): Promise<Map<string, T>> {
  if (ids.length === 0) return new Map()
  const { table, column, id: idCol } = cols(cfg)
  const rows = await client.$queryRawUnsafe<
    { id: string; geojson: T | null }[]
  >(
    `SELECT ${idCol} AS id, ST_AsGeoJSON(${column})::json AS geojson FROM ${table} WHERE ${idCol} IN (${placeholders(ids.length)})`,
    ...ids,
  )
  return new Map(
    rows
      .filter((r): r is { id: string; geojson: T } => r.geojson !== null)
      .map((r) => [r.id, r.geojson]),
  )
}

/** Varian batch untuk endpoint list (hindari N query per baris). */
export function getPointGeoJsonMany(
  client: SpatialClient,
  cfg: GeoColumnConfig,
  ids: string[],
): Promise<Map<string, GeoJsonPoint>> {
  return getGeoJsonMany<GeoJsonPoint>(client, cfg, ids)
}

/** Varian batch untuk endpoint list. */
export function getAreaGeoJsonMany(
  client: SpatialClient,
  cfg: GeoColumnConfig,
  ids: string[],
): Promise<Map<string, GeoJsonGeometry>> {
  return getGeoJsonMany<GeoJsonGeometry>(client, cfg, ids)
}

export async function setArea(
  client: SpatialClient,
  cfg: GeoColumnConfig,
  id: string,
  geojson: GeoJsonGeometry,
) {
  const { table, column, id: idCol } = cols(cfg)
  await client.$executeRawUnsafe(
    `UPDATE ${table} SET ${column} = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) WHERE ${idCol} = $2`,
    JSON.stringify(geojson),
    id,
  )
}

export async function getAreaGeoJson(
  client: SpatialClient,
  cfg: GeoColumnConfig,
  id: string,
): Promise<GeoJsonGeometry | null> {
  const { table, column, id: idCol } = cols(cfg)
  const rows = await client.$queryRawUnsafe<
    { geojson: GeoJsonGeometry | null }[]
  >(
    `SELECT ST_AsGeoJSON(${column})::json AS geojson FROM ${table} WHERE ${idCol} = $1`,
    id,
  )
  return rows[0]?.geojson ?? null
}

export interface NearbyResult {
  id: string
  jarakMeter: number
}

/** Cari baris dalam radius X meter dari titik, urut terdekat. Pakai cast
 * ::geography supaya ST_DWithin/ST_Distance dihitung dalam meter, bukan
 * derajat (kolom disimpan sebagai geometry SRID 4326).
 * Placeholder $1/$2 (lng/lat) sengaja DIPAKAI ULANG di ST_Distance maupun
 * ST_DWithin — Postgres mengizinkan itu, jadi titiknya cukup dikirim sekali. */
export async function findNearby(
  client: SpatialClient,
  cfg: GeoColumnConfig,
  params: { lat: number; lng: number; radiusMeters: number; limit?: number },
): Promise<NearbyResult[]> {
  const { lat, lng, radiusMeters, limit = 50 } = params
  const { table, column, id: idCol } = cols(cfg)
  return client.$queryRawUnsafe<NearbyResult[]>(
    `SELECT ${idCol} AS id,
       ST_Distance(${column}::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS "jarakMeter"
     FROM ${table}
     WHERE ${column} IS NOT NULL
       AND ST_DWithin(${column}::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
     ORDER BY "jarakMeter"
     LIMIT $4`,
    lng,
    lat,
    radiusMeters,
    limit,
  )
}

/** Reverse lookup titik-dalam-poligon: cari baris (mis. Kelurahan/Zona)
 * yang areanya mengandung titik (lat, lng). Null kalau tidak ada yang cocok. */
export async function findContaining(
  client: SpatialClient,
  cfg: GeoColumnConfig,
  lat: number,
  lng: number,
): Promise<string | null> {
  const { table, column, id: idCol } = cols(cfg)
  const rows = await client.$queryRawUnsafe<{ id: string }[]>(
    `SELECT ${idCol} AS id
     FROM ${table}
     WHERE ${column} IS NOT NULL
       AND ST_Contains(${column}, ST_SetSRID(ST_MakePoint($1, $2), 4326))
     LIMIT 1`,
    lng,
    lat,
  )
  return rows[0]?.id ?? null
}
