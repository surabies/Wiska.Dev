// Fungsi tanggal untuk penyaring rentang (zona WIB, bukan UTC).

/// Tanggal (YYYY-MM-DD) menurut WIB, bukan UTC dan bukan zona mesin.
/// `toISOString()` polos memberi tanggal UTC: pukul 06:00 WIB masih tanggal
/// KEMARIN di UTC, sehingga pintasan "Hari ini" akan menyaring hari yang
/// salah persis pada jam petugas mulai menyetor catatan. Server menafsirkan
/// tanggal ini sebagai hari WIB juga (server/lib/rentang-tanggal.ts).
const OFFSET_WIB_MS = 7 * 60 * 60 * 1000

export const TANGGAL_WIB = (mundurHari = 0) =>
  new Date(Date.now() + OFFSET_WIB_MS - mundurHari * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

export const PINTASAN_TANGGAL: {
  label: string
  rentang: () => [string, string]
}[] = [
  { label: "Hari ini", rentang: () => [TANGGAL_WIB(), TANGGAL_WIB()] },
  { label: "7 hari terakhir", rentang: () => [TANGGAL_WIB(6), TANGGAL_WIB()] },
  {
    label: "30 hari terakhir",
    rentang: () => [TANGGAL_WIB(29), TANGGAL_WIB()],
  },
  {
    label: "Bulan ini",
    rentang: () => [`${TANGGAL_WIB().slice(0, 8)}01`, TANGGAL_WIB()],
  },
]

/** "YYYY-MM-DD" -> Date pada zona mesin (tengah malam lokal). Sengaja bukan
 *  `new Date("YYYY-MM-DD")` yang ditafsirkan UTC dan bisa mundur sehari. */
export function tanggalDariTeks(teks: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return undefined
  const [y, m, d] = teks.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Date lokal -> "YYYY-MM-DD" lewat komponen lokalnya, bukan toISOString()
 *  (UTC) — kalau tidak, tanggal yang diklik bisa tergeser sehari. */
export function teksDariTanggal(tanggal: Date): string {
  const dua = (n: number) => String(n).padStart(2, "0")
  return `${tanggal.getFullYear()}-${dua(tanggal.getMonth() + 1)}-${dua(tanggal.getDate())}`
}

export function ringkasRentang(dari?: Date, sampai?: Date): string {
  const fmt = (d: Date, tahun: boolean) =>
    d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      ...(tahun ? { year: "numeric" } : {}),
    })
  if (dari && sampai) {
    if (teksDariTanggal(dari) === teksDariTanggal(sampai))
      return fmt(dari, true)
    const bedaTahun = dari.getFullYear() !== sampai.getFullYear()
    return `${fmt(dari, bedaTahun)} – ${fmt(sampai, true)}`
  }
  if (dari) return `Mulai ${fmt(dari, true)}`
  if (sampai) return `Sampai ${fmt(sampai, true)}`
  return "Semua tanggal"
}
