// features/dashboard/components/verifikasi/tipe.ts — bentuk data /api/v1
// yang dipakai halaman verifikasi (subset kolom yang benar-benar dibaca UI,
// bukan salinan penuh model Prisma — backend boleh mengirim lebih).

export interface StatsVerifikasi {
  total: number
  menunggu: number
  diverifikasi: number
  ditolak: number
  /** Hanya ada di /laporan-harian/stats. */
  anomali?: number
  ambangAnomali?: number
  /** Periode (thbl) yang punya data, terbaru dulu — bahan dropdown filter. */
  periodes: number[]
}

export interface PelangganRingkas {
  id: string
  nomorLangganan: string
  nama: string
  alamat?: string | null
  geoLat?: number | null
  geoLong?: number | null
  /** Turunan untuk kolom tabel verifikasi (Tarif/RUTE/W/ZONA) — hanya
   *  dikirim endpoint list /laporan-harian. */
  tarifGolongan?: { kodeAsli: string } | null
  rute?: { kode: string } | null
  zona?: { kode: string; wilayahSeksi?: { kode: string } | null } | null
}

export interface MeterRingkas {
  id: string
  nomorMeter: string
  merkKode?: string | null
  isAktif: boolean
}

export interface PembacaanRingkas {
  id: string
  /** ISO DateTime (tanggal 1 bulan periode). */
  periode: string
  standLalu: number
  standAkhir: number
  pemakaianM3: number
  pemakaianRiil?: number | null
  blokTarif: number
  fotoBukti?: string | null
  sumberLaporan?: "PETUGAS" | "KONSUMEN" | null
}

export interface LaporanHarianDetail {
  id: string
  nomorLangganan: string
  pelangganId?: string | null
  namaPelanggan?: string | null
  alamatPelanggan?: string | null
  periode: number
  standAwal: number
  standAkhir: number
  pemakaian: number
  pemakaianLalu?: number | null
  persentase?: number | null
  kondisi: string
  kategori: string
  nomorMeter?: string | null
  tanggalCatat?: string | null
  isVerified: boolean
  verifiedAt?: string | null
  catatanVerif?: string | null
  pembacaanId?: string | null
  /** Ring verifikasi berjenjang V1 (Supervisor) → V2 (Manager) → V3
   *  (Senior Manager). Pembacaan resmi dibuat saat V3. */
  verif1At?: string | null
  verif2At?: string | null
  verif3At?: string | null
  verif1By?: { id: string; name: string | null } | null
  verif2By?: { id: string; name: string | null } | null
  verif3By?: { id: string; name: string | null } | null
  /** "ST akhir revisi" — koreksi V1; standAkhir (catat) tidak ditimpa. */
  standAkhirRevisi?: number | null
  standAngkatLama?: number | null
  standAwalMeterBaru?: number | null
  pemakaianTagihVerif?: number | null
  meterVerifId?: string | null
  blokTarifVerif?: number | null
  meterVerif?: { id: string; nomorMeter: string } | null
  /** Tiga foto bukti dari aplikasi petugas (tab Stand/Segel/Rumah). */
  fotoStandUrl?: string | null
  fotoSegelUrl?: string | null
  fotoRumahUrl?: string | null
  pelanggan?: PelangganRingkas | null
  pencatat?: { id: string; namaLapangan: string } | null
  pembacaan?: PembacaanRingkas | null
  verifiedBy?: { id: string; name: string | null } | null
}

export interface LaporanMandiriDetail {
  id: string
  pelangganId: string
  nomorLangganan: string
  periode: number
  standDilaporkan: number
  fotoUrl: string
  nomorPelapor: string
  namaPelapor: string
  status: "MENUNGGU" | "DIVERIFIKASI" | "DITOLAK" | "DIGUNAKAN"
  alasanDitolak?: string | null
  verifiedAt?: string | null
  pembacaanId?: string | null
  createdAt: string
  pelanggan?: PelangganRingkas | null
  pembacaan?: PembacaanRingkas | null
  verifiedBy?: { id: string; name: string | null } | null
}

/** Status verifikasi turunan laporan harian — cermin WHERE_STATUS_VERIF di
 *  server/modules/laporan/laporan-harian.router.ts. */
export function statusLaporanHarian(row: { isVerified?: unknown; verifiedAt?: unknown }): "MENUNGGU" | "DIVERIFIKASI" | "DITOLAK" {
  if (row.isVerified) return "DIVERIFIKASI"
  return row.verifiedAt ? "DITOLAK" : "MENUNGGU"
}

/** Bentuk minimum baris laporan harian yang dibutuhkan derivasi tahap &
 *  aksi menu konteks — dipenuhi baris grid maupun LaporanHarianDetail. */
export interface RingLaporanHarian {
  isVerified?: unknown
  verifiedAt?: unknown
  pembacaanId?: unknown
  verif1At?: unknown
  verif2At?: unknown
  verif3At?: unknown
}

/** Tahap alur berjenjang V1→V2→V3 — lebih halus dari statusLaporanHarian:
 *  membedakan posisi antrean di antara ketiga ring. */
export type TahapVerifikasi = "MENUNGGU_V1" | "MENUNGGU_V2" | "MENUNGGU_V3" | "RESMI" | "DITOLAK"

/** Nama pengoreksi per ring untuk kolom V1/V2/V3 (null = ring belum diisi).
 *  Baris hasil sistem lama (final tanpa jejak ring) memakai nama verifikator
 *  legacy di ketiga kolom supaya tidak terbaca "belum diverifikasi". */
export function ringVerif(row: {
  isVerified?: unknown
  pembacaanId?: unknown
  verif1At?: unknown
  verif2At?: unknown
  verif3At?: unknown
  verif1By?: { name: string | null } | null
  verif2By?: { name: string | null } | null
  verif3By?: { name: string | null } | null
  verifiedBy?: { name: string | null } | null
}): { v1: string | null; v2: string | null; v3: string | null } {
  const legacy =
    (row.isVerified || row.pembacaanId) && !row.verif1At
      ? (row.verifiedBy?.name ?? "✓")
      : null
  return {
    v1: row.verif1At ? (row.verif1By?.name ?? "✓") : legacy,
    v2: row.verif2At ? (row.verif2By?.name ?? "✓") : legacy,
    v3: row.verif3At ? (row.verif3By?.name ?? "✓") : legacy,
  }
}

export function tahapLaporanHarian(row: RingLaporanHarian): TahapVerifikasi {
  if (row.isVerified || row.pembacaanId) return "RESMI"
  // reject mereset semua ring, jadi verifiedAt tanpa isVerified = DITOLAK.
  if (row.verifiedAt) return "DITOLAK"
  if (row.verif2At) return "MENUNGGU_V3"
  if (row.verif1At) return "MENUNGGU_V2"
  return "MENUNGGU_V1"
}
