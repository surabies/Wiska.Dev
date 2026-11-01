import type { TitikProgresHarian } from "../types/TipeRingkasan"

export function bentukProgresHarian(
  periode: number,
  tanggalBatas: string,
  masukan: Array<{ tanggal: string; jumlah: number }>
): TitikProgresHarian[] {
  const tahun = Math.floor(periode / 100)
  const bulan = periode % 100
  if (bulan < 1 || bulan > 12) {
    throw new Error(`Periode tidak valid: ${periode} (bulan harus 01-12)`)
  }

  const awal = `${tahun}-${String(bulan).padStart(2, "0")}-01`
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const akhirPeriode = `${tahun}-${String(bulan).padStart(2, "0")}-${String(hariTerakhir).padStart(2, "0")}`
  const batas = tanggalBatas < akhirPeriode ? tanggalBatas : akhirPeriode
  if (batas < awal) return []

  const jumlahPerTanggal = new Map<string, number>()
  for (const baris of masukan) {
    if (baris.tanggal < awal || baris.tanggal > batas) continue
    jumlahPerTanggal.set(
      baris.tanggal,
      (jumlahPerTanggal.get(baris.tanggal) ?? 0) + baris.jumlah
    )
  }

  const hasil: TitikProgresHarian[] = []
  let kumulatif = 0
  for (let hari = 1; hari <= hariTerakhir; hari += 1) {
    const tanggal = `${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`
    if (tanggal > batas) break
    const jumlah = jumlahPerTanggal.get(tanggal) ?? 0
    kumulatif += jumlah
    hasil.push({ tanggal, jumlah, kumulatif })
  }

  return hasil
}
