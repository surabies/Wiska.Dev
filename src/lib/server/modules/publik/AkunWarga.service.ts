// server/modules/publik/AkunWarga.service.ts — logika pendaftaran akun mandiri
// untuk warga (pelapor/pelanggan), role=USER.

import { prisma } from "@db"
import { hashPassword } from "@/lib/auth/Sandi"
import { ConflictError } from "../../lib/Galat"
import { verifikasiPelanggan } from "./Verifikasi"
import type { RegisterWargaInput } from "./AkunWarga.schema"

/// Beda dari login/lupa-password: mengungkapkan "email sudah terdaftar" DI
/// SINI bukan kebocoran user-enumeration — itu memang UX standar pendaftaran
/// di mana pun (pengguna perlu tahu supaya tidak membuat akun kedua), dan
/// endpoint ini tidak bisa dipakai menebak password/identitas siapa pun,
/// hanya "apakah email ini sudah dipakai".
export async function daftarkanAkunWarga({
  nama,
  email,
  password,
  nomorLangganan,
}: RegisterWargaInput) {
  const sudahAda = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (sudahAda) {
    throw new ConflictError(
      'Email ini sudah terdaftar. Masuk memakai email tersebut, atau gunakan "Lupa password" bila lupa kata sandinya.'
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

  return {
    ...user,
    pesan:
      "Akun berhasil dibuat. Silakan masuk untuk mulai memantau laporan Anda.",
  }
}
