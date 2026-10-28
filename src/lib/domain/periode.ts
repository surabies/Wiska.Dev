// Shared conversion between the period formats used by Prisma models.
// berbeda di schema ini (mengikuti data sumber, bukan pilihan desain baru):
//   - PembacaanMeter.periode / Tagihan.periode : DateTime (tanggal 1 bulan ybs)
//   - LaporanHarianPetugas.periode / MutasiPelanggan.periode / Pemutusan.periode : Int (thbl, mis. 202605)
// API menerima/mengembalikan bentuk Int (thbl) di SEMUA modul supaya
// konsisten dari sisi client; konversi ke DateTime terjadi di sini.
// UTC dipakai eksplisit supaya periode tidak bergeser sebulan gara-gara
// timezone server (mis. 2026-05-01T00:00 lokal WIB = 2026-04-30T17:00 UTC).

export function periodeToDate(thbl: number): Date {
  const tahun = Math.floor(thbl / 100)
  const bulan = thbl % 100
  if (bulan < 1 || bulan > 12) {
    throw new Error(`Periode tidak valid: ${thbl} (bulan harus 01-12)`)
  }
  return new Date(Date.UTC(tahun, bulan - 1, 1))
}

export function dateToPeriode(date: Date): number {
  return date.getUTCFullYear() * 100 + (date.getUTCMonth() + 1)
}
