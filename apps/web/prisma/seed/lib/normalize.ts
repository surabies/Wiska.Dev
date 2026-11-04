// prisma/seed/lib/normalize.ts — fungsi normalisasi MURNI (tanpa efek
// samping, tidak menyentuh Prisma/DB) untuk membersihkan nilai mentah CSV
// legacy. Semua fungsi mengembalikan `null` untuk input tidak valid/kosong
// alih-alih throw, supaya caller (steps/*.ts) yang memutuskan: skip baris,
// pakai default, atau log sebagai warning — normalisasi sendiri tidak
// pernah menjatuhkan proses.
//
// Setiap aturan di sini punya alasan spesifik yang ditemukan saat audit
// data mentah (lihat prisma/docs/README.md) — JANGAN sederhanakan tanpa cek
// alasannya dulu.

import type {
  GolonganTarif,
  KondisiCatat,
  UkuranMeter,
} from "@generated"

export function trimOrNull(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  return trimmed === "" ? null : trimmed
}

/// nolg/nomor_pelanggan WAJIB 11 karakter zero-padded (Pelanggan.
/// nomorLangganan adalah Char(11)). PBPK & r-nomor menyimpan nolg 9 digit
/// TANPA padding — tanpa fungsi ini, lookup/insert akan mismatch dengan
/// nolg 11-digit di ProgresCater/lapdatameter (silent join failure).
///
/// SEBAGIAN nolg mengandung huruf (mis. "00A06100820") — dikonfirmasi
/// oleh pihak PDAM ini FORMAT VALID yang memang dipakai di sistem
/// (bukan data corrupt), jadi validasi TIDAK boleh cuma terima digit
/// murni. Huruf di-uppercase-kan untuk konsistensi (data mentah kadang
/// campur huruf besar/kecil).
export function normalizeNolg(raw: string | null | undefined): string | null {
  const trimmed = trimOrNull(raw)
  if (trimmed === null) return null
  const upper = trimmed.toUpperCase()
  if (!/^[0-9A-Z]+$/.test(upper)) return null
  if (upper.length > 11) return null
  return upper.padStart(11, "0")
}

/// rt/rw: PBPK tidak zero-pad ("1"), ProgresCater zero-pad ("001").
/// Disamakan ke 3 digit supaya konsisten lintas sumber (VarChar(3)
/// menerima keduanya, tapi tampilan/pencarian jadi tidak konsisten kalau
/// tidak dinormalisasi).
export function normalizeRtRw(raw: string | null | undefined): string | null {
  const trimmed = trimOrNull(raw)
  if (trimmed === null) return null
  if (/^\d{1,3}$/.test(trimmed)) return trimmed.padStart(3, "0")
  return trimmed.slice(0, 3)
}

/// notelp pakai placeholder "0"/"-" untuk "tidak ada data" di sumber
/// mentah — treat sebagai null, bukan nomor telepon literal.
export function normalizePhone(raw: string | null | undefined): string | null {
  const trimmed = trimOrNull(raw)
  if (trimmed === null) return null
  if (trimmed === "0" || trimmed === "-") return null
  return trimmed
}

/// Merk meter: 60+ variasi case ("ITR","lin","AQ ","aq ") di data mentah.
export function normalizeMerk(raw: string | null | undefined): string | null {
  const trimmed = trimOrNull(raw)
  return trimmed ? trimmed.toUpperCase() : null
}

export function parseIntOrNull(raw: string | null | undefined): number | null {
  const trimmed = trimOrNull(raw)
  if (trimmed === null) return null
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) ? n : null
}

export function parseBigIntOrNull(raw: string | null | undefined): bigint | null {
  const trimmed = trimOrNull(raw)
  if (trimmed === null) return null
  const cleaned = trimmed.replace(/[^\d-]/g, "")
  if (!cleaned || cleaned === "-") return null
  try {
    return BigInt(cleaned)
  } catch {
    return null
  }
}

/// thbl/periode "202605" -> tanggal 1 bulan tsb (konvensi PembacaanMeter/
/// Tagihan.periode di seluruh skema).
export function periodeToDate(periode: number): Date {
  const year = Math.floor(periode / 100)
  const month = periode % 100
  return new Date(Date.UTC(year, month - 1, 1))
}

/// Excel serial date (basis 1899-12-30, dipakai PBPK.tglaktif). Menangani
/// baik serial murni tanggal (tanpa pecahan, mis. baris "PK") maupun
/// serial tanggal+jam (dengan pecahan, mis. baris "PB").
///
/// KOMA DITERIMA SEBAGAI PEMISAH DESIMAL. Berkas PBPK yang dikonversi dari
/// .xlsx lewat Excel/LibreOffice berlokal Indonesia menulis serialnya
/// "46136,8972222222", dan Number() memulangkan NaN untuk itu. Dulu
/// akibatnya senyap: pemanggil (08-mutasi.ts) hanya mengisi tanggalAktif
/// bila hasilnya truthy, jadi 13 dari 15 baris April kehilangan tanggal
/// tanpa satu pun peringatan. Berkas ber-titik tetap jalan seperti semula.
export function parseExcelSerial(raw: string | null | undefined): Date | null {
  const trimmed = trimOrNull(raw)
  if (trimmed === null) return null
  const serial = Number(trimmed.replace(",", "."))
  if (!Number.isFinite(serial) || serial <= 0) return null
  const msPerDay = 86_400_000
  return new Date(Math.round((serial - 25569) * msPerDay))
}

/// Tanggal M/D/YY atau M/D/YYYY (US-style, month-first) — TERVERIFIKASI
/// konsisten di seluruh r-nomor.csv (tgl_permohonan/tgl_tutup/tgl_spt/
/// tgl_cabut), termasuk baris dengan tahun 2-digit: dicocokkan silang ke
/// bulan yang tertanam di no_spt (mis. no_spt=".../SPT/02/2025" & tgl_spt
/// "02/12/25" -> Feb 2025, BUKAN "12 Februari" ala DD/MM/YY). Tahun 2-digit
/// >= 2000 (data selalu tahun 2020-an).
export function parseUsDate(raw: string | null | undefined): Date | null {
  const trimmed = trimOrNull(raw)
  if (trimmed === null) return null
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  let year = Number(match[3])
  if (year < 100) year += 2000
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  // Guard rollover Date bawaan JS untuk tanggal tidak valid (mis. 30 Feb).
  if (date.getUTCMonth() !== month - 1) return null
  return date
}

/// Tanggal/datetime format ISO-ish dari lapdatameter (tgl_catat
/// "2026-05-01") dan ProgresCater (tglcatat "2026-05-01 07:42:26").
export function parseIsoDate(raw: string | null | undefined): Date | null {
  const trimmed = trimOrNull(raw)
  if (trimmed === null) return null
  let iso = trimmed.replace(" ", "T")
  if (iso.length === 10) iso += "T00:00:00"
  if (!/Z$|[+-]\d{2}:?\d{2}$/.test(iso)) iso += "Z"
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/// Peta KODE PENDEK (bukan teks!) -> KondisiCatat. WAJIB berbasis kode
/// (tmss di ProgresCater, Kd_kel di lapdatameter — dua nama kolom
/// berbeda untuk field yang SAMA persis). Teks deskriptifnya (ketcatat/
/// Nm_Kel) TIDAK selalu sama untuk kode yang sama antar file — sudah
/// diverifikasi 3 kasus beda teks: kode "7" ("MATI ADA AIR" vs "METER
/// MATI AIR ADA"), "D" ("DICABUT" vs "DI CABUT"), "R" ("RUMAH KOSONG" vs
/// "RMH/TANAH KSG"). Kalau mapping berbasis teks, ketiganya bakal gagal
/// dikenali di salah satu file.
const KONDISI_CATAT_BY_CODE: Record<string, KondisiCatat> = {
  "": "NORMAL",
  "-": "NORMAL",
  "2": "DK",
  "3": "MTA",
  "4": "MB",
  "5": "TTB",
  "6": "BMK_BMB",
  "7": "METER_MATI_ADA_AIR",
  "8": "TIDAK_ADA_AIR",
  "9": "LOS_METER",
  AA: "METER_DALAM_AIR",
  D: "DICABUT",
  E: "TERHALANG",
  F: "METER_MUNDUR",
  H: "TIDAK_DIPAKAI",
  N: "STAND_TEMPEL",
  O: "METER_RUSAK",
  P: "REV_PENCATAT",
  Q: "ADA_ANJING",
  R: "RUMAH_KOSONG",
  T: "METER_TERBALIK",
  U: "MUDA_KEMBALI",
  Z: "STAND_KONSUMEN",
}

export function normalizeKondisiCatat(
  code: string | null | undefined
): KondisiCatat | null {
  const key = (code ?? "").trim()
  return KONDISI_CATAT_BY_CODE[key] ?? null
}

/// UkuranMeter: '1/2','1','1 1/2','2','3','4' (ProgresCater.ukmeter) atau
/// kode "A" (PBPK.kd_ukmeter, khusus 1/2 inci — TERVERIFIKASI 100% baris
/// PBPK di data memakai kode ini).
const UKURAN_METER_MAP: Record<string, UkuranMeter> = {
  "1/2": "INCH_HALF",
  A: "INCH_HALF",
  "1": "INCH_1",
  "1 1/2": "INCH_1_HALF",
  "2": "INCH_2",
  "3": "INCH_3",
  "4": "INCH_4",
}

export function normalizeUkuranMeter(
  raw: string | null | undefined
): UkuranMeter | null {
  const key = (raw ?? "").trim()
  return UKURAN_METER_MAP[key] ?? null
}

const GOLONGAN_TARIF_VALUES = new Set<string>([
  "GOL_1A",
  "GOL_1B",
  "GOL_2A1",
  "GOL_2A2",
  "GOL_2A3",
  "GOL_2A4",
  "GOL_2A5",
  "GOL_2B",
  "GOL_3A",
  "GOL_3B",
  "GOL_3C",
  "GOL_4A",
  "GOL_4B",
])

/// "2A3" -> GOL_2A3, "1B" -> GOL_1B, dst. Divalidasi terhadap 13 nilai
/// enum yang sudah diverifikasi mencakup 100% nilai `trp` di ProgresCater
/// — kalau ada kode baru di export bulan depan yang tidak dikenal, fungsi
/// ini return null (bukan menebak), caller wajib log + skip tarif.
export function normalizeGolonganTarif(
  raw: string | null | undefined
): GolonganTarif | null {
  const key = (raw ?? "").trim().replace(/\./g, "")
  if (!key) return null
  const candidate = `GOL_${key}`
  return GOLONGAN_TARIF_VALUES.has(candidate)
    ? (candidate as GolonganTarif)
    : null
}

/// durasi giliran air: "24" -> PENUH, "< 12" -> BERGILIR. Nilai lain
/// (belum teramati di data) -> null, caller tidak mengisi statusPasokanAir
/// sama sekali (jangan menebak).
export function normalizeStatusPasokanAir(
  raw: string | null | undefined
): "PENUH" | "BERGILIR" | null {
  const trimmed = trimOrNull(raw)
  if (trimmed === null) return null
  if (trimmed === "24") return "PENUH"
  if (trimmed === "< 12") return "BERGILIR"
  return null
}

/// Jam "05:00" -> Date bertipe TIME (Prisma @db.Time). Hanya jam:menit
/// yang relevan, tanggal diabaikan Postgres untuk kolom TIME.
export function parseTimeOfDay(raw: string | null | undefined): Date | null {
  const trimmed = trimOrNull(raw)
  if (trimmed === null) return null
  const match = trimmed.match(/^(\d{1,2})[:.](\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0))
}
