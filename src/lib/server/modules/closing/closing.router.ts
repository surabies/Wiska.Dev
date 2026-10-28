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
import { z } from "zod"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { auditMetaFromRequest } from "../../lib/audit"
import { ok } from "../../lib/response"
import { pratinjauClosing, tutupPeriode, bukaPeriode } from "./closing.service"
import { pratinjauBulanBaru, bukaBulanBaru } from "./bulan-baru.service"
import { eksporDrd } from "./drd-export.service"

export const closingRouter = new Hono()

const periodeParam = z.coerce.number().int().min(190001).max(999912)

closingRouter.get("/", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const rows = await prisma.periodePenagihan.findMany({
    orderBy: { periode: "desc" },
    take: 36,
    include: {
      ditutupBy: { select: { id: true, name: true } },
      dibukaBy: { select: { id: true, name: true } },
    },
  })
  // BigInt tidak bisa di-JSON.stringify — dikonversi ke string di batas API
  // supaya klien menerima angka utuh (bukan number yang kehilangan presisi
  // di atas 2^53).
  return ok(
    c,
    rows.map((r) => ({
      ...r,
      totalTagihan: r.totalTagihan?.toString() ?? null,
    })),
  )
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
    const [periodeDaftarCatat, terkunci] = await Promise.all([
      prisma.daftarCatat.groupBy({
        by: ["periode"],
        orderBy: { periode: "desc" },
      }),
      prisma.periodePenagihan.findMany({
        where: { status: "TERKUNCI" },
        select: { periode: true },
      }),
    ])
    const kunci = new Set(terkunci.map((p) => p.periode))
    const semua = periodeDaftarCatat.map((p) => p.periode)
    const terbuka = semua.find((p) => !kunci.has(p)) ?? null

    return ok(c, {
      /// Periode yang harus dipakai layar. null = tidak ada yang terbuka.
      periodeKerja: terbuka,
      /// Semua periode yang punya daftar catat, terbaru dulu — untuk pemilih
      /// periode; yang terkunci boleh dilihat, tapi hanya baca.
      periode: semua.map((p) => ({ periode: p, terkunci: kunci.has(p) })),
      /// Petunjuk tindakan saat tidak ada periode terbuka.
      saran:
        terbuka === null && semua.length > 0
          ? `Semua periode sudah ditutup. Buka bulan baru dari periode ${semua[0]} untuk melanjutkan siklus.`
          : null,
    })
  },
)

closingRouter.get(
  "/:periode",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  async (c) => {
    const periode = periodeParam.parse(c.req.param("periode"))
    return ok(c, await pratinjauClosing(periode))
  },
)

const tutupSchema = z.object({
  /// Jatuh tempo seluruh tagihan periode ini. WAJIB dikirim — tidak ada
  /// nilai bawaan. Versi impor memakai placeholder "periode + 1 bulan" yang
  /// tidak punya dasar di sumber data mana pun; menetapkannya di sini
  /// membuat tanggal itu jadi keputusan yang tercatat, bukan tebakan kode.
  tanggalJatuhTempo: z.coerce.date(),
})

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
  },
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
  },
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
      }),
    )
  },
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
  },
)

const bukaSchema = z.object({
  /// Wajib, minimal 10 karakter: membuka periode yang sudah ditagihkan
  /// harus bisa dipertanggungjawabkan belakangan, dan "ok" bukan alasan.
  alasan: z.string().trim().min(10).max(500),
})

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
  },
)
