// server/modules/pengaduan/wilayah.ts — auto-tag wilayah kejadian dari
// koordinat tiket via PostGIS ST_Contains (lihat findContaining di
// server/lib/spatial.ts). Dipakai kedua kanal pembuatan tiket (v1 petugas
// dan publik warga) supaya operator/supervisor bisa menyaring antrean per
// kelurahan/kecamatan tanpa menebak dari alamat teks.
import type { Prisma } from "@db"
import { GEO, findContaining } from "../../lib/spatial"

export interface WilayahKejadian {
  kelurahanId: string | null
  kecamatanId: string | null
}

/// Cari kelurahan yang memuat titik; kecamatan diambil dari relasi
/// kelurahan-nya (satu query polygon, bukan dua) — fallback ST_Contains
/// kecamatan hanya bila titik jatuh di celah antar-kelurahan (batas union
/// tidak selalu rapat).
export async function tandaiWilayah(
  tx: Prisma.TransactionClient,
  lat: number,
  lng: number,
): Promise<WilayahKejadian> {
  const kelurahanId = await findContaining(tx, GEO.kelurahan, lat, lng)
  if (kelurahanId) {
    const kelurahan = await tx.kelurahan.findUnique({
      where: { id: kelurahanId },
      select: { kecamatanId: true },
    })
    return { kelurahanId, kecamatanId: kelurahan?.kecamatanId ?? null }
  }
  const kecamatanId = await findContaining(tx, GEO.kecamatan, lat, lng)
  return { kelurahanId: null, kecamatanId }
}
