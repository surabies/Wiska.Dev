export function hitungPemakaianGantiMeter({
  standAwalLama,
  standAngkatLama,
  standAwalMeterBaru,
  standAkhirMeterBaru,
}: {
  standAwalLama: number
  standAngkatLama: number
  standAwalMeterBaru: number
  standAkhirMeterBaru: number
}): number {
  const pemakaianMeterLama = Math.max(0, standAngkatLama - standAwalLama)
  const pemakaianMeterBaru = Math.max(
    0,
    standAkhirMeterBaru - standAwalMeterBaru,
  )
  return pemakaianMeterLama + pemakaianMeterBaru
}
