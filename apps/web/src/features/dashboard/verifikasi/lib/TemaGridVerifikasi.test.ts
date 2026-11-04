import { describe, expect, it } from "vitest"
import {
  tentukanLatarBaris,
  WARNA_BARIS_TAHAP,
} from "./TemaGridVerifikasi"

describe("tentukanLatarBaris", () => {
  it("prioritas pada seleksi aktif atau dipilih", () => {
    expect(
      tentukanLatarBaris({
        aktif: true,
        dipilih: false,
        tahap: "V1",
        koreksi: true,
      })
    ).toBe("bg-table-accent text-foreground")

    expect(
      tentukanLatarBaris({
        aktif: false,
        dipilih: true,
        tahap: "MENUNGGU",
        koreksi: true,
      })
    ).toBe("bg-table-accent text-foreground")
  })

  it("prioritas tahap verifikasi (V1, V2, V3) di atas koreksi", () => {
    // V1 harus amber meski baris pernah dikoreksi
    expect(
      tentukanLatarBaris({
        aktif: false,
        dipilih: false,
        tahap: "V1",
        koreksi: true,
      })
    ).toBe(WARNA_BARIS_TAHAP.V1)

    // V2 harus blue
    expect(
      tentukanLatarBaris({
        aktif: false,
        dipilih: false,
        tahap: "V2",
        koreksi: true,
      })
    ).toBe(WARNA_BARIS_TAHAP.V2)

    // V3 harus emerald
    expect(
      tentukanLatarBaris({
        aktif: false,
        dipilih: false,
        tahap: "V3",
        koreksi: true,
      })
    ).toBe(WARNA_BARIS_TAHAP.V3)

    // Ditolak harus rose
    expect(
      tentukanLatarBaris({
        aktif: false,
        dipilih: false,
        tahap: "DITOLAK",
        koreksi: true,
      })
    ).toBe(WARNA_BARIS_TAHAP.DITOLAK)
  })

  it("baris MENUNGGU yang dikoreksi memakai warna ungu", () => {
    expect(
      tentukanLatarBaris({
        aktif: false,
        dipilih: false,
        tahap: "MENUNGGU",
        koreksi: true,
      })
    ).toContain("bg-purple-500")
  })

  it("baris MENUNGGU tanpa koreksi memakai warna card default", () => {
    expect(
      tentukanLatarBaris({
        aktif: false,
        dipilih: false,
        tahap: "MENUNGGU",
        koreksi: false,
      })
    ).toBe(WARNA_BARIS_TAHAP.MENUNGGU)
  })
})
