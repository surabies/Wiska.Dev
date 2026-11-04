// server/modules/publik/AkunWarga.schema.ts — skema validasi Zod & tipe kontrak
// untuk pendaftaran akun mandiri warga (role=USER).

import { z } from "zod"

const PANJANG_PASSWORD_MIN = 8

export const registerSchema = z.object({
  nama: z.string().trim().min(2, "Nama wajib diisi").max(150),
  email: z.email("Format email tidak valid").trim().toLowerCase(),
  password: z
    .string()
    .min(
      PANJANG_PASSWORD_MIN,
      `Password minimal ${PANJANG_PASSWORD_MIN} karakter`
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

export type RegisterWargaInput = z.infer<typeof registerSchema>
