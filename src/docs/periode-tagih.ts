import { z } from "zod"

/**
 * Periode tagih dalam format bilangan YYYYMM (mis. 202611).
 *
 * Kenapa modul ini ada:
 *  1) Rentang angka seperti 190001–999912 ikut menerima bulan 00 atau 13.
 *     Di sini bulan WAJIB 01–12 dan tahun dibatasi rentang waktu wajar.
 *  2) Kesalahan format periode harus menjadi galat validasi (4xx), bukan
 *     Error biasa yang berakhir sebagai HTTP 500.
 *  3) Batas bulan ditentukan menurut WIB (UTC+7), BUKAN zona waktu server.
 *     Pembacaan pukul 00:30 WIB tanggal 1 adalah 17:30 UTC tanggal sebelumnya;
 *     memakai UTC akan memasukkannya ke periode yang salah.
 *     Indonesia bagian barat (WIB) tidak memakai DST sehingga offset tetap.
 */

export const TAHUN_MINIMUM = 2000
export const TAHUN_MAKSIMUM = 2100

const OFFSET_WIB_MS = 7 * 60 * 60 * 1000

export class PeriodeTidakValidError extends Error {
  readonly kode = "PERIODE_TIDAK_VALID"
  constructor(nilai: unknown) {
    super(`Periode tidak valid: ${String(nilai)}. Gunakan format YYYYMM.`)
    this.name = "PeriodeTidakValidError"
  }
}

export interface PeriodeParsed {
  tahun: number
  bulan: number
}

export function periodeValid(nilai: unknown): nilai is number {
  if (typeof nilai !== "number" || !Number.isInteger(nilai)) return false
  const tahun = Math.floor(nilai / 100)
  const bulan = nilai % 100
  return (
    tahun >= TAHUN_MINIMUM &&
    tahun <= TAHUN_MAKSIMUM &&
    bulan >= 1 &&
    bulan <= 12
  )
}

export function parsePeriode(nilai: number): PeriodeParsed {
  if (!periodeValid(nilai)) throw new PeriodeTidakValidError(nilai)
  return { tahun: Math.floor(nilai / 100), bulan: nilai % 100 }
}

export function buatPeriode(tahun: number, bulan: number): number {
  const nilai = tahun * 100 + bulan
  if (!Number.isInteger(tahun) || !Number.isInteger(bulan) || !periodeValid(nilai)) {
    throw new PeriodeTidakValidError(nilai)
  }
  return nilai
}

export function periodeBerikutnya(nilai: number): number {
  const { tahun, bulan } = parsePeriode(nilai)
  return bulan === 12 ? buatPeriode(tahun + 1, 1) : buatPeriode(tahun, bulan + 1)
}

export function periodeSebelumnya(nilai: number): number {
  const { tahun, bulan } = parsePeriode(nilai)
  return bulan === 1 ? buatPeriode(tahun - 1, 12) : buatPeriode(tahun, bulan - 1)
}

/** Instan awal periode: pukul 00:00 WIB tanggal 1 (inklusif). */
export function awalPeriode(nilai: number): Date {
  const { tahun, bulan } = parsePeriode(nilai)
  return new Date(Date.UTC(tahun, bulan - 1, 1) - OFFSET_WIB_MS)
}

/** Instan akhir periode: 00:00 WIB tanggal 1 bulan berikutnya (EKSKLUSIF). */
export function akhirPeriodeEksklusif(nilai: number): Date {
  return awalPeriode(periodeBerikutnya(nilai))
}

/** Periode (menurut WIB) tempat sebuah instan waktu jatuh. */
export function periodeDariWaktu(waktu: Date): number {
  if (Number.isNaN(waktu.getTime())) throw new PeriodeTidakValidError(waktu)
  const geser = new Date(waktu.getTime() + OFFSET_WIB_MS)
  return buatPeriode(geser.getUTCFullYear(), geser.getUTCMonth() + 1)
}

/**
 * Schema Zod bersama untuk body, query, dan param.
 * Query string selalu berupa string, maka tersedia varian coerce.
 */
export const periodeSchema = z
  .number()
  .int()
  .refine(periodeValid, { message: "Periode harus berformat YYYYMM (bulan 01–12)" })

export const periodeQuerySchema = z.coerce
  .number()
  .int()
  .refine(periodeValid, { message: "Periode harus berformat YYYYMM (bulan 01–12)" })
