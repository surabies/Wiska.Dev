// Shared time-window rules for customer self-reported meter readings.
//
// Aturannya: warga hanya boleh melaporkan angka meternya sendiri pada
// TANGGAL 1–25 setiap bulan. Lewat tanggal itu sistem menolak, dan
// mengarahkan mereka melapor pada jendela berikutnya.
//
// KENAPA ADA BATASNYA. Laporan mandiri menjadi PembacaanMeter resmi setelah
// diverifikasi petugas, dan pembacaan itulah dasar tagihan. Laporan yang
// masuk setelah petugas selesai berkeliling dan berkas closing disiapkan
// tidak lagi bisa ikut diperhitungkan bulan itu — ia hanya menambah
// pekerjaan verifikasi untuk angka yang sudah terlambat. Batas tanggal
// membuat harapan warga dan kenyataan operasional bertemu.
//
// ZONA WAKTU: WIB (UTC+7), BUKAN UTC — dan ini bukan detail kecil.
// Pelapor ada di Bandung. Pada 1 Agustus pukul 05:00 WIB, jam UTC masih
// menunjuk 31 Juli pukul 22:00. Menghitung tanggal dengan UTC akan MENOLAK
// warga yang melapor tepat di hari pertama jendela dibuka, dan sebaliknya
// MENERIMA laporan pada 26 pagi WIB (yang di UTC masih tanggal 25).
// Keduanya salah, dan keduanya sulit dilacak karena hanya muncul pada
// jam-jam tertentu.
//
// Pola offset ini sama dengan yang dipakai `bangkitkanNomorTiket`
// (server/modules/pengaduan/tiket.ts). Berbeda dari `domain/periode.ts`
// yang sengaja UTC: di sana periode adalah KUNCI DATA yang harus cocok
// dengan sumber CSV, di sini tanggal adalah PENGALAMAN MANUSIA.

/// Hari pertama warga boleh melapor (inklusif).
export const TANGGAL_BUKA_LAPOR_MANDIRI = 1

/// Hari terakhir warga boleh melapor (inklusif).
export const TANGGAL_TUTUP_LAPOR_MANDIRI = 25

const OFFSET_WIB_MS = 7 * 60 * 60 * 1000

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const

/// Waktu `sekarang` digeser ke WIB, lalu dibaca lewat getUTC* — trik yang
/// sama seperti tiket.ts, dan sengaja tidak memakai Intl/timeZone supaya
/// modul ini tetap murni tanpa ketergantungan dan berperilaku identik di
/// server, browser, maupun React Native.
function keWib(sekarang: Date): Date {
  return new Date(sekarang.getTime() + OFFSET_WIB_MS)
}

export interface JendelaLaporMandiri {
  /// Boleh melapor sekarang?
  boleh: boolean
  /// Tanggal hari ini menurut WIB (1–31).
  tanggal: number
  /// Periode berjalan menurut WIB, bentuk thbl (mis. 202608).
  periode: number
  /// Batas hari terakhir, untuk ditampilkan di layar.
  tanggalTutup: number
  /// Sisa hari sampai jendela ditutup — 0 berarti hari ini hari terakhir.
  /// null bila jendela sedang tertutup.
  sisaHari: number | null
  /// Kapan jendela berikutnya dibuka, sudah berupa kalimat siap tampil
  /// (mis. "1 September 2026"). null bila sedang boleh melapor.
  bukaBerikutnya: string | null
  /// Kalimat siap tampil untuk warga — nada mengarahkan, bukan menyalahkan.
  pesan: string
}

/// Menggeser "hari ini" untuk keperluan UJI — TIDAK berlaku di produksi.
///
/// Menguji jendela yang tertutup itu sulit: kalau hari ini tanggal 10, satu-
/// satunya cara melihat layar "ditutup" adalah menunggu tanggal 26 atau
/// menyunting konstanta lalu lupa mengembalikannya. Keduanya buruk.
///
/// Dengan ini, jalankan aplikasi memakai tanggal pura-pura:
///
///   LAPOR_MANDIRI_TANGGAL_UJI=26 pnpm dev          (server)
///   NEXT_PUBLIC_LAPOR_MANDIRI_TANGGAL_UJI=26 pnpm dev   (layar web)
///
/// DIABAIKAN saat NODE_ENV=production — pengaman ini disengaja: variabel
/// lingkungan gampang ikut tersalin ke server produksi tanpa disadari, dan
/// jendela pelaporan yang bisa digeser dari luar bukan jendela.
function tanggalUji(): number | null {
  // globalThis.process dipakai lewat penjagaan supaya modul ini tetap aman
  // di React Native & browser, yang tidak selalu punya `process`.
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env
  if (!env) return null
  if (env.NODE_ENV === "production") return null
  const mentah =
    env.LAPOR_MANDIRI_TANGGAL_UJI ?? env.NEXT_PUBLIC_LAPOR_MANDIRI_TANGGAL_UJI
  if (!mentah) return null
  const n = Number(mentah)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
}

export function jendelaLaporMandiri(
  sekarang: Date = new Date(),
): JendelaLaporMandiri {
  const wib = keWib(sekarang)
  const geser = tanggalUji()
  if (geser !== null) wib.setUTCDate(geser)
  const tanggal = wib.getUTCDate()
  const bulan = wib.getUTCMonth()
  const tahun = wib.getUTCFullYear()
  const periode = tahun * 100 + (bulan + 1)

  const boleh =
    tanggal >= TANGGAL_BUKA_LAPOR_MANDIRI &&
    tanggal <= TANGGAL_TUTUP_LAPOR_MANDIRI

  if (boleh) {
    const sisaHari = TANGGAL_TUTUP_LAPOR_MANDIRI - tanggal
    return {
      boleh: true,
      tanggal,
      periode,
      tanggalTutup: TANGGAL_TUTUP_LAPOR_MANDIRI,
      sisaHari,
      bukaBerikutnya: null,
      pesan:
        sisaHari === 0
          ? `Hari ini hari TERAKHIR pelaporan bulan ini (tanggal ${TANGGAL_TUTUP_LAPOR_MANDIRI}). Setelah hari ini pelaporan ditutup sampai tanggal 1 bulan depan.`
          : `Pelaporan dibuka sampai tanggal ${TANGGAL_TUTUP_LAPOR_MANDIRI} — tersisa ${sisaHari} hari lagi.`,
    }
  }

  // Tertutup: jendela berikutnya selalu tanggal 1 bulan berikutnya, karena
  // penutupan hanya terjadi di ujung akhir bulan (tanggal 26 ke atas).
  const bulanDepan = bulan === 11 ? 0 : bulan + 1
  const tahunDepan = bulan === 11 ? tahun + 1 : tahun
  const bukaBerikutnya = `${TANGGAL_BUKA_LAPOR_MANDIRI} ${NAMA_BULAN[bulanDepan]} ${tahunDepan}`

  return {
    boleh: false,
    tanggal,
    periode,
    tanggalTutup: TANGGAL_TUTUP_LAPOR_MANDIRI,
    sisaHari: null,
    bukaBerikutnya,
    pesan:
      `Pelaporan meter mandiri hanya dilayani tanggal ${TANGGAL_BUKA_LAPOR_MANDIRI}–${TANGGAL_TUTUP_LAPOR_MANDIRI} setiap bulan. ` +
      `Hari ini sudah tanggal ${tanggal}, jadi pelaporan bulan ini sudah ditutup. ` +
      `Silakan laporkan angka meter Anda mulai ${bukaBerikutnya}. ` +
      `Bila meter Anda belum sempat dicatat bulan ini, petugas akan tetap berkunjung sesuai jadwal rutenya.`,
  }
}
