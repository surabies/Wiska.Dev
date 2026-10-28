import "server-only"

// features/beranda/lib/peta.ts — data peta cakupan layanan untuk beranda,
// dari batas kelurahan/kecamatan ASLI (PostGIS, sama sumbernya dengan peta
// wilayah dashboard — lihat features/dashboard/lib/geo-queries.ts) plus
// titik sambungan pelanggan yang berkoordinat. BUKAN ilustrasi/peta dunia
// generik ala komponen showcase — bentuknya benar-benar batas administratif
// Kota Bandung yang tersimpan di database.
//
// Proyeksi ke SVG dihitung DI SINI (server), bukan di browser — hasilnya
// cuma angka koordinat x/y siap pakai, jadi komponen client tidak perlu
// membawa library peta (MapLibre dkk) ke halaman publik yang seharusnya
// ringan. Kelurahan.area 100% MultiPolygon di sumbernya (beberapa punya
// 2-4 bagian terpisah, lihat PEMETAAN-DATA.md) — proyeksi ini menangani
// itu dengan menggabungkan tiap bagian jadi satu subpath SVG.
//
// PRIVASI: hanya KOORDINAT pelanggan yang diambil (bukan nama/nomor
// langganan) — titik-titik itu jadi dekorasi kepadatan sambungan, bukan
// data yang bisa dilacak balik ke pelanggan tertentu.
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import type { WilayahJalur, ParamProyeksi, PetaCakupan } from "./peta-tipe"

// Tipe diekspor-ulang (bukan didefinisikan di sini) supaya pemanggil lama
// tidak perlu ganti import path — definisi aslinya di peta-tipe.ts, file
// TANPA "server-only" yang aman diimpor komponen client. Lihat komentar
// panjang di peta-tipe.ts kenapa pemisahan ini penting.
export type { WilayahJalur, ParamProyeksi, PetaCakupan }

type Cincin = [number, number][]
type GeomArea =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] }

const LEBAR = 800
const TINGGI = 600
const PADDING = 24

function cincinLuar(geom: GeomArea): Cincin[] {
  if (geom.type === "Polygon") return [geom.coordinates[0] as Cincin]
  return geom.coordinates.map((poly) => poly[0] as Cincin)
}

const JUMLAH_WARNA = 3

// Pola & alasannya PERSIS sama dengan features/dashboard/lib/geo-queries.ts
// (warnaPerKelurahan) — diduplikasi (bukan diimpor) karena file itu ada di
// features/dashboard (khusus akses petugas login) sedangkan ini dipakai
// beranda publik; keduanya tidak seharusnya saling impor lintas domain.
// Kelurahan yang BERSINGGUNGAN (ST_Touches) tidak boleh sewarna, supaya
// batas antar-wilayah kebaca jelas alih-alih menyatu jadi satu bidang rata.
async function warnaPerKelurahan(id: string[]): Promise<Map<string, number>> {
  if (id.length === 0) return new Map()

  const sisi = await prisma.$queryRawUnsafe<Array<{ a: string; b: string }>>(
    `SELECT a.id AS a, b.id AS b
       FROM kelurahan a
       JOIN kelurahan b ON a.id < b.id AND ST_Touches(a.area, b.area)
      WHERE a.area IS NOT NULL AND b.area IS NOT NULL`
  )

  const tetangga = new Map<string, Set<string>>(id.map((x) => [x, new Set<string>()]))
  for (const { a, b } of sisi) {
    tetangga.get(a)?.add(b)
    tetangga.get(b)?.add(a)
  }

  const urut = [...id].sort((x, y) => (tetangga.get(y)?.size ?? 0) - (tetangga.get(x)?.size ?? 0))
  const warna = new Map<string, number>()
  for (const k of urut) {
    const terpakai = new Set<number>()
    for (const t of tetangga.get(k) ?? []) {
      const w = warna.get(t)
      if (w !== undefined) terpakai.add(w)
    }
    let pilih = 0
    while (pilih < JUMLAH_WARNA && terpakai.has(pilih)) pilih++
    warna.set(k, pilih)
  }
  return warna
}

async function hitungPetaCakupan(): Promise<PetaCakupan> {
  {
    const [baris_kelurahan, baris_kecamatan, baris_titik] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ id: string; nama: string; geom: GeomArea }>>(
        `SELECT id, nama, ST_AsGeoJSON(area)::json AS geom FROM kelurahan WHERE area IS NOT NULL`
      ),
      prisma.$queryRawUnsafe<Array<{ id: string; nama: string; geom: GeomArea }>>(
        `SELECT id, nama, ST_AsGeoJSON(area)::json AS geom FROM kecamatan WHERE area IS NOT NULL`
      ),
      prisma.$queryRawUnsafe<Array<{ lng: number; lat: number }>>(
        `SELECT ST_X(koordinat) AS lng, ST_Y(koordinat) AS lat
         FROM pelanggan WHERE koordinat IS NOT NULL AND "deletedAt" IS NULL`
      ),
    ])

    if (baris_kelurahan.length === 0) {
      return {
        lebar: LEBAR,
        tinggi: TINGGI,
        kelurahan: [],
        kecamatan: [],
        titikPelanggan: [],
        proyeksi: { minLng: 0, maxLat: 0, skala: 1, offsetX: 0, offsetY: 0 },
        geoJson: {
          kelurahan: { type: "FeatureCollection", features: [] },
          kecamatan: { type: "FeatureCollection", features: [] },
          pelanggan: { type: "FeatureCollection", features: [] },
        },
      }
    }

    // Kotak pembatas dihitung dari SEMUA titik kelurahan+kecamatan sekaligus
    // supaya dua lapisan itu terproyeksi di sistem koordinat yang sama persis
    // (garis kecamatan wajib pas menutupi tepi gabungan kelurahannya).
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity
    for (const baris of [...baris_kelurahan, ...baris_kecamatan]) {
      for (const cincin of cincinLuar(baris.geom)) {
        for (const [lng, lat] of cincin) {
          if (lng < minLng) minLng = lng
          if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        }
      }
    }

    const rentangLng = maxLng - minLng || 1
    const rentangLat = maxLat - minLat || 1
    const tersedia_w = LEBAR - PADDING * 2
    const tersedia_h = TINGGI - PADDING * 2
    // Skala SERAGAM (bukan stretch independen x/y) supaya bentuk wilayah
    // tidak gepeng — sisi yang lebih longgar dipusatkan lewat offset.
    const skala = Math.min(tersedia_w / rentangLng, tersedia_h / rentangLat)
    const offsetX = PADDING + (tersedia_w - rentangLng * skala) / 2
    const offsetY = PADDING + (tersedia_h - rentangLat * skala) / 2

    function proyeksi(lng: number, lat: number): [number, number] {
      const x = offsetX + (lng - minLng) * skala
      const y = offsetY + (maxLat - lat) * skala // lat makin besar -> makin ke utara -> y makin kecil
      return [x, y]
    }

    function jalurDari(geom: GeomArea): string {
      return cincinLuar(geom)
        .map((cincin) =>
          cincin
            .map(([lng, lat], i) => {
              const [x, y] = proyeksi(lng, lat)
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
            })
            .join(" ") + " Z"
        )
        .join(" ")
    }

    const warna = await warnaPerKelurahan(baris_kelurahan.map((b) => b.id))
    const kelurahan = baris_kelurahan.map((b) => ({
      id: b.id,
      nama: b.nama,
      d: jalurDari(b.geom),
      warna: warna.get(b.id) ?? 0,
    }))
    const kecamatan = baris_kecamatan.map((b) => ({ id: b.id, nama: b.nama, d: jalurDari(b.geom) }))
    const titikPelanggan = baris_titik.map((t): [number, number] => proyeksi(t.lng, t.lat))

    const geoJson = {
      kelurahan: {
        type: "FeatureCollection" as const,
        features: baris_kelurahan.map((b) => ({
          type: "Feature" as const,
          geometry: b.geom,
          properties: { id: b.id, nama: b.nama, warna: warna.get(b.id) ?? 0 },
        })),
      },
      kecamatan: {
        type: "FeatureCollection" as const,
        features: baris_kecamatan.map((b) => ({
          type: "Feature" as const,
          geometry: b.geom,
          properties: { id: b.id, nama: b.nama },
        })),
      },
      pelanggan: {
        type: "FeatureCollection" as const,
        features: baris_titik.map((t, i) => ({
          type: "Feature" as const,
          geometry: { type: "Point", coordinates: [t.lng, t.lat] },
          properties: { id: i },
        })),
      },
    }

    return {
      lebar: LEBAR,
      tinggi: TINGGI,
      kelurahan,
      kecamatan,
      titikPelanggan,
      proyeksi: { minLng, maxLat, skala, offsetX, offsetY },
      geoJson,
    }
  }
}

// Key cache SENGAJA diberi akhiran "-v2": versi pertama sempat kadung
// menyimpan hasil KOSONG (di-cache sebelum step geometri PostGIS
// dijalankan) dan hasil kosong itu tetap tersaji walau data sudah terisi
// dan `.next/cache` sudah dihapus manual + dev server di-restart penuh —
// tandanya Next.js/Turbopack menyimpan Data Cache di tempat lain yang
// tidak ikut terhapus. Ganti key adalah cara PALING PASTI menghindari
// entri basi tanpa harus tahu persis di mana cache itu bersembunyi.
export const getPetaCakupan = unstable_cache(hitungPetaCakupan, ["peta-cakupan-beranda-v2"], {
  // Batas wilayah & koordinat sambungan nyaris tidak pernah berubah — 1
  // hari cukup, jauh lebih longgar dari cache angka stats.ts (1 jam).
  revalidate: 86400,
})
