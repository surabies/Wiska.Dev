// features/publik/lib/format.ts — pemformatan untuk tampilan publik.
//
// SEMUA di file ini deterministik dan TIDAK bergantung locale/zona waktu
// mesin. Itu disengaja: komponen ini dirender di server lalu di-hydrate di
// browser, dan `toLocaleDateString()` tanpa opsi eksplisit bisa menghasilkan
// string BERBEDA di server (UTC) vs browser (WIB) — hasilnya hydration
// mismatch yang muncul acak, bukan saat dites.

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

/** 202605 -> "Mei 2026" */
export function formatPeriode(thbl: number): string {
  const tahun = Math.floor(thbl / 100)
  const bulan = thbl % 100
  return `${BULAN[bulan - 1] ?? "?"} ${tahun}`
}

/** 202605 -> "Mei". Untuk label sumbu grafik, di mana tahun penuh kepanjangan. */
export function formatBulanSingkat(thbl: number): string {
  const bulan = thbl % 100
  return (BULAN[bulan - 1] ?? "?").slice(0, 3)
}

/** 173540 -> "Rp 173.540" */
export function formatRupiah(nilai: number): string {
  return `Rp ${nilai.toLocaleString("id-ID")}`
}

/** 3012396720 -> "Rp 3,01 M". Untuk kartu statistik & sumbu grafik.
 *
 * Angka penuh TIDAK muat di kartu statistik: nilai tagihan sebulan mencapai
 * ratusan juta–miliar rupiah, dan versi panjangnya terpotong jadi
 * "Rp 3.012.3…" — persis kondisi yang membuat angkanya tak terbaca sama
 * sekali. Bentuk ringkas juga lebih mudah dibandingkan sekilas antar kartu.
 * Nilai penuh tetap dipakai di tabel/rincian, di mana ruangnya ada. */
export function formatRupiahRingkas(nilai: number): string {
  if (nilai >= 1_000_000_000) return `Rp ${(nilai / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`
  if (nilai >= 1_000_000) return `Rp ${(nilai / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
  if (nilai >= 1_000) return `Rp ${(nilai / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`
  return `Rp ${nilai}`
}

/** ISO string -> "1 Juni 2026". Dibaca sebagai UTC karena backend menyimpan
 *  tanggal jatuh tempo sebagai tanggal murni (tengah malam UTC) — memakai
 *  getDate() lokal akan menggeser tanggalnya sehari di zona WIB. */
export function formatTanggal(iso: string | null): string {
  if (!iso) return "-"
  const d = new Date(iso)
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export const LABEL_STATUS_TAGIHAN: Record<string, string> = {
  BELUM_BAYAR: "Belum dibayar",
  SUDAH_BAYAR: "Lunas",
  JATUH_TEMPO: "Jatuh tempo",
  DIHAPUSKAN: "Dihapuskan",
}

export interface StatusTagihanTampilan {
  label: string
  badgeClass: string
  dotClass: string
  textClass: string
}

/** Warna status per baris tagihan. Skala warna Tailwind + varian `dark:`
 *  eksplisit di tiap kelas (bukan token semantik netral bg-background/dst)
 *  — konsisten dengan cara shadcn sendiri memberi warna status/severity;
 *  aturan "token semantik saja" di FRONTEND.md soal mencegah bg-white/
 *  text-gray-500 yang TIDAK punya padanan .dark, bukan soal warna status. */
export const STATUS_TAGIHAN_CONFIG: Record<string, StatusTagihanTampilan> = {
  BELUM_BAYAR: {
    label: "Belum dibayar",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  SUDAH_BAYAR: {
    label: "Lunas",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  JATUH_TEMPO: {
    label: "Jatuh tempo",
    badgeClass: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
    dotClass: "bg-red-500",
    textClass: "text-red-700 dark:text-red-400",
  },
  DIHAPUSKAN: {
    label: "Dihapuskan",
    badgeClass: "border-border bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
}

export function statusTagihanTampilan(status: string): StatusTagihanTampilan {
  return STATUS_TAGIHAN_CONFIG[status] ?? STATUS_TAGIHAN_CONFIG.BELUM_BAYAR!
}

/// Kode status tiket — cerminan enum `StatusPengaduan` (prisma/pengaduan.prisma).
///
/// Didefinisikan di sisi PUBLIK karena halaman pelacakan wargalah yang
/// merender seluruh nilainya; sisi dashboard mengimpornya kembali lewat
/// features/dashboard/components/pengaduan/tipe.ts.
///
/// Union ini yang mengunci kedua peta label (warga & staf) tetap lengkap:
/// menambah status baru di Prisma tanpa memberinya label akan gagal
/// dikompilasi, bukan diam-diam bocor ke layar sebagai enum mentah.
export type StatusPengaduan =
  | "BARU"
  | "TERVERIFIKASI"
  | "DITUGASKAN"
  | "MENUJU_LOKASI"
  | "DIPROSES"
  | "MENUNGGU_PELANGGAN"
  | "SELESAI"
  | "DITUTUP"
  | "DIBUKA_KEMBALI"
  | "DITOLAK"

export type NadaStatus = Omit<StatusTagihanTampilan, "label">

/// Warna status tiket — DIPAKAI BERSAMA warga dan petugas.
///
/// Yang berbeda antara kedua sisi hanya TEKS-nya (LABEL_STATUS_PENGADUAN_WARGA
/// di bawah vs LABEL_STATUS_PENGADUAN_STAF di features/dashboard/lib/label.ts);
/// warnanya tidak — "selesai" tetap hijau bagi siapa pun yang membacanya.
///
/// Skala warna Tailwind + varian `dark:` eksplisit, mengikuti pola
/// STATUS_TAGIHAN_CONFIG di atas (lihat catatan di sana soal kenapa ini tidak
/// melanggar aturan token semantik di FRONTEND.md).
export const NADA_STATUS_PENGADUAN: Record<StatusPengaduan, NadaStatus> = {
  BARU: {
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
    dotClass: "bg-blue-500",
    textClass: "text-blue-700 dark:text-blue-400",
  },
  TERVERIFIKASI: {
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400",
    dotClass: "bg-sky-500",
    textClass: "text-sky-700 dark:text-sky-400",
  },
  DITUGASKAN: {
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  MENUJU_LOKASI: {
    badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-400",
    dotClass: "bg-cyan-500",
    textClass: "text-cyan-700 dark:text-cyan-400",
  },
  DIPROSES: {
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  MENUNGGU_PELANGGAN: {
    badgeClass:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400",
    dotClass: "bg-violet-500",
    textClass: "text-violet-700 dark:text-violet-400",
  },
  SELESAI: {
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  DITUTUP: {
    badgeClass: "border-border bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
  DIBUKA_KEMBALI: {
    badgeClass:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-400",
    dotClass: "bg-orange-500",
    textClass: "text-orange-700 dark:text-orange-400",
  },
  DITOLAK: {
    badgeClass: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
    dotClass: "bg-red-500",
    textClass: "text-red-700 dark:text-red-400",
  },
}

/// Kode tak dikenal (mis. status baru yang belum sampai ke bundel browser)
/// jatuh ke BARU — sama seperti perilaku lama, lebih baik memilih status
/// paling awal daripada merender badge kosong.
export function kodeStatusPengaduan(status: string): StatusPengaduan {
  return status in NADA_STATUS_PENGADUAN ? (status as StatusPengaduan) : "BARU"
}

/// Label DIBACA WARGA — ditulis dari sudut pandang mereka, bukan sudut
/// pandang basis data. "BARU" jadi "Diterima" (yang penting bagi pelapor
/// adalah laporannya sampai, bukan bahwa barisnya baru), dan
/// "MENUNGGU_PELANGGAN" jadi ajakan bertindak, bukan tuduhan.
///
/// "Anda" di peta ini = PELAPOR. Karena itu peta ini HANYA boleh dipakai di
/// permukaan yang dibaca warga (halaman publik & /akun). Dipakai di dashboard,
/// "Anda" berubah arti jadi operator yang sedang membaca layar — persis salah
/// orang, karena yang ditunggu justru konfirmasi si pelapor. Sisi petugas
/// punya petanya sendiri: LABEL_STATUS_PENGADUAN_STAF di
/// features/dashboard/lib/label.ts.
export const LABEL_STATUS_PENGADUAN_WARGA: Record<StatusPengaduan, string> = {
  BARU: "Diterima",
  TERVERIFIKASI: "Terverifikasi operator",
  DITUGASKAN: "Ditugaskan ke petugas",
  MENUJU_LOKASI: "Petugas menuju lokasi",
  DIPROSES: "Sedang ditangani",
  MENUNGGU_PELANGGAN: "Menunggu tanggapan Anda",
  SELESAI: "Selesai — menunggu konfirmasi Anda",
  DITUTUP: "Ditutup",
  DIBUKA_KEMBALI: "Dibuka kembali",
  DITOLAK: "Ditolak",
}

/// Label warga + nada warna — bentuk siap pakai untuk badge & titik status.
export function statusPengaduanWarga(status: string): StatusTagihanTampilan {
  const kode = kodeStatusPengaduan(status)
  return { label: LABEL_STATUS_PENGADUAN_WARGA[kode], ...NADA_STATUS_PENGADUAN[kode] }
}

/// Kode status laporan meter mandiri — cerminan enum `StatusLaporanMandiri`
/// (prisma/operasional.prisma). DIVERIFIKASI ada di enum tapi praktis tidak
/// pernah tersimpan (PATCH /:id/verify melompat langsung ke DIGUNAKAN, lihat
/// server/modules/laporan/laporan-mandiri.router.ts) — tetap dipetakan di
/// sini demi kelengkapan tipe, warnanya disamakan dengan DIGUNAKAN.
export type StatusLaporanMandiri = "MENUNGGU" | "DIVERIFIKASI" | "DITOLAK" | "DIGUNAKAN"

export const LABEL_STATUS_LAPORAN_MANDIRI_WARGA: Record<StatusLaporanMandiri, string> = {
  MENUNGGU: "Menunggu verifikasi petugas",
  DIVERIFIKASI: "Diverifikasi petugas",
  DIGUNAKAN: "Diverifikasi & dipakai hitung tagihan",
  DITOLAK: "Ditolak — perlu dikirim ulang",
}

export const NADA_STATUS_LAPORAN_MANDIRI: Record<StatusLaporanMandiri, NadaStatus> = {
  MENUNGGU: {
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  DIVERIFIKASI: {
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  DIGUNAKAN: {
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  DITOLAK: {
    badgeClass: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
    dotClass: "bg-red-500",
    textClass: "text-red-700 dark:text-red-400",
  },
}

function kodeStatusLaporanMandiri(status: string): StatusLaporanMandiri {
  return status in NADA_STATUS_LAPORAN_MANDIRI ? (status as StatusLaporanMandiri) : "MENUNGGU"
}

/// Label warga + nada warna — bentuk siap pakai untuk badge status laporan
/// meter, pola sama dengan statusPengaduanWarga() di atas.
export function statusLaporanMandiriWarga(status: string): StatusTagihanTampilan {
  const kode = kodeStatusLaporanMandiri(status)
  return { label: LABEL_STATUS_LAPORAN_MANDIRI_WARGA[kode], ...NADA_STATUS_LAPORAN_MANDIRI[kode] }
}

/** ISO string -> "17 Juli 2026, 14.05". Linimasa tindak lanjut butuh JAM,
 *  bukan cuma tanggal: beberapa peristiwa terjadi di hari yang sama dan
 *  tanpa jam urutannya jadi tidak terbaca.
 *
 *  WIB eksplisit (UTC+7), bukan zona mesin. Komponen ini dirender di server
 *  lalu di-hydrate di browser — `toLocaleString()` tanpa zona eksplisit
 *  menghasilkan string berbeda di server (UTC) dan browser (WIB), dan
 *  hasilnya hydration mismatch yang muncul acak. Lihat catatan header. */
export function formatWaktu(iso: string | null): string {
  if (!iso) return "-"
  const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000)
  const jam = String(wib.getUTCHours()).padStart(2, "0")
  const menit = String(wib.getUTCMinutes()).padStart(2, "0")
  return `${wib.getUTCDate()} ${BULAN[wib.getUTCMonth()]} ${wib.getUTCFullYear()}, ${jam}.${menit}`
}

/** Sisa menit SLA -> "2 jam 15 menit lagi" / "terlambat 3 jam".
 *  Dibulatkan ke satuan yang berarti bagi manusia: "terlambat 4.317 menit"
 *  secara teknis benar tapi tidak memberi tahu apa pun. */
export function formatSisaWaktu(sisaMenit: number | null): string {
  if (sisaMenit === null) return "-"
  const lewat = sisaMenit < 0
  const total = Math.abs(sisaMenit)
  const hari = Math.floor(total / 1440)
  const jam = Math.floor((total % 1440) / 60)
  const menit = total % 60

  const bagian = hari > 0 ? `${hari} hari${jam ? ` ${jam} jam` : ""}` : jam > 0 ? `${jam} jam${menit ? ` ${menit} menit` : ""}` : `${menit} menit`
  return lewat ? `terlambat ${bagian}` : `${bagian} lagi`
}

/// URL video yang dioptimasi untuk pemutaran web. Untuk aset Cloudinary,
/// menyisipkan transformasi `q_auto,f_auto` tepat setelah `/upload/` — inilah
/// "kompresi"-nya: Cloudinary mengirim varian ter-transcode yang jauh lebih
/// kecil, dipilih otomatis sesuai kemampuan browser, TANPA transcoding berat
/// di HP warga. URL non-Cloudinary (fallback disk lokal dev) dikembalikan apa
/// adanya. Aman dipanggil dengan null.
export function urlVideoTeroptimasi(url: string | null): string | null {
  if (!url) return null
  const penanda = "/upload/"
  const i = url.indexOf(penanda)
  if (!url.includes("res.cloudinary.com") || i === -1) return url
  const sesudah = i + penanda.length
  return `${url.slice(0, sesudah)}q_auto,f_auto/${url.slice(sesudah)}`
}

export const LABEL_KLASIFIKASI_PENGADUAN: Record<string, string> = {
  NILAI_TAGIHAN_REKENING: "Nilai Tagihan Rekening",
  BUKAN_NILAI_TAGIHAN_REKENING: "Bukan Nilai Tagihan Rekening",
}

/// Urutannya mengikuti urutan resmi di loket pengaduan — dipertahankan apa
/// adanya karena objek ini JUGA yang mengurutkan pilihan di formulir.
export const LABEL_JENIS_PENGADUAN: Record<string, string> = {
  LAPOR_STAND_METER: "Lapor Stand Meter",
  MUTASI_GOLONGAN_TARIF: "Mutasi Gol. Tarif",
  TIDAK_MAMPU_BAYAR: "Tidak Mampu Bayar",
  PENCATATAN_METER_TIDAK_SESUAI: "Pencatatan Meter Tidak Sesuai",
  LONJAKAN_PEMAKAIAN_AIR: "Melonjakan Pemakaian Air",
  GANTI_STOP_KRAN: "Ganti Stop Kran",
  BOCOR_PIPA_DINAS: "Bocor Pipa Dinas",
  PASANGAN_LIAR: "Pasangan Liar",
  TIDAK_ADA_AIR: "Tidak Ada Air",
  AIR_KERUH_BAU_BERWARNA: "Air Keruh Bau dan Berwarna",
  PINDAH_JARINGAN: "Pindah Jaringan",
  LAINNYA: "Lainnya",
}
