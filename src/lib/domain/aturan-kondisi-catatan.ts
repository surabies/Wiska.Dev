import type { KondisiCatat } from "@generated"

type KebijakanKondisi = "HITUNG_DELTA" | "REVIEW"

export const KEBIJAKAN_KONDISI_CATAT = {
  NORMAL: "HITUNG_DELTA",
  TIDAK_DIPAKAI: "REVIEW",
  RUMAH_KOSONG: "REVIEW",
  STAND_TEMPEL: "REVIEW",
  STAND_KONSUMEN: "REVIEW",
  METER_RUSAK: "REVIEW",
  METER_MATI_ADA_AIR: "REVIEW",
  METER_MUNDUR: "REVIEW",
  METER_TERBALIK: "REVIEW",
  METER_DALAM_AIR: "REVIEW",
  LOS_METER: "REVIEW",
  BMK_BMB: "REVIEW",
  TTB: "REVIEW",
  MTA: "REVIEW",
  TERHALANG: "REVIEW",
  TIDAK_ADA_AIR: "REVIEW",
  ADA_ANJING: "REVIEW",
  DK: "REVIEW",
  MB: "REVIEW",
  MUDA_KEMBALI: "REVIEW",
  REV_PENCATAT: "REVIEW",
  DICABUT: "REVIEW",
} satisfies Record<KondisiCatat, KebijakanKondisi>

export type HasilAturanKondisiCatat =
  | { status: "TERUKUR"; pemakaianRiil: number }
  | {
      status: "PERLU_REVIEW"
      alasan:
        | "KONDISI_BELUM_DITETAPKAN"
        | "STAND_TIDAK_VALID"
        | "STAND_MUNDUR"
    }

export interface InputAturanKondisiCatat {
  kondisi: KondisiCatat
  standLalu: number | null
  standKini: number | null
}

function bilanganBulatNonNegatif(nilai: number | null): nilai is number {
  return (
    typeof nilai === "number" &&
    Number.isSafeInteger(nilai) &&
    Number.isFinite(nilai) &&
    nilai >= 0
  )
}

export function hitungAturanKondisiCatat(
  input: InputAturanKondisiCatat,
): HasilAturanKondisiCatat {
  const kebijakan = KEBIJAKAN_KONDISI_CATAT[input.kondisi]

  if (kebijakan === "HITUNG_DELTA") {
    if (
      !bilanganBulatNonNegatif(input.standLalu) ||
      !bilanganBulatNonNegatif(input.standKini)
    ) {
      return { status: "PERLU_REVIEW", alasan: "STAND_TIDAK_VALID" }
    }
    if (input.standKini < input.standLalu) {
      return { status: "PERLU_REVIEW", alasan: "STAND_MUNDUR" }
    }
    return {
      status: "TERUKUR",
      pemakaianRiil: input.standKini - input.standLalu,
    }
  }

  return { status: "PERLU_REVIEW", alasan: "KONDISI_BELUM_DITETAPKAN" }
}
