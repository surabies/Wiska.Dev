// server/modules/closing/closing.router.ts — penutupan periode penagihan.
//
// TIGA ENDPOINT, DENGAN TINGKAT KEWENANGAN BERBEDA:
//   GET  /closing            daftar periode + statusnya            (STAFF_UP)
//   GET  /closing/:periode   pratinjau: "kalau ditutup sekarang,
//                            apa yang terjadi" — TIDAK menulis     (STAFF_UP)
//   POST /closing/:periode/tutup   terbitkan tagihan & kunci       (SENIOR_UP)
//   POST /closing/:periode/buka    buka kembali, wajib beralasan   (ADMIN)
//
// Kenapa `tutup` dibatasi SENIOR_UP dan bukan MANAGEMENT_UP: menekan tombol
// ini menerbitkan tagihan ke puluhan ribu warga sekaligus. Kewenangannya
// disamakan dengan V3 (approve final verifikasi) karena akibatnya setara —
// keduanya sama-sama mengubah angka lapangan menjadi angka yang ditagihkan.
//
// Kenapa `buka` bahkan lebih ketat (ADMIN): membuka periode yang sudah
// ditagihkan berarti angka yang sudah sampai ke warga bisa berubah lagi.
// Service-nya menolak sama sekali bila ada tagihan yang sudah lunas.

import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { auditMetaFromRequest } from "../../lib/Audit"
import { ok } from "../../lib/Respons"
import { periodeParam, tutupSchema, bukaSchema } from "./Closing.schema"
import {
  daftarPeriodePenagihan,
  dapatkanPeriodeKerja,
  pratinjauClosing,
  tutupPeriode,
  bukaPeriode,
} from "./Closing.service"
import { pratinjauBulanBaru, bukaBulanBaru } from "./BulanBaru.service"
import { eksporDrd } from "./DRDEkspor.service"

export const closingRouter = new Hono()

closingRouter.get("/", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  return ok(c, await daftarPeriodePenagihan())
})

// ── PERIODE KERJA — satu sumber kebenaran untuk seluruh layar ────────────
//
// MASALAH YANG DIPECAHKAN. Sebelum ini tiap layar menurunkan sendiri
// "periode yang sedang dikerjakan": layar verifikasi memakai periode
// terbaru yang punya laporan, layar PBPK memakai bulan kalender, layar
// pemetaan memakai campuran keduanya. Akibatnya nyata dan sudah terjadi:
// PBPK mendarat di periode kalender (Juli) sementara seluruh layar lain
// menunjuk Januari — sambungannya lahir, tapi tidak muncul di mana pun dan
// tidak ikut closing.
//
// Turunan yang benar: PERIODE TERBARU YANG PUNYA DAFTAR CATAT DAN BELUM
// TERKUNCI. Daftar catat adalah tanda pekerjaan lapangan sudah diterbitkan;
// TERKUNCI adalah tanda pekerjaannya selesai. Keduanya sudah tersimpan —
// tidak perlu kolom baru, tidak perlu pilihan saat login.
//
// Kalau TIDAK ADA yang terbuka (semua periode berdaftar-catat sudah
// terkunci), itu bukan galat melainkan keadaan sah: siklus menunggu "buka
// bulan baru". Jawabannya menyebutkan itu supaya layar bisa menuntun, bukan
// diam.
closingRouter.get(
  "/periode-kerja",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    return ok(c, await dapatkanPeriodeKerja())
  }
)

closingRouter.get(
  "/:periode",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const periode = periodeParam.parse(c.req.param("periode"))
    return ok(c, await pratinjauClosing(periode))
  }
)

closingRouter.post(
  "/:periode/tutup",
  requireRole(...ROLE_GROUPS.SENIOR_UP),
  validate("json", tutupSchema),
  async (c) => {
    const periode = periodeParam.parse(c.req.param("periode"))
    const user = getSessionUser(c)
    const hasil = await tutupPeriode({
      periode,
      tanggalJatuhTempo: c.req.valid("json").tanggalJatuhTempo,
      olehUserId: user.id,
      jejak: auditMetaFromRequest(c.req.raw),
    })
    return ok(c, hasil)
  }
)

// ── Buka bulan baru: menerbitkan daftar catat periode BERIKUTNYA dari
// periode di path. Kewenangannya disamakan dengan `tutup` (SENIOR_UP) karena
// keduanya bagian dari satu siklus yang sama, dan menerbitkan ulang daftar
// kerja puluhan ribu SL menentukan pekerjaan seluruh pencatat bulan itu.
closingRouter.get(
  "/:periode/bulan-baru",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const periode = periodeParam.parse(c.req.param("periode"))
    return ok(c, await pratinjauBulanBaru(periode))
  }
)

closingRouter.post(
  "/:periode/bulan-baru",
  requireRole(...ROLE_GROUPS.SENIOR_UP),
  async (c) => {
    const periode = periodeParam.parse(c.req.param("periode"))
    const user = getSessionUser(c)
    return ok(
      c,
      await bukaBulanBaru({
        periode,
        olehUserId: user.id,
        jejak: auditMetaFromRequest(c.req.raw),
      })
    )
  }
)

// ── Ekspor DRD resmi ────────────────────────────────────────────────────
// Mengembalikan berkas CSV, bukan envelope JSON — konsumennya adalah sistem
// lain dan operator yang mengunduh, bukan kode klien kita sendiri. Kolom
// yang belum ada isinya diumumkan di header `X-DRD-Kolom-Kosong` supaya
// penerima tahu bedanya "kosong karena belum tersedia" dan "kosong karena
// memang nol".
closingRouter.get(
  "/:periode/drd.csv",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const periode = periodeParam.parse(c.req.param("periode"))
    const { csv, ringkas } = await eksporDrd(periode)
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="DRD${periode}-PW5.csv"`,
        "X-DRD-Baris": String(ringkas.baris),
        "X-DRD-Total-Tagihan": String(ringkas.totalTagihan),
        "X-DRD-Kolom-Kosong": ringkas.kolomKosong.join(","),
      },
    })
  }
)

closingRouter.post(
  "/:periode/buka",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", bukaSchema),
  async (c) => {
    const periode = periodeParam.parse(c.req.param("periode"))
    const user = getSessionUser(c)
    const row = await bukaPeriode({
      periode,
      alasan: c.req.valid("json").alasan,
      olehUserId: user.id,
      jejak: auditMetaFromRequest(c.req.raw),
    })
    return ok(c, { ...row, totalTagihan: row.totalTagihan?.toString() ?? null })
  }
)
