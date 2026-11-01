export function pilihPemakaianLalu(
  ...nilai: (number | null | undefined)[]
): number | null {
  return nilai.find((item): item is number => item != null) ?? null
}
