// server/modules/publik/akun-warga.router.ts — pendaftaran akun mandiri
// untuk WARGA (pelapor/pelanggan), role=USER.
//
// SENGAJA terpisah dari server/modules/user (akun internal STAFF ke atas,
// yang provisioning-nya memang admin-only — lihat auth.ts & CLAUDE.md:
// "tidak ada signup, admin-provisioned via POST /api/v1/users"). Endpoint
// di sini TIDAK membalikkan keputusan itu untuk akun internal: ia hanya
// membuka jalur pendaftaran mandiri untuk tingkat akun PALING RENDAH
// (role=USER, tanpa akses dashboard sama sekali) — dan TIDAK PERNAH
// menerima role/status/field organisasi apa pun dari body permintaan,
// selalu dipaksa USER + ACTIVE di kode, bukan di validasi input.
//
// Login akun hasil endpoint ini memakai jalur yang SUDAH ADA, tanpa
// perubahan apa pun: Credentials provider di auth.ts (web, cookie) dan
// POST /api/mobile/auth/login (mobile, Bearer) — keduanya hanya mensyaratkan
// passwordHash cocok + status ACTIVE, jadi otomatis menerima akun baru ini.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { created } from "../../lib/Respons"
import { cekRateLimit, ipKlien } from "../../lib/PembatasLaju"
import { registerSchema } from "./AkunWarga.schema"
import { daftarkanAkunWarga } from "./AkunWarga.service"

export const akunWargaRouter = new Hono()

/// Beda dari login/lupa-password: mengungkapkan "email sudah terdaftar" DI
/// SINI bukan kebocoran user-enumeration — itu memang UX standar pendaftaran
/// di mana pun (pengguna perlu tahu supaya tidak membuat akun kedua), dan
/// endpoint ini tidak bisa dipakai menebak password/identitas siapa pun,
/// hanya "apakah email ini sudah dipakai".
akunWargaRouter.post(
  "/register",
  validate("json", registerSchema),
  async (c) => {
    cekRateLimit(ipKlien(c), {
      nama: "daftar-warga",
      maks: 5,
      jendelaMs: 15 * 60 * 1000,
    })

    const hasil = await daftarkanAkunWarga(c.req.valid("json"))
    return created(c, hasil)
  }
)
