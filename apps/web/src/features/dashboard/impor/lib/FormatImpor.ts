/** `<input type="month">` memberi "2026-07"; server menuntut 202607. */
export function keAngkaPeriode(bulan: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(bulan)
  if (!m) return null
  const angka = Number(`${m[1]}${m[2]}`)
  return Number.isFinite(angka) ? angka : null
}

export function ukuranBerkas(byte: number): string {
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`
}
