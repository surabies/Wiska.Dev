// Pemformat tampilan untuk halaman Info Pelanggan. Semua menerima null/
// undefined dan mengembalikan "—" supaya sel kosong terlihat konsisten.

const KOSONG = "—"

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]
const BULAN_SINGKAT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
]

const adalahPeriode = (p: string | null | undefined): p is string =>
  !!p && /^\d{6}$/.test(p)

export function fmtAngka(n: number | null | undefined): string {
  return n == null ? KOSONG : n.toLocaleString("id-ID")
}

export function fmtRupiah(n: number | null | undefined): string {
  return n == null ? KOSONG : `Rp ${n.toLocaleString("id-ID")}`
}

/** "202609" → "September 2026". Nilai tak dikenal dikembalikan apa adanya. */
export function fmtPeriode(p: string | null | undefined): string {
  if (!p) return KOSONG
  if (!adalahPeriode(p)) return p
  const nama = BULAN[Number(p.slice(4)) - 1]
  return nama ? `${nama} ${p.slice(0, 4)}` : p
}

/** "202609" → "Sep 26" (untuk sumbu grafik). */
export function fmtPeriodeSingkat(p: string | null | undefined): string {
  if (!p) return KOSONG
  if (!adalahPeriode(p)) return p
  const nama = BULAN_SINGKAT[Number(p.slice(4)) - 1]
  return nama ? `${nama} ${p.slice(2, 4)}` : p
}

/** "202609" → "September" (untuk kalimat "dari Agustus"). */
export function fmtBulan(p: string | null | undefined): string {
  if (!adalahPeriode(p)) return p ?? KOSONG
  return BULAN[Number(p.slice(4)) - 1] ?? p
}

/** ISO → "09 Sep 2026, 09.06 WIB". */
export function fmtWaktu(iso: string | null | undefined): string {
  if (!iso) return KOSONG
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const teks = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(d)
  return `${teks} WIB`
}

export function fmtTeks(v: string | null | undefined): string {
  return v && v.trim() !== "" ? v : KOSONG
}
