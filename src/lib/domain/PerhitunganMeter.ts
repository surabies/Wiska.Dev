export function hitungPemakaianGantiMeter({
  standAwalLama,
  standAngkatLama,
  standMeterBaru,
}: {
  standAwalLama: number
  standAngkatLama: number
  standMeterBaru: number
}): number {
  const pemakaianMeterLama = standAngkatLama - standAwalLama
  return pemakaianMeterLama + standMeterBaru
}
