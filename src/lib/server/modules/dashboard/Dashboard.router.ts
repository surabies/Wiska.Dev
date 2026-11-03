// server/modules/dashboard/dashboard.router.ts — angka ringkasan untuk
// halaman dashboard.
//
// SEMUA lewat agregasi database (count/aggregate/groupBy), TIDAK PERNAH
// menarik baris lalu menghitung di JavaScript: tabel pelanggan & tagihan
// masing-masing >22.000 baris, dan `findMany` lalu `.length`/`.reduce()`
// akan menyeret puluhan ribu baris melintasi jaringan tiap kali halaman
// dibuka. Semua field yang di-filter di sini sudah terindeks (lihat
// prisma/*.prisma).
import { Hono } from "hono"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { ok } from "../../lib/Respons"
import {
  ambilRingkasanDashboard,
  ambilTrenDashboard,
  ambilPerluTindakanDashboard,
} from "./Dashboard.service"

export const dashboardRouter = new Hono()

dashboardRouter.get(
  "/ringkasan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    return ok(c, await ambilRingkasanDashboard())
  }
)

/// Tren 6 periode terakhir untuk grafik. groupBy di database, bukan 6 query
/// terpisah maupun tarik-semua-lalu-kelompokkan di JS.
dashboardRouter.get(
  "/tren",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    return ok(c, await ambilTrenDashboard())
  }
)

/// Yang butuh tindakan petugas — inti dashboard operasional: bukan sekadar
/// angka, tapi "apa yang harus saya kerjakan sekarang".
dashboardRouter.get(
  "/perlu-tindakan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    return ok(c, await ambilPerluTindakanDashboard())
  }
)
