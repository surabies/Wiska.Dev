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
import { z } from "zod"
import { prisma } from "@db"
import { hashPassword } from "@/lib/auth/password"
import { validate } from "../../lib/validate"
import { created } from "../../lib/response"
import { ConflictError } from "../../lib/errors"
import { cekRateLimit, ipKlien } from "../../lib/rate-limit"
import { verifikasiPelanggan } from "./verifikasi"

export const akunWargaRouter = new Hono()

const PANJANG_PASSWORD_MIN = 8

const registerSchema = z.object({
  nama: z.string().trim().min(2, "Nama wajib diisi").max(150),
  email: z.email("Format email tidak valid").trim().toLowerCase(),
  password: z
    .string()
    .min(
      PANJANG_PASSWORD_MIN,
      `Password minimal ${PANJANG_PASSWORD_MIN} karakter`,
    )
    .max(100, "Password terlalu panjang"),
  /// WAJIB sejak 2026-07-19 (keputusan produk): akun warga selalu lahir
  /// dengan minimal satu nomor langganan tertaut, supaya beranda aplikasi
  /// bisa langsung menampilkan biodata langganannya. Diverifikasi ADA
  /// (verifikasiPelanggan), bukan diverifikasi MILIK — lihat catatan di
  /// verifikasi.ts dan model LanggananWarga (prisma/pelanggan.prisma).
  nomorLangganan: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "Nomor langganan harus 11 digit angka"),
})

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

    const { nama, email, password, nomorLangganan } = c.req.valid("json")

    const sudahAda = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (sudahAda) {
      throw new ConflictError(
        'Email ini sudah terdaftar. Masuk memakai email tersebut, atau gunakan "Lupa password" bila lupa kata sandinya.',
      )
    }

    // Dicek SEBELUM hash password (hash argon2 sengaja mahal ~25ms) — nomor
    // salah adalah kegagalan yang paling sering, gagalkan dulu yang murah.
    const pelanggan = await verifikasiPelanggan(nomorLangganan)

    const passwordHash = await hashPassword(password)
    // username SENGAJA null: akun warga login pakai email, bukan username
    // (username itu memang untuk login non-Google staf internal — lihat
    // catatan di prisma/auth.prisma).
    const user = await prisma.user.create({
      data: {
        name: nama,
        email,
        passwordHash,
        role: "USER",
        status: "ACTIVE",
        // Nested create (bukan transaksi terpisah): akun dan tautan langganan
        // pertamanya lahir-mati bersama — tidak boleh ada akun warga tanpa
        // langganan utama.
        langgananWarga: {
          create: { pelangganId: pelanggan.id, isUtama: true },
        },
      },
      select: { id: true, name: true, email: true },
    })

    return created(c, {
      ...user,
      pesan:
        "Akun berhasil dibuat. Silakan masuk untuk mulai memantau laporan Anda.",
    })
  },
)
