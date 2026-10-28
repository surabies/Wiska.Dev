// features/dashboard/components/verifikasi/warna-ring.ts — SATU tempat yang
// memutuskan warna di layar verifikasi.
//
// PALET DIKUNCI LIMA: abu-abu, amber, biru, hijau, merah. Tidak ada ungu/sky/
// emerald lagi. Setiap warna membawa SATU arti dan tidak dipakai untuk arti lain:
//   abu   = belum disentuh (menunggu, belum dibaca)
//   amber = sedang berjalan, butuh orang berikutnya (V1)
//   biru  = lolos pemeriksaan, tinggal persetujuan (V2)
//   hijau = selesai, resmi (V3)
//   merah = masalah (cek ulang, anomali)
//
// KENAPA TRANSPARAN (…-500/10), BUKAN PASANGAN …-50 + dark:…-950. Satu kelas
// mencampur diri dengan latar kartu di kedua tema, jadi tidak ada warna yang
// hanya benar di satu tema dan tabel tidak berubah jadi papan warna. Teksnya
// satu-satunya yang berganti langkah (700 terang / 400 gelap) demi kontras.

export type Tahap = "MENUNGGU" | "V1" | "V2" | "V3" | "DITOLAK"

/// Urutan ring yang sudah dilewati sebuah laporan.
export function tahapDari(row: {
  verif1At?: string | null
  verif2At?: string | null
  verif3At?: string | null
  verifiedAt?: string | null
  isVerified?: boolean | null
}): Tahap {
  if (row.verif3At) return "V3"
  // DITOLAK = verifiedAt terisi TANPA isVerified. Diperiksa sebelum V1/V2
  // karena penolakan mereset ring dan yang harus terlihat adalah "cek ulang".
  if (row.verifiedAt && !row.isVerified) return "DITOLAK"
  if (row.verif2At) return "V2"
  if (row.verif1At) return "V1"
  return "MENUNGGU"
}

export interface GayaTahap {
  label: string
  /// Latar baris — 4% saja, cukup untuk dibaca sekilas, tidak mengganggu angka.
  baris: string
  /// Lapisan tint untuk SEL BEKU. Sel beku harus opak (bg-card) supaya isi
  /// kolom lain tidak menembus saat digulir, jadi tintnya ditumpuk lewat
  /// pseudo-element, bukan lewat background yang akan saling menimpa.
  lapis: string
  /// Lencana status — pil tipis berbingkai, gaya Geist.
  lencana: string
  /// Garis kiri baris (penanda kedua bagi yang sulit membedakan warna).
  garis: string
  /// Titik kecil di samping teks / di ProgresRing.
  titik: string
  /// Warna teks untuk ikon & nama pada panel detail.
  teks: string
}

const LAPIS = "after:pointer-events-none after:absolute after:inset-0 "
const GARIS = "before:absolute before:inset-y-0 before:left-0 before:w-0.5 "

export const GAYA_TAHAP: Record<Tahap, GayaTahap> = {
  MENUNGGU: {
    label: "Menunggu",
    baris: "bg-transparent",
    lapis: "",
    lencana: "bg-neutral-500/10 text-neutral-700 ring-1 ring-inset ring-neutral-500/20 dark:text-neutral-300",
    garis: GARIS + "before:bg-neutral-300 dark:before:bg-neutral-700",
    titik: "bg-neutral-400 dark:bg-neutral-500",
    teks: "text-neutral-600 dark:text-neutral-400",
  },
  V1: {
    label: "V1 diperiksa",
    baris: "bg-amber-500/[0.04]",
    lapis: LAPIS + "after:bg-amber-500/[0.05]",
    lencana: "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-400",
    garis: GARIS + "before:bg-amber-500",
    titik: "bg-amber-500 dark:bg-amber-400",
    teks: "text-amber-700 dark:text-amber-400",
  },
  V2: {
    label: "V2 divalidasi",
    baris: "bg-blue-500/[0.04]",
    lapis: LAPIS + "after:bg-blue-500/[0.05]",
    lencana: "bg-blue-500/10 text-blue-700 ring-1 ring-inset ring-blue-500/25 dark:text-blue-400",
    garis: GARIS + "before:bg-blue-500",
    titik: "bg-blue-500 dark:bg-blue-400",
    teks: "text-blue-700 dark:text-blue-400",
  },
  V3: {
    label: "V3 resmi",
    baris: "bg-green-500/[0.04]",
    lapis: LAPIS + "after:bg-green-500/[0.05]",
    lencana: "bg-green-500/10 text-green-700 ring-1 ring-inset ring-green-500/25 dark:text-green-400",
    garis: GARIS + "before:bg-green-500",
    titik: "bg-green-500 dark:bg-green-400",
    teks: "text-green-700 dark:text-green-400",
  },
  DITOLAK: {
    label: "Cek ulang",
    baris: "bg-red-500/[0.04]",
    lapis: LAPIS + "after:bg-red-500/[0.05]",
    lencana: "bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/25 dark:text-red-400",
    garis: GARIS + "before:bg-red-500",
    titik: "bg-red-500 dark:bg-red-400",
    teks: "text-red-700 dark:text-red-400",
  },
}

/// "Belum dibaca" = ketiadaan laporan, bukan tahap verifikasi. Dulu ungu; kini
/// abu-abu BERGARIS PUTUS-PUTUS supaya tidak tertukar dengan "Menunggu"
/// (abu polos) tanpa perlu warna keenam.
export const GAYA_BELUM_DIBACA: GayaTahap = {
  label: "Belum dibaca",
  baris: "bg-transparent",
  lapis: "",
  lencana: "bg-transparent text-neutral-600 ring-1 ring-inset ring-neutral-400/50 dark:text-neutral-400",
  garis: GARIS + "before:bg-neutral-300 dark:before:bg-neutral-700",
  titik: "bg-neutral-400 dark:bg-neutral-500",
  teks: "text-neutral-600 dark:text-neutral-400",
}

/// Penanda anomali: lencana merah terpisah yang menumpang di atas warna tahap.
export function gayaAnomali(persentase: number | null, ambang: number): string | null {
  if (persentase === null) return null
  if (persentase > ambang || persentase < -ambang) {
    return "bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/25 dark:text-red-400"
  }
  return null
}

/// Titik ring V1/V2/V3 di tabel. Warna TIAP ring tetap: kalau V1 amber di
/// tabel, V1 amber juga di panel detail (ProgresRing) dan di dialog massal.
export const TITIK_RING = {
  1: GAYA_TAHAP.V1.titik,
  2: GAYA_TAHAP.V2.titik,
  3: GAYA_TAHAP.V3.titik,
} as const

export const TEKS_RING = {
  1: GAYA_TAHAP.V1.teks,
  2: GAYA_TAHAP.V2.teks,
  3: GAYA_TAHAP.V3.teks,
} as const