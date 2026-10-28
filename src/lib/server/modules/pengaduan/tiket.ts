// server/modules/pengaduan/tiket.ts — pembangkit & penormal nomor tiket
// pengaduan. Format: TW-YYMM-XXXXXX, mis. "TW-2607-4F2A9K".
//
// ==================== KENAPA BAGIAN AKHIRNYA ACAK ====================
// Ini keputusan KEAMANAN, bukan estetika. Endpoint pelacakan publik
// (GET /api/public/pengaduan/:nomorTiket) sengaja TIDAK meminta verifikasi
// identitas — supaya warga cukup memegang nomor tiket. Yang membuat itu
// aman HANYA satu hal: nomor tiket tidak bisa ditebak.
//
// Nomor urut rapi ala "TW-2607-00001" akan menghancurkan properti itu:
// siapa pun bisa me-loop 00001..99999 dan memanen judul aduan, nama
// petugas, serta seluruh linimasa tindak lanjut SEMUA warga — persis
// pemanenan massal yang dicegah di server/modules/publik/verifikasi.ts
// (di mana `nomorLangganan` yang berurutan justru jadi masalahnya).
//
// 6 karakter dari alfabet 32 = 32^6 ≈ 1,07 miliar kemungkinan per bulan,
// dilapisi rate limit 30 percobaan / 5 menit per IP. Menebak satu tiket
// yang valid butuh puluhan ribu tahun.
//
// KALAU SUATU SAAT FORMAT INI MAU DIBUAT BERURUTAN: pasang faktor kedua di
// endpoint pelacakan LEBIH DULU (mis. nomor HP pelapor, dengan pesan gagal
// yang SERAGAM agar tidak jadi orakel "tiket ini ada/tidak"). Jangan
// dibalik urutannya.
//
// Efek samping yang menyenangkan: karena acak, TIDAK ada penghitung yang
// perlu di-`count()+1` — jadi tidak ada balapan antar dua aduan yang masuk
// bersamaan. Bentrok ditangani lewat retry di `buatNomorTiketUnik()`.
import { randomInt } from "node:crypto"

/// Base32 Crockford: tanpa I, L, O, dan U. Empat huruf itu dibuang bukan
/// tanpa alasan — nomor ini dibacakan lewat telepon, ditulis tangan di
/// lapangan, dan diketik ulang warga: I/1, L/1, O/0 saling tertukar, dan U
/// dibuang agar tidak ada kata makian yang tidak sengaja terbentuk.
const ALFABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

const PANJANG_ACAK = 6

export const PREFIX_TIKET = "TW"

/// Bentuk nomor tiket yang sah — dipakai juga oleh validator Zod di router
/// supaya nomor asal-asalan ditolak sebelum menyentuh database.
export const POLA_NOMOR_TIKET = /^TW-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/

/// WIB (UTC+7), bukan UTC. Bagian YYMM adalah label yang DIBACA MANUSIA di
/// Bandung: aduan yang masuk 1 Agustus jam 06:00 WIB masih 31 Juli di UTC,
/// dan tiket bertanda "2607" untuk laporan bulan Agustus akan
/// membingungkan petugas yang merekap per bulan. Berbeda dari
/// `lib/periode.ts` yang sengaja UTC — di sana periode adalah kunci data
/// yang harus cocok dengan sumber CSV, di sini cuma label.
const OFFSET_WIB_MS = 7 * 60 * 60 * 1000

function acak(panjang: number): string {
  let hasil = ""
  // randomInt (CSPRNG), bukan Math.random(). Math.random() bisa diprediksi
  // dari keluaran sebelumnya, dan di sini ketidakbisatebakan itu justru
  // satu-satunya kontrol akses yang menjaga tiket warga lain.
  for (let i = 0; i < panjang; i++) hasil += ALFABET[randomInt(ALFABET.length)]
  return hasil
}

export function bangkitkanNomorTiket(sekarang: Date = new Date()): string {
  const wib = new Date(sekarang.getTime() + OFFSET_WIB_MS)
  const yy = String(wib.getUTCFullYear() % 100).padStart(2, "0")
  const mm = String(wib.getUTCMonth() + 1).padStart(2, "0")
  return `${PREFIX_TIKET}-${yy}${mm}-${acak(PANJANG_ACAK)}`
}

/// Merapikan nomor yang diketik warga sebelum dicari di database.
///
/// Menerapkan aturan pembacaan Crockford (O->0, I/L->1) supaya salah baca
/// yang lazim tidak berujung "tiket tidak ditemukan" padahal tiketnya ada.
/// Huruf-huruf itu tidak pernah muncul di nomor yang kita terbitkan, jadi
/// pemetaan ini tidak mungkin menabrak nomor tiket lain.
///
/// Nomor NON-TW dikembalikan apa adanya (hanya di-trim): tiket dari sistem
/// sebelumnya berformat cuid huruf kecil, dan meng-uppercase-kannya justru
/// membuatnya tidak ketemu.
export function normalisasiNomorTiket(input: string): string {
  const bersih = input.trim()
  if (!/^tw-/i.test(bersih)) return bersih

  return bersih
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/[OIL]/g, (ch) => (ch === "O" ? "0" : "1"))
}

/// Membungkus pembuatan baris dengan retry saat nomor tiket bentrok.
///
/// Peluang bentrok mendekati nol (32^6 per bulan), tapi "mendekati nol"
/// bukan nol — dan kalau terjadi, kegagalannya akan tampak sebagai error
/// 409 acak yang mustahil direproduksi. Tiga percobaan menutup itu dengan
/// biaya nol di jalur normal.
///
/// Cek P2002 dilakukan STRUKTURAL (properti `code`), bukan `instanceof
/// PrismaClientKnownRequestError` — lihat alasan lengkapnya di
/// server/lib/errors.ts: class Prisma bisa termuat lebih dari satu kali dan
/// `instanceof` diam-diam mengembalikan false.
export async function buatNomorTiketUnik<T>(
  buat: (nomorTiket: string) => Promise<T>,
): Promise<T> {
  let errorTerakhir: unknown
  for (let percobaan = 0; percobaan < 3; percobaan++) {
    try {
      return await buat(bangkitkanNomorTiket())
    } catch (err) {
      const kode = (err as { code?: string } | null)?.code
      const target = (err as { meta?: { target?: unknown } } | null)?.meta
        ?.target
      const bentrokNomorTiket =
        kode === "P2002" &&
        (Array.isArray(target)
          ? target.includes("nomorTiket")
          : target === "nomorTiket")
      if (!bentrokNomorTiket) throw err
      errorTerakhir = err
    }
  }
  throw errorTerakhir
}
