// server/lib/rentang-tanggal.ts — mengubah "YYYY-MM-DD s/d YYYY-MM-DD" dari
// toolbar menjadi filter Prisma untuk satu kolom DateTime.
//
// Tanggal "sampai" digeser ke AKHIR hari — tanpa ini "1 Jan s/d 1 Jan" tidak
// akan memuat satu baris pun karena kolomnya menyimpan jam juga.
//
// BATASNYA HARI WIB, BUKAN HARI UTC — dan ini bukan kehalusan. Versi
// sebelumnya memakai `new Date("2026-08-05")`, yang berarti tengah malam UTC
// = pukul 07.00 WIB. Setoran petugas yang dicatat subuh sampai pukul tujuh
// pagi — jam kerja pencatat meter — jatuh SEBELUM batas itu dan hilang dari
// hasil saringan "hari ini", padahal itu justru setoran hari itu. Masalah
// yang sama sudah ditangani untuk nomor tiket di modules/pengaduan/tiket.ts.
//
// SATU BERKAS UNTUK DUA PEMAKAI (setoran harian petugas & kiriman warga),
// karena aturannya memang satu. Kalau kelak batas harinya digeser atau zona
// waktunya berubah, memperbaikinya di satu tempat tidak boleh menyisakan
// salinan lain yang diam-diam tetap memakai aturan lama.

const OFFSET_WIB = "+07:00"

/** Filter Prisma { gte, lte } untuk satu kolom DateTime; `undefined` bila
 *  kedua batasnya kosong atau tidak terbaca. Keduanya inklusif dan boleh
 *  dipakai sendiri-sendiri. */
export function rentangTanggalWIB(
  dari?: string,
  sampai?: string,
): Record<string, Date> | undefined {
  const f: Record<string, Date> = {}
  if (dari) {
    const d = new Date(`${dari}T00:00:00.000${OFFSET_WIB}`)
    if (!Number.isNaN(d.getTime())) f.gte = d
  }
  if (sampai) {
    const d = new Date(`${sampai}T23:59:59.999${OFFSET_WIB}`)
    if (!Number.isNaN(d.getTime())) f.lte = d
  }
  return Object.keys(f).length > 0 ? f : undefined
}
