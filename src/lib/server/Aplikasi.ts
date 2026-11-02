// Hono API application mounted by src/app/api/[[...route]]/route.ts.
import { Hono } from "hono"
import { logger } from "hono/logger"
import { secureHeaders } from "hono/secure-headers"
import { authHandler, initAuthConfig } from "@hono/auth-js"
import { fullAuthConfig } from "@/lib/auth/index"
import { errorHandler } from "./lib/Galat"
import { ok } from "./lib/Respons"
import { getSessionUser } from "./lib/Sesi"
import { verifyAuthFleksibel } from "./lib/SelulerToken"
import { pastikanSesiHidup } from "./middleware/SesiHidup"
import { cors } from "hono/cors"

import { divisiRouter } from "./modules/organisasi/Divisi.router"
import { bagianRouter } from "./modules/organisasi/Bagian.router"
import { subBagianRouter } from "./modules/organisasi/SubBagian.router"
import { pencatatRouter } from "./modules/organisasi/Pencatat.router"
import { targetKinerjaRouter } from "./modules/organisasi/TargetKinerja.router"
import { golonganBesarRouter } from "./modules/tarif/GolonganBesar.router"
import { tarifRouter } from "./modules/tarif/Tarif.router"
import { dmaRouter } from "./modules/wilayah/Dma.router"
import { konfigurasiRouter } from "./modules/konfigurasi/Konfigurasi.router"
import { wilayahAdmRouter } from "./modules/wilayah/WilayahAdm.router"
import { wilayahDistRouter } from "./modules/wilayah/WilayahDist.router"
import { seksiCaterRouter } from "./modules/wilayah/SeksiCater.router"
import { wilayahSeksiRouter } from "./modules/wilayah/WilayahSeksi.router"
import { zonaRouter } from "./modules/wilayah/Zona.router"
import { ruteRouter } from "./modules/wilayah/Rute.router"
import { kecamatanRouter } from "./modules/wilayah/Kecamatan.router"
import { kelurahanRouter } from "./modules/wilayah/Kelurahan.router"
import { wilayahLookupRouter } from "./modules/wilayah/Pencarian.router"
import { pelangganRouter } from "./modules/pelanggan/Pelanggan.router"
import { meterRouter } from "./modules/meter/Meter.router"
import { pembacaanRouter } from "./modules/pembacaan/Pembacaan.router"
import { tagihanRouter } from "./modules/tagihan/Tagihan.router"
import { closingRouter } from "./modules/closing/Closing.router"
import { kesehatanRouter } from "./modules/kesehatan/Kesehatan.router"
import { tagihanLainRouter } from "./modules/tagihan/TagihanLain.router"
import { pembayaranRouter } from "./modules/pembayaran/Pembayaran.router"
import { pengaduanRouter } from "./modules/pengaduan/Pengaduan.router"
import { laporanHarianRouter } from "./modules/laporan/LaporanHarian.router"
import { drdRouter } from "./modules/laporan/Drd.router"
import { manualAddRouter } from "./modules/laporan/ManualTambah.router"
import { laporanMandiriRouter } from "./modules/laporan/LaporanMandiri.router"
import { anomaliRouter } from "./modules/anomali/Anomali.router"
import { mutasiRouter } from "./modules/mutasi/Mutasi.router"
import { pemutusanRouter } from "./modules/pemutusan/Pemutusan.router"
import { imporRouter } from "./modules/impor/Impor.router"
import { potensiRouter } from "./modules/potensi/Potensi.router"
import { userRouter } from "./modules/user/Pengguna.router"
import { auditRouter } from "./modules/audit/Audit.router"
import { dashboardRouter } from "./modules/dashboard/Dashboard.router"
import { publikRouter } from "./modules/publik/Publik.router"
import { berkasRouter } from "./modules/publik/Berkas.router"
import { akunWargaRouter } from "./modules/publik/AkunWarga.router"
import { langgananSayaRouter } from "./modules/publik/LanggananSaya.router"
import { cronRouter } from "./modules/cron/Cron.router"
import { authMobileRouter } from "./modules/mobile/AuthSeluler.router"
import { devAccessRouter } from "./modules/mobile/DevAkses.router"
import {
  perangkatRouter,
  notifikasiRouter,
} from "./modules/notifikasi/Notifikasi.router"
import { penugasanRuteRouter } from "./modules/organisasi/PenugasanRute.router"

export const app = new Hono()

app.use("*", logger())
app.use("*", secureHeaders())
// CORS harus terdaftar SEBELUM route yang dilindunginya — middleware Hono
// hanya berlaku untuk route yang didaftarkan sesudahnya (versi lama file ini
// menaruhnya di baris paling bawah, sehingga tidak pernah jalan). Aplikasi
// mobile NATIVE (Flutter Android/iOS) tidak butuh CORS sama sekali — ini
// hanya untuk klien browser lintas origin (mis. Flutter Web saat dev).
// Origin diatur lewat env CORS_ORIGINS (dipisah koma), TANPA wildcard:
// credentials: true + origin "*" ditolak browser, dan membuka semua origin
// untuk API ber-cookie bukan hal yang benar.
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:8081")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  "/api/*",
  cors({
    // Menggunakan callback function agar Hono mengembalikan origin yang sesuai request
    origin: (origin) => {
      if (!origin || corsOrigins.includes(origin)) {
        return origin || "*"
      }
      return null
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
)

app.use(
  "*",
  initAuthConfig(() => fullAuthConfig)
)
app.use("/api/auth/*", authHandler())

// ============================================================
// /api/public/* — TANPA LOGIN, terbuka untuk siapa saja di internet.
// ============================================================
// SENGAJA router terpisah, BUKAN pengecualian di dalam /api/v1.
// verifyAuth() blanket di /api/v1 adalah jaring pengaman: selama utuh,
// endpoint internal yang lupa dipasangi requireRole() tetap tertutup.
// Melubanginya per-route akan menghapus jaring itu diam-diam, dan kelak
// tidak ada yang bisa memastikan endpoint mana yang publik hanya dengan
// membaca file ini.
//
// Aturan untuk penghuni /api/public: rate limit + verifikasi identitas
// (nomor langganan + nama) + balas data seminimal mungkin. Lihat
// server/modules/publik/verifikasi.ts.
const publik = new Hono()
publik.route("/", publikRouter)
publik.route("/berkas", berkasRouter)
publik.route("/auth", akunWargaRouter)
app.route("/api/public", publik)

// /api/mobile/auth/* — pintu masuk aplikasi Flutter: tukar kredensial /
// idToken Google menjadi Bearer token. TANPA login (memang pintu masuknya),
// ber-rate-limit per IP di dalam router-nya. Setelah punya token, aplikasi
// mobile memanggil /api/v1/* biasa dengan header Authorization.
app.route("/api/mobile/auth", authMobileRouter)

// /api/mobile/dev-access/* — verifikasi kode akses layar pengaturan-api
// tersembunyi di mobile-petugas (ganti server produksi/lokal). TANPA login
// (dipakai justru untuk mengarahkan app ke server lain), dijaga
// PETUGAS_DEV_ACCESS_CODE + rate limit, bukan requireRole. Lihat
// server/modules/mobile/dev-access.router.ts.
app.route("/api/mobile/dev-access", devAccessRouter)

// /api/cron/* — pekerjaan latar terjadwal (mis. tutup-otomatis pengaduan).
// TANPA sesi manusia: dijaga CRON_SECRET (bukan requireRole), jadi sengaja di
// LUAR blanket verifyAuth() /api/v1 — pola sama seperti /api/public. Lihat
// server/modules/cron/cron.router.ts.
app.route("/api/cron", cronRouter)

// Semua endpoint bisnis ada di bawah /api/v1/* dan WAJIB login — sistem ini
// dashboard internal PERUMDA, bukan API publik. RBAC per-role di atas ini
// dipasang per-route/grup lewat requireRole() (server/middleware/rbac.ts).
// verifyAuthFleksibel = blanket verifyAuth() yang juga menerima Bearer token
// mobile — default-nya tetap 401, jaring pengamannya utuh.
const v1 = new Hono()
v1.use("*", verifyAuthFleksibel())
// Token yang bisa didekripsi belum tentu milik user yang masih ada/aktif —
// lihat server/middleware/sesi-hidup.ts. Tanpa ini, sesi basi baru ketahuan
// sebagai kegagalan foreign key saat menulis (verif1ById, verifiedById, dll).
v1.use("*", pastikanSesiHidup())

v1.get("/me", (c) => ok(c, getSessionUser(c)))

v1.route("/divisi", divisiRouter)
v1.route("/bagian", bagianRouter)
v1.route("/sub-bagian", subBagianRouter)
v1.route("/pencatat", pencatatRouter)
v1.route("/penugasan-rute", penugasanRuteRouter)
v1.route("/target-kinerja", targetKinerjaRouter)
v1.route("/golongan-besar", golonganBesarRouter)
v1.route("/tarif", tarifRouter)
v1.route("/dma", dmaRouter)
v1.route("/konfigurasi", konfigurasiRouter)
v1.route("/wilayah-adm", wilayahAdmRouter)
v1.route("/wilayah-dist", wilayahDistRouter)
v1.route("/seksi-cater", seksiCaterRouter)
v1.route("/wilayah-seksi", wilayahSeksiRouter)
v1.route("/zona", zonaRouter)
v1.route("/rute", ruteRouter)
v1.route("/kecamatan", kecamatanRouter)
v1.route("/kelurahan", kelurahanRouter)
v1.route("/wilayah/lookup", wilayahLookupRouter)
v1.route("/pelanggan", pelangganRouter)
v1.route("/meter", meterRouter)
v1.route("/pembacaan", pembacaanRouter)
v1.route("/tagihan", tagihanRouter)
// Closing periode: mengubah pembacaan terverifikasi jadi tagihan resmi.
v1.route("/closing", closingRouter)
v1.route("/kesehatan", kesehatanRouter)
v1.route("/tagihan-lain", tagihanLainRouter)
v1.route("/pembayaran", pembayaranRouter)
v1.route("/pengaduan", pengaduanRouter)
v1.route("/laporan-harian", laporanHarianRouter)
v1.route("/drd", drdRouter)
v1.route("/manual-add", manualAddRouter)
v1.route("/laporan-mandiri", laporanMandiriRouter)
v1.route("/anomali", anomaliRouter)
v1.route("/mutasi", mutasiRouter)
v1.route("/pemutusan", pemutusanRouter)
// Impor berkas sumber per batch (pencatatan harian, pemutusan).
v1.route("/impor", imporRouter)
v1.route("/potensi", potensiRouter)
v1.route("/users", userRouter)
v1.route("/audit-log", auditRouter)
v1.route("/dashboard", dashboardRouter)
// Self-service akun warga (role USER) — tanpa requireRole, setiap query
// terikat userId sesi. Lihat catatan di modules/publik/langganan-saya.router.ts.
v1.route("/langganan-saya", langgananSayaRouter)
// Push notification: token perangkat (mobile) + inbox in-app. Inbox terikat
// userId sesi (tanpa requireRole); pendaftaran token dibatasi STAFF_UP.
v1.route("/perangkat", perangkatRouter)
v1.route("/notifikasi", notifikasiRouter)

app.route("/api/v1", v1)

app.onError(errorHandler)
app.notFound((c) =>
  c.json(
    {
      success: false,
      error: { code: "NOT_FOUND", message: "Route tidak ditemukan" },
    },
    404
  )
)
