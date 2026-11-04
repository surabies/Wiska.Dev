import { describe, expect, it } from "vitest"
import { dataKoreksiDariBaris } from "./ModalKoreksi"

describe("dataKoreksiDariBaris", () => {
  it("maps customer number, name, and tariff separately from the relation", () => {
    const data = dataKoreksiDariBaris({
      nomorLangganan: "00009001791",
      pelangganId: "pelanggan-1",
      periode: 202608,
      standAwal: 237,
      standAkhir: 237,
      pemakaian: 0,
      pelanggan: {
        id: "pelanggan-1",
        nomorLangganan: "00009001791",
        nama: "CHENG PIN MOY",
        tarifGolongan: { kodeAsli: "R1" },
      },
    })

    expect(data.nomorLangganan).toBe("00009001791")
    expect(data.namaPelanggan).toBe("CHENG PIN MOY")
    expect(data.tarif).toBe("R1")
    expect(data.pelanggan).toBe("00009001791 CHENG PIN MOY")
  })

  it("uses the flattened tariff value when the customer relation is absent", () => {
    const data = dataKoreksiDariBaris({
      nomorLangganan: "00009001791",
      golonganTarif: "R1",
      periode: 202608,
      standAwal: 237,
      standAkhir: 237,
      pemakaian: 0,
    })

    expect(data.tarif).toBe("R1")
  })

  it("maps the new meter reading for the MB usage calculation", () => {
    const data = dataKoreksiDariBaris({
      standAwal: 2106,
      standAkhir: 2106,
      pemakaian: 6,
      kondisi: "MB",
      standAngkatLama: 2200,
      standMeterBaru: 10,
    })

    expect(data.standMeterBaru).toBe(10)
  })
})
