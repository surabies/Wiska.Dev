// server/modules/publik/verifikasi.ts — mengambil profil pelanggan untuk
// endpoint publik (tanpa login) berdasarkan nomorLangganan SAJA.
//
// ============================ KEPUTUSAN PRODUK ============================
// Sebelumnya file ini juga mensyaratkan `nama` sebagai faktor kedua, persis
// karena `nomorLangganan` berurutan (00000100119, 00000200509, …) dan bisa
// ditebak lewat loop — lihat riwayat git untuk detail lengkapnya. Verifikasi
// dua faktor itu SENGAJA DILEPAS (2026-07-15, keputusan produk) supaya alur
// cek tagihan & lapor meter cukup nomor langganan saja ("auto-complete"),
// sama seperti pola yang sudah dipakai di aplikasi TanStack sebelumnya.
//
// Konsekuensinya harus jujur dicatat: siapa pun yang tahu/menebak
// `nomorLangganan` sekarang bisa melihat nama, alamat, golongan tarif, dan
// riwayat tagihan pelanggan itu — bukan cuma pemilik sambungan. Mitigasi
// yang TERSISA hanyalah rate limit per-IP (`cekRateLimit`, lihat
// server/lib/rate-limit.ts), yang menurut catatan di file itu sendiri tidak
// menutup penyerang ber-IP banyak. Alamat tetap disamarkan
// (`samarkanAlamat`) sebagai pengurang paparan minimal, bukan pengganti
// verifikasi identitas.
import { prisma } from "@db"
import type { Prisma } from "@db"
import { AppError } from "../../lib/errors"

export class VerifikasiGagalError extends AppError {
  constructor() {
    super(
      404,
      "VERIFIKASI_GAGAL",
      "Nomor langganan tidak ditemukan. Periksa kembali nomor Anda.",
    )
  }
}

const PELANGGAN_SELECT = {
  id: true,
  nomorLangganan: true,
  nama: true,
  alamat: true,
  rt: true,
  rw: true,
  status: true,
  tarifGolongan: { select: { kodeAsli: true, kategori: true } },
} satisfies Prisma.PelangganSelect

export type PelangganTerverifikasi = Prisma.PelangganGetPayload<{
  select: typeof PELANGGAN_SELECT
}>

/** Lempar VerifikasiGagalError bila nomor tidak ada / pelanggan terhapus
 *  (soft delete diperlakukan sama seperti tidak ada). */
export async function verifikasiPelanggan(
  nomorLangganan: string,
): Promise<PelangganTerverifikasi> {
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { nomorLangganan },
    select: PELANGGAN_SELECT,
  })

  if (!pelanggan) throw new VerifikasiGagalError()

  return pelanggan
}

/// Menyamarkan alamat: pengurang paparan minimal sejak verifikasi identitas
/// dilepas (lihat catatan di atas) — bukan proteksi utama, hanya membuat
/// alamat penuh tidak langsung tercetak di layar yang bisa di-screenshot.
export function samarkanAlamat(alamat: string): string {
  return alamat.length <= 8
    ? alamat
    : `${alamat.slice(0, 8)}${"*".repeat(Math.min(12, alamat.length - 8))}`
}
