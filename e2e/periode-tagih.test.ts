import { describe, expect, it } from "vitest"
import {
  PeriodeTidakValidError,
  akhirPeriodeEksklusif,
  awalPeriode,
  buatPeriode,
  parsePeriode,
  periodeBerikutnya,
  periodeDariWaktu,
  periodeQuerySchema,
  periodeSchema,
  periodeSebelumnya,
  periodeValid,
} from "./periode-tagih"

describe("validasi periode", () => {
  it.each([202601, 202612, 200001, 210012])("menerima %i", (p) => {
    expect(periodeValid(p)).toBe(true)
  })

  it.each([
    190001, // di luar rentang tahun
    202600, // bulan 00
    202613, // bulan 13
    999912,
    20261, // terlalu pendek
    2026011, // terlalu panjang
    202601.5,
    Number.NaN,
  ])("menolak %s", (p) => {
    expect(periodeValid(p)).toBe(false)
  })

  it("menolak non-angka", () => {
    expect(periodeValid("202601")).toBe(false)
    expect(periodeValid(null)).toBe(false)
    expect(periodeValid(undefined)).toBe(false)
  })

  it("parsePeriode melempar galat domain, bukan Error biasa", () => {
    expect(() => parsePeriode(202613)).toThrow(PeriodeTidakValidError)
    try {
      parsePeriode(202613)
    } catch (e) {
      expect((e as PeriodeTidakValidError).kode).toBe("PERIODE_TIDAK_VALID")
    }
    expect(parsePeriode(202611)).toEqual({ tahun: 2026, bulan: 11 })
  })
})

describe("aritmetika periode", () => {
  it("melewati batas tahun", () => {
    expect(periodeBerikutnya(202612)).toBe(202701)
    expect(periodeSebelumnya(202701)).toBe(202612)
    expect(periodeBerikutnya(202610)).toBe(202611)
    expect(periodeSebelumnya(202611)).toBe(202610)
  })

  it("buatPeriode menolak bulan di luar 1–12", () => {
    expect(buatPeriode(2026, 3)).toBe(202603)
    expect(() => buatPeriode(2026, 0)).toThrow(PeriodeTidakValidError)
    expect(() => buatPeriode(2026, 13)).toThrow(PeriodeTidakValidError)
  })
})

describe("batas periode menurut WIB", () => {
  it("awal periode = 00:00 WIB tanggal 1 (= 17:00 UTC hari sebelumnya)", () => {
    expect(awalPeriode(202611).toISOString()).toBe("2026-10-31T17:00:00.000Z")
  })

  it("akhir periode bersifat eksklusif dan bersambung dengan periode berikutnya", () => {
    expect(akhirPeriodeEksklusif(202611).toISOString()).toBe(
      awalPeriode(202612).toISOString()
    )
    expect(akhirPeriodeEksklusif(202612).toISOString()).toBe(
      "2026-12-31T17:00:00.000Z"
    )
  })

  it("pembacaan 00:30 WIB tanggal 1 masuk periode bulan itu, bukan bulan sebelumnya", () => {
    // 2026-11-01 00:30 WIB = 2026-10-31 17:30 UTC
    expect(periodeDariWaktu(new Date("2026-10-31T17:30:00.000Z"))).toBe(202611)
    // 2026-11-01 00:00 WIB tepat = batas awal
    expect(periodeDariWaktu(new Date("2026-10-31T17:00:00.000Z"))).toBe(202611)
    // 1 ms sebelum batas masih Oktober
    expect(periodeDariWaktu(new Date("2026-10-31T16:59:59.999Z"))).toBe(202610)
  })

  it("pergantian tahun menurut WIB", () => {
    expect(periodeDariWaktu(new Date("2026-12-31T17:00:00.000Z"))).toBe(202701)
    expect(periodeDariWaktu(new Date("2026-12-31T16:59:59.999Z"))).toBe(202612)
  })

  it("tahun kabisat: 29 Februari tetap Februari", () => {
    expect(periodeDariWaktu(new Date("2028-02-29T05:00:00.000Z"))).toBe(202802)
    expect(awalPeriode(202803).toISOString()).toBe("2028-02-29T17:00:00.000Z")
  })

  it("periodeDariWaktu konsisten dengan awalPeriode untuk semua bulan 2026–2027", () => {
    for (let t = 2026; t <= 2027; t++) {
      for (let b = 1; b <= 12; b++) {
        const p = buatPeriode(t, b)
        expect(periodeDariWaktu(awalPeriode(p))).toBe(p)
        expect(periodeDariWaktu(new Date(akhirPeriodeEksklusif(p).getTime() - 1))).toBe(p)
      }
    }
  })

  it("menolak Date yang tidak valid", () => {
    expect(() => periodeDariWaktu(new Date("bukan tanggal"))).toThrow(
      PeriodeTidakValidError
    )
  })
})

describe("schema Zod", () => {
  it("periodeSchema menerima YYYYMM valid dan menolak bulan 00/13", () => {
    expect(periodeSchema.safeParse(202611).success).toBe(true)
    expect(periodeSchema.safeParse(202600).success).toBe(false)
    expect(periodeSchema.safeParse(202613).success).toBe(false)
    expect(periodeSchema.safeParse("202611").success).toBe(false)
  })

  it("periodeQuerySchema meng-coerce string dari query string", () => {
    const ok = periodeQuerySchema.safeParse("202611")
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data).toBe(202611)
    expect(periodeQuerySchema.safeParse("202613").success).toBe(false)
    expect(periodeQuerySchema.safeParse("abc").success).toBe(false)
  })
})
