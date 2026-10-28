// server/middleware/sesi-hidup.ts — memastikan pemilik sesi MASIH ADA dan
// MASIH AKTIF di database, bukan cuma "punya token yang bisa didekripsi".
//
// KENAPA ADA. Sesi web (JWT strategy) dan token mobile sama-sama tanpa state
// di server: isinya cuma `sub` = id user, ditandatangani AUTH_SECRET, berlaku
// 30 hari (web) / 7 hari (mobile). Selama secret-nya sama, token itu tetap
// "sah" walaupun baris user-nya sudah lenyap — dihapus admin, atau tabel
// `user` dibangun ulang sehingga cuid-nya berganti.
//
// Tanpa penjagaan ini, akibatnya baru muncul jauh di hilir sebagai kegagalan
// foreign key saat menulis: verifikasi massal 100 baris melaporkan 100
// "Foreign key constraint violated on ... verif1ById_fkey" — pesan yang tidak
// menyebut penyebab sebenarnya dan tidak memberi tahu apa yang harus
// dilakukan. Yang benar: sesinya yang sudah tidak berlaku, dan jawabannya
// 401 sekali di depan, bukan error database sebanyak baris yang disentuh.
//
// SEKALIAN MENUTUP LUBANG PENCABUTAN. Sebelum ini, menonaktifkan user hanya
// menutup login BERIKUTNYA (lihat catatan di lib/mobile-token.ts dan cek
// status di auth.ts authorize/signIn) — token yang masih hidup tetap jalan
// sampai kedaluwarsa. Dengan pemeriksaan di sini, status NONAKTIF berlaku
// paling lambat satu TTL cache kemudian.
//
// SATU QUERY PER USER PER TTL, bukan per request. Dashboard ini ramai
// permintaan kecil; menanyakan baris user ke Neon di setiap request akan
// menambah satu round-trip ke SEMUA endpoint. TTL 60 detik menahan biayanya
// tanpa membuat penonaktifan terasa lambat oleh manusia.
import type { MiddlewareHandler } from "hono"
import { prisma } from "@db"
import { UnauthorizedError } from "../lib/errors"
import { getSessionUser } from "../lib/session"

const TTL_MS = 60_000
/// Batas kasar supaya cache tidak tumbuh tanpa henti di proses yang panjang.
/// Jumlah user internal jauh di bawah ini; ambang ini murni jaring pengaman.
const MAKS_ENTRI = 1_000

type Putusan = "ADA" | "TIDAK_ADA" | "NONAKTIF"

const cache = new Map<string, { putusan: Putusan; sampai: number }>()

async function periksa(id: string): Promise<Putusan> {
  const kini = Date.now()
  const tersimpan = cache.get(id)
  if (tersimpan && tersimpan.sampai > kini) return tersimpan.putusan

  const user = await prisma.user.findUnique({
    where: { id },
    select: { status: true },
  })
  const putusan: Putusan = !user
    ? "TIDAK_ADA"
    : user.status === "ACTIVE"
      ? "ADA"
      : "NONAKTIF"

  if (cache.size >= MAKS_ENTRI) cache.clear()
  cache.set(id, { putusan, sampai: kini + TTL_MS })
  return putusan
}

/// Dipakai setelah token dibuang paksa (mis. user dinonaktifkan lewat
/// PATCH /users/:id/status) agar keputusannya tidak menunggu TTL.
export function lupakanSesi(id: string): void {
  cache.delete(id)
}

export function pastikanSesiHidup(): MiddlewareHandler {
  return async (c, next) => {
    const user = getSessionUser(c)
    const putusan = await periksa(user.id)
    if (putusan === "TIDAK_ADA") {
      throw new UnauthorizedError(
        "Sesi Anda sudah tidak berlaku: akun ini tidak ada lagi di sistem. Silakan keluar lalu masuk kembali.",
      )
    }
    if (putusan === "NONAKTIF") {
      throw new UnauthorizedError(
        "Akun ini sudah dinonaktifkan. Hubungi administrator.",
      )
    }
    await next()
  }
}
