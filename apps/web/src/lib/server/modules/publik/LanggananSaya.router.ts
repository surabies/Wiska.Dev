// server/modules/publik/langganan-saya.router.ts — nomor langganan yang
// ditautkan akun warga yang SEDANG LOGIN (model LanggananWarga).
//
// Di-mount di /api/v1/langganan-saya (blanket verifyAuthFleksibel, cookie
// web ATAU Bearer mobile) TANPA requireRole: pemakainya justru role paling
// rendah (USER, akun hasil daftar mandiri). Setiap query di sini WAJIB
// terikat `userId` sesi — tidak ada jalan membaca/mengubah tautan akun lain.
//
// Batas keterbukaan data: menautkan nomor hanya butuh tahu NOMORNYA (klaim
// tidak diverifikasi kepemilikan — keputusan produk di verifikasi.ts), jadi
// endpoint ini tidak boleh membuka data melebihi endpoint publik
// GET /api/public/pelanggan/:nomorLangganan: alamat tetap disamarkan, dan
// ringkasan tagihan hanya agregat (total tunggakan) yang juga sudah terbuka
// di POST /api/public/cek-tagihan. Dua rem anti-panen tambahan:
// rate limit per-akun saat menambah + kuota maksimal tautan per akun.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { ok, created } from "../../lib/Respons"
import { cekRateLimit } from "../../lib/PembatasLaju"
import { getSessionUser } from "../../lib/Sesi"
import { tambahSchema } from "./LanggananSaya.schema"
import {
  daftarLanggananSaya,
  tambahLanggananSaya,
  jadikanLanggananUtama,
  hapusLanggananSaya,
} from "./LanggananSaya.service"

export const langgananSayaRouter = new Hono()

/// Daftar langganan tertaut akun ini — sumber kartu biodata di beranda
/// aplikasi publik. Utama selalu di urutan pertama.
langgananSayaRouter.get("/", async (c) => {
  const user = getSessionUser(c)
  return ok(c, await daftarLanggananSaya(user.id))
})

/// Tautkan satu nomor langganan lagi ke akun ini (pelanggan dengan lebih
/// dari satu sambungan). Tautan pertama otomatis jadi utama.
langgananSayaRouter.post("/", validate("json", tambahSchema), async (c) => {
  const user = getSessionUser(c)
  // Per-AKUN (bukan per-IP): inilah rem enumerasi nomor lewat endpoint ini
  // — pindah IP tidak menambah jatah.
  cekRateLimit(`user:${user.id}`, {
    nama: "tambah-langganan",
    maks: 10,
    jendelaMs: 15 * 60 * 1000,
  })

  const hasil = await tambahLanggananSaya(user.id, c.req.valid("json"))
  return created(c, hasil)
})

/// Jadikan satu tautan sebagai utama (biodata yang tampil pertama di
/// beranda + nilai prefill formulir). Transaksi: turunkan semua, naikkan
/// satu — supaya "tepat satu utama" tidak pernah sempat dilanggar.
langgananSayaRouter.patch("/:id/utama", async (c) => {
  const user = getSessionUser(c)
  const hasil = await jadikanLanggananUtama(user.id, c.req.param("id"))
  return ok(c, hasil)
})

/// Lepas tautan. Tautan terakhir TIDAK boleh dilepas (akun warga selalu
/// punya minimal satu langganan — invariant yang sama dengan pendaftaran).
/// Bila yang dilepas kebetulan utama, tautan tertua yang tersisa naik jadi
/// utama supaya beranda tidak pernah kosong.
langgananSayaRouter.delete("/:id", async (c) => {
  const user = getSessionUser(c)
  const hasil = await hapusLanggananSaya(user.id, c.req.param("id"))
  return ok(c, hasil)
})
