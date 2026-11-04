import { describe, expect, it } from "vitest"
import { jendelaLaporMandiri } from "../src/lib/domain/LaporMandiri"

describe("jendela laporan mandiri", () => {
  it("menggunakan periode dan tanggal berdasarkan WIB", () => {
    const jendela = jendelaLaporMandiri(new Date("2026-10-31T17:00:00.000Z"))
    expect(jendela.periode).toBe(202611)
    expect(jendela.tanggal).toBe(1)
    expect(jendela.boleh).toBe(true)
  })

  it("menolak hari di luar jendela awal", () => {
    const jendela = jendelaLaporMandiri(new Date("2026-11-25T17:00:00.000Z"))
    expect(jendela.tanggal).toBe(26)
    expect(jendela.boleh).toBe(false)
    expect(jendela.bukaBerikutnya).toBe("1 Desember 2026")
  })

  it("menggunakan jendela konfigurasi dan membuka di bulan yang sama", () => {
    const sebelumBuka = jendelaLaporMandiri(
      new Date("2026-11-02T17:00:00.000Z"),
      { tanggalBuka: 5, tanggalTutup: 20 }
    )
    expect(sebelumBuka.boleh).toBe(false)
    expect(sebelumBuka.bukaBerikutnya).toBe("5 November 2026")

    const hariBuka = jendelaLaporMandiri(new Date("2026-11-04T17:00:00.000Z"), {
      tanggalBuka: 5,
      tanggalTutup: 20,
    })
    expect(hariBuka.boleh).toBe(true)
    expect(hariBuka.tanggalBuka).toBe(5)
    expect(hariBuka.tanggalTutup).toBe(20)
  })

  it("menolak konfigurasi jendela yang tidak valid", () => {
    expect(() =>
      jendelaLaporMandiri(new Date("2026-11-04T17:00:00.000Z"), {
        tanggalBuka: 21,
        tanggalTutup: 20,
      })
    ).toThrow(RangeError)
    expect(() =>
      jendelaLaporMandiri(new Date("2026-11-04T17:00:00.000Z"), {
        tanggalBuka: 0,
        tanggalTutup: 20,
      })
    ).toThrow(RangeError)
  })
})
