// features/auth/lib/sign-in-errors.ts — terjemahan kode error Auth.js ke
// pesan yang berarti bagi pengguna.
//
// Dipisah dari komponen (bukan ditulis inline di JSX) karena ini logika
// domain, bukan tampilan: bisa diuji sendiri, dipakai ulang di halaman error
// lain, dan daftarnya bertambah seiring provider bertambah.
//
// Kode-kode ini datang sebagai query `?error=...` dari Auth.js — lihat
// @auth/core/errors. authConfig.pages.error menunjuk ke /login, jadi
// halaman inilah yang menerimanya.

/// AccessDenied adalah kasus PALING SERING di sistem ini dan BUKAN kerusakan:
/// callbacks.signIn di auth.ts sengaja menolak setiap email yang belum
/// terdaftar sebagai User — tidak ada pendaftaran mandiri. Karena itu
/// pesannya menjelaskan duduk perkaranya, bukan sekadar "akses ditolak".
const PESAN: Record<string, string> = {
  AccessDenied:
    "Akun Google ini belum terdaftar. Dashboard hanya bisa diakses pegawai yang akunnya telah dibuatkan administrator.",
  OAuthAccountNotLinked:
    "Email ini sudah terhubung ke metode masuk yang berbeda. Hubungi administrator sistem.",
  OAuthSignin: "Gagal memulai proses masuk ke Google. Coba lagi beberapa saat lagi.",
  OAuthCallback: "Google menolak proses masuk. Coba lagi atau hubungi administrator.",
  Configuration: "Konfigurasi autentikasi bermasalah. Hubungi administrator sistem.",
  Verification: "Tautan verifikasi sudah kedaluwarsa atau pernah dipakai.",
  SessionRequired: "Sesi Anda telah berakhir. Silakan masuk kembali.",
}

const PESAN_DEFAULT = "Terjadi kesalahan saat masuk. Silakan coba lagi."

/** Null bila tidak ada error — supaya pemanggil cukup `if (pesan)`. */
export function pesanErrorMasuk(kode: string | undefined): string | null {
  if (!kode) return null
  return PESAN[kode] ?? PESAN_DEFAULT
}
