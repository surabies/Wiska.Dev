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
    kondisi === "MB" && row.standMeterBaru != null
      ? row.standMeterBaru
      : (row.pembacaan?.standAkhir ??
        row.standAkhirRevisi ??
        row.standAkhir ??
        row.standAngkatLama ??
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
  } else if (adaKoreksi && standAwal != null) {
    pemakaian =
      kondisi === "MB" &&
      row.standAngkatLama != null &&
      row.standMeterBaru != null
        ? hitungPemakaianGantiMeter({
            standAwalLama: standAwal,
            standAngkatLama: row.standAngkatLama,
            standMeterBaru: row.standMeterBaru,
          })
        : standAkhir != null
          ? standAkhir - standAwal
          : null
  }

  return { standAwal, standAkhir, pemakaian }
}
