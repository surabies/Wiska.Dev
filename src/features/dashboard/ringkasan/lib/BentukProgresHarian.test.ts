import { describe, expect, it } from "vitest"
import { bentukProgresHarian } from "./BentukProgresHarian"

describe("bentukProgresHarian", () => {
  it("mengisi hari kosong dan menghitung akumulasi untuk periode aktif", () => {
    const hasil = bentukProgresHarian(202611, "2026-11-03", [
      { tanggal: "2026-11-01", jumlah: 2 },
      { tanggal: "2026-11-03", jumlah: 4 },
      { tanggal: "2026-12-01", jumlah: 99 },
    ])

    expect(hasil).toEqual([
      { tanggal: "2026-11-01", jumlah: 2, kumulatif: 2 },
      { tanggal: "2026-11-02", jumlah: 0, kumulatif: 2 },
      { tanggal: "2026-11-03", jumlah: 4, kumulatif: 6 },
    ])
  })

  it("menyertakan hari terakhir Februari pada tahun kabisat", () => {
    const hasil = bentukProgresHarian(202402, "2024-02-29", [
      { tanggal: "2024-02-29", jumlah: 3 },
    ])

    expect(hasil).toHaveLength(29)
    expect(hasil.at(-1)).toEqual({
      tanggal: "2024-02-29",
      jumlah: 3,
      kumulatif: 3,
    })
  })

  it("tidak membuat titik jika tanggal batas sebelum periode", () => {
    expect(bentukProgresHarian(202611, "2026-10-31", [])).toEqual([])
  })

  it("menolak bulan periode yang tidak valid", () => {
    expect(() => bentukProgresHarian(202613, "2026-12-31", [])).toThrow(
      "Periode tidak valid: 202613"
    )
  })
})
