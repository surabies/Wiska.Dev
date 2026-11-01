import { hitungPemakaianGantiMeter } from "@/lib/domain/PerhitunganMeter"
import type { BarisVerifikasi } from "../types/TipeVerifikasi"

type DataPembacaan = Pick<
  BarisVerifikasi,
  | "standAwal"
  | "standAwalRevisi"
  | "standAkhir"
  | "standAkhirRevisi"
  | "pemakaian"
  | "kondisi"
  | "kondisiRevisi"
  | "standAngkatLama"
  | "standMeterBaru"
  | "pembacaan"
>

export function tentukanHasilPembacaan(row: DataPembacaan) {
  const standAwal = row.standAwalRevisi ?? row.standAwal ?? null
  const kondisi = row.kondisiRevisi ?? row.kondisi
  const standAkhir =
    kondisi === "MB" && row.standAngkatLama != null
      ? row.standAngkatLama
      : (row.pembacaan?.standAkhir ??
        row.standAkhirRevisi ??
        row.standAkhir ??
        null)
  const adaKoreksi =
    row.standAwalRevisi != null ||
    row.standAkhirRevisi != null ||
    row.kondisiRevisi != null ||
    row.standAngkatLama != null ||
    row.standMeterBaru != null

  let pemakaian = row.pemakaian ?? row.pembacaan?.pemakaianRiil ?? null

  if (row.pembacaan?.pemakaianRiil != null) {
    pemakaian = row.pembacaan.pemakaianRiil
  } else if (adaKoreksi && standAwal != null && standAkhir != null) {
    pemakaian =
      kondisi === "MB" &&
      row.standAngkatLama != null &&
      row.standMeterBaru != null
        ? hitungPemakaianGantiMeter({
            standAwalLama: standAwal,
            standAngkatLama: row.standAngkatLama,
            standMeterBaru: row.standMeterBaru,
          })
        : standAkhir - standAwal
  }

  return { standAwal, standAkhir, pemakaian }
}
