// server/modules/cron/cron.router.ts — pemicu terjadwal untuk pekerjaan
// latar. TIDAK ada sesi manusia di sini: dijalankan penjadwal (Vercel Cron,
// cron OS, GitHub Actions) yang membawa rahasia bersama, BUKAN login.
//
// KENAPA ROUTER TERPISAH, BUKAN /api/v1/pengaduan/tutup-otomatis?
// Endpoint itu SUPERVISOR_UP — butuh sesi/Bearer user. Penjadwal tidak punya
// akun. Melubangi requireRole() di sana demi cron akan menghapus jaring
// pengaman /api/v1. Jadi cron punya pintunya sendiri, dijaga CRON_SECRET,
// di luar blanket verifyAuth() /api/v1 — persis alasan /api/public terpisah.
//
// Vercel Cron otomatis menambah header `Authorization: Bearer $CRON_SECRET`
// bila env CRON_SECRET diisi; penjadwal lain tinggal mengirim header yang
// sama. GET didukung karena Vercel Cron memanggil dengan GET.
import { Hono } from "hono"
import { timingSafeEqual } from "node:crypto"
import { ok } from "../../lib/response"
import { AppError } from "../../lib/errors"
import { sapuTutupOtomatis } from "../pengaduan/otomatis"

export const cronRouter = new Hono()

/// Perbandingan rahasia dengan waktu-tetap: `===` biasa bocor lewat lama
/// pencocokan. Panjang berbeda langsung gagal (timingSafeEqual melempar bila
/// beda panjang), tapi itu tidak membocorkan isi rahasia.
function rahasiaCocok(diberikan: string, benar: string): boolean {
  const a = Buffer.from(diberikan)
  const b = Buffer.from(benar)
  return a.length === b.length && timingSafeEqual(a, b)
}

/// Gerbang: hanya lewat bila header `Authorization: Bearer <CRON_SECRET>`
/// cocok. Tanpa CRON_SECRET di env, seluruh rute cron mati (503) — lebih baik
/// gagal terang daripada endpoint latar yang diam-diam terbuka tanpa penjaga.
cronRouter.use("*", async (c, next) => {
  const rahasia = process.env.CRON_SECRET
  if (!rahasia) {
    throw new AppError(
      503,
      "CRON_TIDAK_DIKONFIGURASI",
      "CRON_SECRET belum diatur di server.",
    )
  }
  const header = c.req.header("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!token || !rahasiaCocok(token, rahasia)) {
    throw new AppError(401, "TIDAK_BERWENANG", "Rahasia cron tidak valid.")
  }
  await next()
})

/// Tutup semua tiket SELESAI yang batas konfirmasinya lewat. Idempoten &
/// aman dipanggil berulang — jalur malas per-tiket (saat dibaca publik) tetap
/// jadi jaring bila cron ini mati. GET & POST sama-sama diterima.
async function jalankanTutupPengaduan() {
  const jumlahDitutup = await sapuTutupOtomatis()
  return { jumlahDitutup }
}

cronRouter.get("/tutup-pengaduan", async (c) =>
  ok(c, await jalankanTutupPengaduan()),
)
cronRouter.post("/tutup-pengaduan", async (c) =>
  ok(c, await jalankanTutupPengaduan()),
)
