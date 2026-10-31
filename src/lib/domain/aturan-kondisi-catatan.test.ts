import { describe, expect, it } from "vitest"
import {
  hitungAturanKondisiCatat,
  KEBIJAKAN_KONDISI_CATAT,
} from "./aturan-kondisi-catatan"

const semuaKondisi = [
  "NORMAL",
  "TIDAK_DIPAKAI",
  "RUMAH_KOSONG",
  "STAND_TEMPEL",
  "STAND_KONSUMEN",
  "METER_RUSAK",
  "METER_MATI_ADA_AIR",
  "METER_MUNDUR",
  "METER_TERBALIK",
  "METER_DALAM_AIR",
  "LOS_METER",
  "BMK_BMB",
  "TTB",
  "MTA",
  "TERHALANG",
  "TIDAK_ADA_AIR",
  "ADA_ANJING",
  "DK",
  "MB",
  "MUDA_KEMBALI",
  "REV_PENCATAT",
  "DICABUT",
] as const

describe("hitungAturanKondisiCatat", () => {
  it("mendefinisikan kebijakan untuk setiap kondisi Prisma", () => {
    expect(Object.keys(KEBIJAKAN_KONDISI_CATAT).sort()).toEqual(
      [...semuaKondisi].sort(),
    )
  })

  it("menghitung delta NORMAL yang valid, termasuk pemakaian nol", () => {
    expect(
      hitungAturanKondisiCatat({
        kondisi: "NORMAL",
        standLalu: 100,
        standKini: 112,
      }),
    ).toEqual({ status: "TERUKUR", pemakaianRiil: 12 })

    expect(
      hitungAturanKondisiCatat({
        kondisi: "NORMAL",
        standLalu: 100,
        standKini: 100,
      }),
    ).toEqual({ status: "TERUKUR", pemakaianRiil: 0 })
  })

  it.each([
    ["stand sebelumnya kosong", null, 10],
    ["stand kini kosong", 10, null],
    ["stand negatif", 10, -1],
    ["stand pecahan", 10, 10.5],
    ["stand NaN", 10, Number.NaN],
    ["stand tak hingga", 10, Number.POSITIVE_INFINITY],
  ])("menahan %s untuk review", (_nama, standLalu, standKini) => {
    expect(
      hitungAturanKondisiCatat({
        kondisi: "NORMAL",
        standLalu,
        standKini,
      }),
    ).toEqual({ status: "PERLU_REVIEW", alasan: "STAND_TIDAK_VALID" })
  })

  it("menahan stand mundur untuk review, bukan mengubahnya menjadi nol", () => {
    expect(
      hitungAturanKondisiCatat({
        kondisi: "NORMAL",
        standLalu: 101,
        standKini: 100,
      }),
    ).toEqual({ status: "PERLU_REVIEW", alasan: "STAND_MUNDUR" })
  })

  it.each(semuaKondisi.filter((kondisi) => kondisi !== "NORMAL"))(
    "%s harus melalui review dan tidak membuat taksiran",
    (kondisi) => {
      expect(
        hitungAturanKondisiCatat({
          kondisi,
          standLalu: 100,
          standKini: 120,
        }),
      ).toEqual({ status: "PERLU_REVIEW", alasan: "KONDISI_BELUM_DITETAPKAN" })
    },
  )
})
