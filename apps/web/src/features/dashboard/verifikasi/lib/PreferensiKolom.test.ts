import { describe, expect, it } from "vitest"
import {
  KOLOM_VERIFIKASI,
  normalisasiPreferensiKolom,
  pindahkanKolom,
  PREFERENSI_KOLOM_AWAL,
} from "./PreferensiKolom"

describe("preferensi kolom verifikasi", () => {
  it("uses the requested consistent initial order", () => {
    expect(PREFERENSI_KOLOM_AWAL.urutan).toEqual([
      "ring",
      "nomor",
      "nama",
      "alamat",
      "standAwal",
      "standAkhir",
      "standRevisi",
      "standResmi",
      "pakai",
      "lalu",
      "tagihan",
      "deviasi",
      "rute",
      "kondisi",
      "petugas",
      "tanggal",
      "status",
    ])
  })

  it("normalizes invalid, missing, and duplicate column state", () => {
    const hasil = normalisasiPreferensiKolom({
      urutan: ["nama", "nama", "unknown", "ring"],
      tampil: { nama: false, ring: "hidden" },
    })

    expect(hasil.urutan).toEqual([
      "nama",
      "ring",
      ...KOLOM_VERIFIKASI.filter(
        (kolom) => kolom !== "nama" && kolom !== "ring"
      ),
    ])
    expect(hasil.tampil.nama).toBe(false)
    expect(hasil.tampil.ring).toBe(true)
  })

  it("moves a column to the dropped column's position", () => {
    const hasil = pindahkanKolom(PREFERENSI_KOLOM_AWAL, "rute", "ring")
    expect(hasil.urutan.slice(0, 3)).toEqual(["rute", "ring", "nomor"])
  })

  it("supports moving a column down from the menu controls", () => {
    const hasil = pindahkanKolom(PREFERENSI_KOLOM_AWAL, "ring", "nomor")
    expect(hasil.urutan.slice(0, 3)).toEqual(["nomor", "ring", "nama"])
  })

  it("persists resizable widths within supported bounds", () => {
    const hasil = normalisasiPreferensiKolom({
      lebar: { nama: 390, alamat: 900, rute: 20 },
    })

    expect(hasil.lebar).toMatchObject({
      nama: 390,
      alamat: 800,
      rute: 48,
    })
  })
})
