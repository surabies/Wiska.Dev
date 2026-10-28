// server/lib/rate-limit.ts — pembatas laju untuk endpoint TANPA login.
//
// Endpoint di /api/public/* tidak punya sesi untuk diikat, jadi pembatas laju
// adalah satu-satunya rem terhadap penyalahgunaan: enumerasi data pelanggan,
// membanjiri pengaduan palsu, atau menghabiskan kuota penyedia email.
//
// BATASAN YANG DISADARI: penyimpanannya di MEMORI PROSES.
//   - Hilang saat server restart.
//   - Tidak berlaku lintas instance (2 instance = 2x jatah).
//   - Bisa dilewati penyerang ber-IP banyak (proxy/botnet).
// Kalau app ini di-deploy lebih dari satu instance ATAU menghadapi
// penyalahgunaan serius, PINDAHKAN ke Redis/Upstash — antarmuka
// `cekRateLimit()` sengaja dibuat sederhana supaya penggantian itu tidak
// menyentuh kode endpoint. Meski begitu, versi ini tetap jauh lebih baik
// daripada tanpa rem sama sekali.
//
// Ini BUKAN pertahanan utama terhadap kebocoran data. Pertahanan utamanya
// adalah verifikasi identitas (server/modules/publik/verifikasi.ts) — lihat
// catatan di sana soal kenapa nomor langganan saja tidak cukup.
import type { Context } from "hono"
import { AppError } from "./errors"

interface Catatan {
  jumlah: number
  resetPada: number
}

const penyimpanan = new Map<string, Catatan>()

/// Bersih-bersih berkala supaya Map tidak tumbuh selamanya (setiap IP unik
/// meninggalkan entri). Interval-nya longgar — ini hanya higienis memori,
/// bukan bagian dari penegakan batas.
const INTERVAL_BERSIH_MS = 10 * 60 * 1000
let terakhirBersih = Date.now()

function bersihkan(now: number) {
  if (now - terakhirBersih < INTERVAL_BERSIH_MS) return
  terakhirBersih = now
  for (const [kunci, c] of penyimpanan) {
    if (c.resetPada < now) penyimpanan.delete(kunci)
  }
}

export interface RateLimitOptions {
  /** Pengenal aturan, mis. "cek-tagihan". Dipakai memisahkan kuota antar endpoint. */
  nama: string
  maks: number
  jendelaMs: number
}

export class RateLimitError extends AppError {
  constructor(detikLagi: number) {
    super(
      429,
      "RATE_LIMITED",
      `Terlalu banyak permintaan. Coba lagi dalam ${detikLagi} detik.`,
    )
  }
}

/** Lempar RateLimitError bila kuota habis. `pengenal` biasanya IP. */
export function cekRateLimit(pengenal: string, opsi: RateLimitOptions): void {
  const now = Date.now()
  bersihkan(now)

  const kunci = `${opsi.nama}|${pengenal}`
  const catatan = penyimpanan.get(kunci)

  if (!catatan || catatan.resetPada < now) {
    penyimpanan.set(kunci, { jumlah: 1, resetPada: now + opsi.jendelaMs })
    return
  }

  catatan.jumlah += 1
  if (catatan.jumlah > opsi.maks) {
    throw new RateLimitError(Math.ceil((catatan.resetPada - now) / 1000))
  }
}

/// IP klien. `x-forwarded-for` HANYA bisa dipercaya bila app berada di
/// belakang reverse proxy yang menimpanya — header ini dikirim klien dan
/// bisa dipalsukan. Di produksi, pastikan proxy (nginx/Cloudflare) menyetel
/// ulang header ini; kalau tidak, penyerang cukup mengirim
/// `X-Forwarded-For` acak untuk melewati semua pembatas di file ini.
export function ipKlien(c: Context): string {
  const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
  return fwd || c.req.header("x-real-ip") || "tanpa-ip"
}
