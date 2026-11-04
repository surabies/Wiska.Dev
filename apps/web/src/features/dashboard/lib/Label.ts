export function label(
  peta: Record<string, string>,
  nilai: string | null | undefined
): string {
  if (!nilai) return "—"
  return peta[nilai] ?? nilai
}
