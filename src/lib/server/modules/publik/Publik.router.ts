// server/modules/publik/Publik.router.ts — API untuk warga/pelanggan TANPA
// login: cek tagihan, lapor pengaduan, lapor meter mandiri.
//
// ============================ ATURAN MAIN ============================
// Router ini SENGAJA terpisah dari /api/v1 dan di-mount di /api/public.
// JANGAN memindahkan endpoint publik ke dalam /api/v1 lalu "melubangi"
// verifyAuth() di sana — blanket auth di /api/v1 adalah jaring pengaman:
// selama ia utuh, endpoint internal yang lupa dipasangi requireRole() tetap
// tertutup. Melubanginya satu per satu menghapus jaring itu diam-diam.
//
// Semua yang ada di file ini bisa diakses SIAPA SAJA dari internet. Karena
// itu setiap handler WAJIB:
//   1. cekRateLimit()          — rem penyalahgunaan (lihat lib/PembatasLaju.ts)
//   2. verifikasiPelanggan()   — untuk apa pun yang menyentuh data pelanggan
//   3. mengembalikan data SEMINIMAL mungkin
//
// Yang TIDAK boleh ada di sini: LISTING/PENCARIAN banyak pelanggan sekaligus
// (mis. cari berdasarkan sebagian nama/alamat, atau prefix nomor) — itu yang
// bisa dipakai memanen data massal. Lookup SATU pelanggan lewat
// `nomorLangganan` PERSIS (exact match, 11 digit) tetap boleh — lihat
// GET /pelanggan/:nomorLangganan di bawah dan catatan keputusan produk di
// Verifikasi.ts soal kenapa itu tidak lagi mensyaratkan nama.
import { Hono, type Context } from "hono"
import { validate } from "../../lib/Validasi"
import { ok, created } from "../../lib/Respons"
import { BadRequestError } from "../../lib/Galat"
import { cekRateLimit, ipKlien } from "../../lib/PembatasLaju"
import { MAKS_UKURAN_BYTE } from "../../lib/Penyimpanan"
import { periodeToDate } from "@/lib/domain/Periode"
import { getSessionUserOpsional } from "../../lib/Sesi"
import {
  nomorLangganganSchema,
  cekTagihanSchema,
  pengaduanSchema,
  konfirmasiSchema,
  bukaKembaliSchema,
  chatPelaporSchema,
  laporMeterSchema,
} from "./Publik.schema"
import * as service from "./Publik.service"

export const publikRouter = new Hono()

// ============================================================
// LOOKUP PELANGGAN (identitas saja, dipakai kartu pratinjau lapor-meter)
// ============================================================

/// Exact match SATU pelanggan lewat nomorLangganan lengkap (11 digit) — BUKAN
/// pencarian sebagian/prefix (lihat catatan header file). Dipakai frontend
/// untuk kartu "ini pelanggan Anda?" sebelum mengisi form lapor meter, dan
/// bisa dipakai ulang di mana pun butuh pratinjau identitas ringan tanpa
/// data tagihan.
publikRouter.get("/pelanggan/:nomorLangganan", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "lookup-pelanggan",
    maks: 20,
    jendelaMs: 5 * 60 * 1000,
  })

  const parsed = nomorLangganganSchema.safeParse(c.req.param("nomorLangganan"))
  if (!parsed.success)
    throw new BadRequestError("Nomor langganan harus 11 digit angka")

  const data = await service.lookupPelangganPublik(
    parsed.data,
    c.req.query("periodeUji")
  )
  return ok(c, data)
})

// ============================================================
// CEK TAGIHAN
// ============================================================

/// POST (bukan GET) supaya nomor langganan tidak tercatat di log akses
/// server / riwayat browser / header Referer.
publikRouter.post(
  "/cek-tagihan",
  validate("json", cekTagihanSchema),
  async (c) => {
    // Ketat: ini endpoint yang paling menarik untuk dipanen.
    cekRateLimit(ipKlien(c), {
      nama: "cek-tagihan",
      maks: 10,
      jendelaMs: 5 * 60 * 1000,
    })

    const data = await service.cekTagihanPublik(c.req.valid("json"))
    return ok(c, data)
  }
)

// ============================================================
// PENGADUAN
// ============================================================

/// Menerima DUA bentuk badan permintaan: `multipart/form-data` (form web,
/// karena foto bukti ikut) dan `application/json` (aplikasi Flutter & klien
/// lama, yang tidak melampirkan foto lewat endpoint ini).
///
/// Dipisah ke fungsi sendiri supaya percabangan content-type tidak
/// berceceran di handler. Di multipart, koordinat datang sebagai dua field
/// skalar `lat`/`lng` — objek bersarang tidak punya representasi yang wajar
/// di form-data, dan memaksakannya lewat JSON.parse() di dalam field form
/// hanya menambah satu lagi masukan yang harus dipercaya.
async function bacaBodyPengaduan(
  c: Context
): Promise<{ data: unknown; foto: File | null; video: File | null }> {
  if (!(c.req.header("content-type") ?? "").includes("multipart/form-data")) {
    return { data: await c.req.json(), foto: null, video: null }
  }

  const form = await c.req.formData()
  const teks = (kunci: string) => {
    const nilai = form.get(kunci)
    return typeof nilai === "string" && nilai.trim() !== "" ? nilai : undefined
  }
  const lat = teks("lat")
  const lng = teks("lng")
  const foto = form.get("foto")
  const video = form.get("video")

  return {
    data: {
      klasifikasi: teks("klasifikasi"),
      jenis: teks("jenis"),
      judul: teks("judul"),
      deskripsi: teks("deskripsi"),
      pelapor: teks("pelapor"),
      kontakPelapor: teks("kontakPelapor"),
      alamatKejadian: teks("alamatKejadian"),
      nomorLangganan: teks("nomorLangganan"),
      clientRequestId: teks("clientRequestId"),
      // Number() atas string non-angka menghasilkan NaN, dan z.number()
      // menolak NaN — jadi koordinat sampah gagal di validator, bukan
      // diam-diam tersimpan sebagai titik di tengah laut.
      koordinat:
        lat !== undefined && lng !== undefined
          ? { lat: Number(lat), lng: Number(lng) }
          : undefined,
    },
    foto: foto instanceof File && foto.size > 0 ? foto : null,
    video: video instanceof File && video.size > 0 ? video : null,
  }
}

publikRouter.post("/pengaduan", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "pengaduan",
    maks: 5,
    jendelaMs: 10 * 60 * 1000,
  })

  // WAJIB dipanggil SEBELUM bacaBodyPengaduan(): jalur cookie di
  // getSessionUserOpsional() (@hono/auth-js getAuthUser) mengkloning
  // `c.req.raw` mentah-mentah, termasuk body stream-nya — kalau body sudah
  // dibaca lebih dulu (c.req.json()/formData()), stream itu sudah
  // "disturbed" dan kloning tersebut throw. Sudah diverifikasi lewat curl:
  // dengan urutan terbalik, PENGADUAN ANONIM (satu-satunya jalur yang
  // benar-benar sampai ke fallback cookie) gagal 500 di setiap permintaan.
  const sesi = await getSessionUserOpsional(c)

  const { data, foto, video } = await bacaBodyPengaduan(c)
  const input = pengaduanSchema.parse(data)

  const hasil = await service.buatPengaduanPublik(input, { foto, video }, sesi)
  return created(c, hasil)
})

// ============================================================
// PELACAKAN TIKET
// ============================================================

publikRouter.get("/pengaduan/:nomorTiket", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "lacak-tiket",
    maks: 30,
    jendelaMs: 5 * 60 * 1000,
  })

  const data = await service.lacakTiketPublik(c.req.param("nomorTiket"))
  return ok(c, data)
})

publikRouter.post(
  "/pengaduan/:nomorTiket/konfirmasi",
  validate("json", konfirmasiSchema),
  async (c) => {
    cekRateLimit(ipKlien(c), {
      nama: "konfirmasi-tiket",
      maks: 10,
      jendelaMs: 10 * 60 * 1000,
    })

    const data = await service.konfirmasiTiketPublik(
      c.req.param("nomorTiket"),
      c.req.valid("json")
    )
    return ok(c, data)
  }
)

publikRouter.post(
  "/pengaduan/:nomorTiket/buka-kembali",
  validate("json", bukaKembaliSchema),
  async (c) => {
    cekRateLimit(ipKlien(c), {
      nama: "buka-tiket",
      maks: 5,
      jendelaMs: 10 * 60 * 1000,
    })

    const data = await service.bukaKembaliTiketPublik(
      c.req.param("nomorTiket"),
      c.req.valid("json")
    )
    return ok(c, data)
  }
)

publikRouter.post("/pengaduan/:nomorTiket/chat", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "chat-tiket",
    maks: 20,
    jendelaMs: 10 * 60 * 1000,
  })

  // WAJIB sebelum membaca body — lihat catatan urutan getSessionUserOpsional
  // di POST /pengaduan (body stream tidak boleh sudah dikonsumsi).
  const sesi = await getSessionUserOpsional(c)
  const input = chatPelaporSchema.parse(await c.req.json())

  const data = await service.kirimChatPelaporPublik(
    c.req.param("nomorTiket"),
    input,
    sesi
  )
  return created(c, data)
})

// ============================================================
// LAPOR METER MANDIRI
// ============================================================

/// Jendela waktu pelaporan dari konfigurasi server, bukan jam/perkiraan client.
publikRouter.get("/lapor-meter/jendela", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "jendela-lapor-meter",
    maks: 60,
    jendelaMs: 5 * 60 * 1000,
  })
  return ok(c, await service.ambilJendelaLaporMeterPublik())
})

publikRouter.get("/lapor-meter/periode-uji", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "periode-uji-lapor-meter",
    maks: 60,
    jendelaMs: 5 * 60 * 1000,
  })
  return ok(c, await service.ambilPeriodeUjiLaporMeterPublik())
})

/// multipart/form-data (bukan JSON) karena membawa berkas foto.
publikRouter.post("/lapor-meter", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "lapor-meter",
    maks: 5,
    jendelaMs: 10 * 60 * 1000,
  })

  // Periksa sesi sebelum membaca multipart body; pemeriksaan Auth.js dapat
  // mengkloning request dan harus berjalan sebelum stream dikonsumsi.
  const sesi = await getSessionUserOpsional(c)

  // DIPERIKSA PALING AWAL — sebelum form diurai, sebelum foto disentuh.
  // Menolak setelah mengunggah foto berarti menghabiskan kuota penyimpanan
  // dan kuota bandwidth warga untuk berkas yang pasti dibuang.
  const form = await c.req.formData()
  const periodeUjiRaw = form.get("periodeUji")
  const parsed = laporMeterSchema.parse({
    nomorLangganan: form.get("nomorLangganan"),
    standDilaporkan: form.get("standDilaporkan"),
    nomorPelapor: form.get("nomorPelapor"),
    namaPelapor: form.get("namaPelapor"),
    periodeUji:
      typeof periodeUjiRaw === "string" && periodeUjiRaw !== ""
        ? periodeUjiRaw
        : undefined,
  })
  const foto = form.get("foto")

  const data = await service.kirimLaporMeterPublik(
    parsed,
    foto instanceof File ? foto : null,
    sesi
  )
  return created(c, data)
})

export const MAKS_FOTO_BYTE = MAKS_UKURAN_BYTE
export { periodeToDate }
