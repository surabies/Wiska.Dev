import { describe, expect, it } from "vitest"
import { pilihPemakaianLalu } from "./pemakaian-lalu"

describe("pilihPemakaianLalu", () => {
  it("mempertahankan nilai laporan bila tersedia", () => {
    expect(pilihPemakaianLalu(12, 10)).toBe(12)
    expect(pilihPemakaianLalu(0, 10)).toBe(0)
  })

  it("memakai pemakaian periode resmi sebelumnya saat snapshot kosong", () => {
    expect(pilihPemakaianLalu(null, undefined, 10)).toBe(10)
  })

  it("tidak mengubah nilai sumber negatif secara diam-diam", () => {
    expect(pilihPemakaianLalu(-1, 10)).toBe(-1)
  })

  it("mengembalikan null bila tidak ada sumber pembanding", () => {
    expect(pilihPemakaianLalu(null, undefined, null)).toBeNull()
  })
})
