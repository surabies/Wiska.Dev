/**
 * formatters.ts — padanan `core/utils/formatters.dart`.
 *
 * Paket `intl` Dart digantikan `Intl` bawaan Hermes (React Native 0.86 +
 * Expo SDK 57 mengapal ICU penuh, jadi locale `id-ID` tersedia tanpa polyfill
 * — tidak perlu `initializeDateFormatting` seperti di bootstrap Flutter).
 *
 * ---- Periode (thbl) ----
 * `periode` punya DUA bentuk di API:
 *  - di query & body request: SELALU integer thbl (Mei 2026 = 202605);
 *  - di response: Tagihan/PembacaanMeter memakai ISO DateTime (tanggal 1 UTC),
 *    LaporanHarian/LaporanMandiri tetap integer thbl.
 * Helper ini satu-satunya jalur konversi dua arah — jangan hitung manual.
 *
 * Tanggal kanonik thbl selalu tengah malam UTC; semua helper di sini membaca
 * komponen UTC-nya supaya tidak tergeser sehari di zona WIB.
 */

/** Date (UTC) → integer thbl. */
export function thblDariDate(d: Date): number {
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
}

/** integer thbl → Date tengah malam 1 UTC. */
export function dateDariThbl(thbl: number): Date {
  return new Date(Date.UTC(Math.trunc(thbl / 100), (thbl % 100) - 1, 1));
}

/** String ISO → integer thbl (dibaca sebagai UTC). */
export function thblDariIso(iso: string): number {
  return thblDariDate(new Date(iso));
}

// Instans Intl dibuat sekali & dipakai ulang (lebih murah daripada per-panggil).
const fmtPeriode = new Intl.DateTimeFormat('id-ID', {
  year: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const fmtRupiah = new Intl.NumberFormat('id-ID');
const fmtTanggalUtc = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const fmtTanggalLokal = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const fmtBulanPendek = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' });
const fmtWaktuLokal = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "202605" → "Mei 2026". */
export function labelPeriode(thbl: number): string {
  return fmtPeriode.format(dateDariThbl(thbl));
}

/**
 * "202605" → "Mei". Nama bulan SAJA, bentuk pendek — untuk tempat sempit
 * seperti baris riwayat di layar catat, di mana tahunnya sudah jelas dari
 * konteks dan mengulangnya tiga kali hanya menghabiskan lebar.
 */
export function labelBulanPendek(thbl: number): string {
  return fmtBulanPendek.format(dateDariThbl(thbl));
}

// ---- Uang ----

export function formatRupiah(nilai: number): string {
  return `Rp ${fmtRupiah.format(nilai)}`;
}

/**
 * Angka berpemisah ribuan TANPA awalan "Rp" — untuk kolom tabel yang judulnya
 * sudah menyebut "Harga". Mengulang "Rp" di tiap baris hanya memakan lebar
 * yang justru dibutuhkan angkanya, dan aplikasi lama pun menulisnya begitu
 * ("683.100"), jadi petugas yang membandingkan kedua aplikasi melihat bentuk
 * yang sama.
 */
export function formatAngka(nilai: number): string {
  return fmtRupiah.format(nilai);
}

/**
 * Nominal tunggakan bisa BigInt (ratusan juta). `Intl.NumberFormat` menerima
 * `bigint` langsung — jangan konversi ke `number` (bisa kehilangan presisi).
 */
export function formatRupiahBigInt(nilai: bigint): string {
  return `Rp ${fmtRupiah.format(nilai)}`;
}

// ---- Tanggal ----

/**
 * Tanggal murni (jatuh tempo dll.) tersimpan tengah malam UTC — tampilkan
 * dengan komponen UTC, JANGAN digeser ke zona lokal (bisa mundur sehari di
 * WIB).
 */
export function formatTanggalUtc(d: Date): string {
  return fmtTanggalUtc.format(d);
}

/** Waktu kejadian (dibuat/diubah) — ini boleh dalam zona lokal pengguna. */
export function formatWaktuLokal(d: Date): string {
  return `${fmtTanggalLokal.format(d)} ${fmtWaktuLokal.format(d)}`;
}

// ---- Angka meter ----

export function formatM3(m3: number): string {
  return `${fmtRupiah.format(m3)} m³`;
}

// ---- Ukuran berkas ----

/**
 * Ukuran byte ringkas (B/KB/MB) — dipakai indikator penyimpanan antrean foto
 * yang belum terunggah di beranda petugas.
 */
export function formatUkuranByte(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  const kb = byte / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
