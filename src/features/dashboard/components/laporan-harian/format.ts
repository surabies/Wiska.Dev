const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

export const angka = (n: number) => n.toLocaleString("id-ID")

export const persenDari = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)

/** "2026-08-05" → "5 Agu" */
export function tanggalPendek(iso: string): string {
  const [, b, t] = iso.slice(0, 10).split("-")
  return `${Number(t)} ${BULAN[Number(b) - 1] ?? ""}`
}

export function warnaProgres(persen: number) {
  if (persen >= 80) return "bg-emerald-500"
  if (persen >= 50) return "bg-amber-500"
  return "bg-red-500"
}
