import { describe, expect, it } from "vitest"
import {
  sertakanPenugasanPadaOpsiRute,
  saringOpsiPetugasRute,
  saringOpsiFilterPencarian,
  sesuaikanFilterPencarian,
  type OpsiFilterPencarian,
} from "./PenyaringanRelasi"

const opsi: OpsiFilterPencarian = {
  wilayahDistId: [
    { value: "wil-a", label: "Wilayah A" },
    { value: "wil-b", label: "Wilayah B" },
  ],
  zonaId: [
    { value: "zona-a", label: "Zona A", wilayahDistId: "wil-a" },
    { value: "zona-b", label: "Zona B", wilayahDistId: "wil-b" },
  ],
  ruteLanjutanId: [
    {
      value: "rute-a",
      label: "Rute A",
      wilayahDistId: "wil-a",
      pencatatIds: ["petugas-a"],
    },
    {
      value: "rute-b",
      label: "Rute B",
      wilayahDistId: "wil-b",
      pencatatIds: ["petugas-b"],
    },
  ],
  pencatatLanjutanId: [
    { value: "petugas-a", label: "Petugas A" },
    { value: "petugas-b", label: "Petugas B" },
  ],
  kecamatanId: [
    { value: "kec-a", label: "Kecamatan A" },
    { value: "kec-b", label: "Kecamatan B" },
  ],
  kelurahanId: [
    { value: "kel-a", label: "Kelurahan A", kecamatanId: "kec-a" },
    { value: "kel-b", label: "Kelurahan B", kecamatanId: "kec-b" },
  ],
}

function keadaan(nilai: Record<string, string>) {
  return {
    nilai,
    aktif: Object.fromEntries(
      Object.entries(nilai).map(([kunci, value]) => [kunci, value !== ""]),
    ),
  }
}

describe("filter relasi Cari Lanjutan", () => {
  it("menghubungkan opsi rute modal dengan petugas berdasarkan penugasan periode", () => {
    const opsiRuntime: OpsiFilterPencarian = {
      ruteLanjutanId: [
        { value: "rute-dadang", label: "Rute Dadang" },
        { value: "rute-agus", label: "Rute Agus" },
        { value: "rute-tanpa-petugas", label: "Rute Tanpa Petugas" },
      ],
      pencatatLanjutanId: [
        { value: "dadang", label: "Dadang" },
        { value: "agus", label: "Agus" },
      ],
    }
    const opsiTerhubung = sertakanPenugasanPadaOpsiRute(opsiRuntime, [
      { pencatatId: "dadang", ruteId: "rute-dadang" },
      { pencatatId: "agus", ruteId: "rute-agus" },
    ])
    const filterDadang = keadaan({ pencatatLanjutanId: "dadang" })

    expect(
      saringOpsiFilterPencarian(
        "ruteLanjutanId",
        opsiTerhubung.ruteLanjutanId!,
        filterDadang,
        opsiTerhubung,
      ).map(({ value }) => value),
    ).toEqual(["rute-dadang"])
    expect(
      saringOpsiFilterPencarian(
        "pencatatLanjutanId",
        opsiTerhubung.pencatatLanjutanId!,
        keadaan({ ruteLanjutanId: "rute-agus" }),
        opsiTerhubung,
      ).map(({ value }) => value),
    ).toEqual(["agus"])

    const opsiBelumDimuat = sertakanPenugasanPadaOpsiRute(
      opsiRuntime,
      [],
      false,
    )
    expect(opsiBelumDimuat.ruteLanjutanId?.every(({ disabled }) => disabled))
      .toBe(true)
    expect(opsiBelumDimuat.ruteLanjutanId?.[0]).not.toHaveProperty(
      "pencatatIds",
    )
  })

  it("tidak mengosongkan dropdown relasi ketika pilihan induk dihapus", () => {
    const nilaiAwal = keadaan({
      pencatatLanjutanId: "petugas-a",
      ruteLanjutanId: "rute-a",
      wilayahDistId: "wil-a",
      zonaId: "zona-a",
    })

    expect(
      sesuaikanFilterPencarian("pencatatLanjutanId", "", nilaiAwal, opsi).nilai,
    ).toMatchObject({
      pencatatLanjutanId: "",
      ruteLanjutanId: "rute-a",
    })
    expect(
      sesuaikanFilterPencarian("wilayahDistId", "", nilaiAwal, opsi).nilai,
    ).toMatchObject({
      wilayahDistId: "",
      zonaId: "zona-a",
      ruteLanjutanId: "rute-a",
    })
  })

  it("membatasi rute sesuai petugas dan petugas sesuai rute", () => {
    const filterPetugas = keadaan({ pencatatLanjutanId: "petugas-a" })
    expect(
      saringOpsiFilterPencarian(
        "ruteLanjutanId",
        opsi.ruteLanjutanId!,
        filterPetugas,
        opsi,
      ).map(({ value }) => value),
    ).toEqual(["rute-a"])

    const filterRute = keadaan({ ruteLanjutanId: "rute-b" })
    expect(
      saringOpsiFilterPencarian(
        "pencatatLanjutanId",
        opsi.pencatatLanjutanId!,
        filterRute,
        opsi,
      ).map(({ value }) => value),
    ).toEqual(["petugas-b"])
  })

  it("membatasi filter toolbar sesuai penugasan petugas-rute", () => {
    const hasil = saringOpsiPetugasRute(
      [
        { id: "petugas-a", namaLapangan: "Agus" },
        { id: "petugas-b", namaLapangan: "Budi" },
      ],
      [
        { id: "rute-a", kode: "Rute A" },
        { id: "rute-b", kode: "Rute B" },
      ],
      [
        { pencatatId: "petugas-a", ruteId: "rute-a" },
        { pencatatId: "petugas-b", ruteId: "rute-b" },
      ],
      "petugas-a",
      "",
    )

    expect(hasil.rutes.map(({ id }) => id)).toEqual(["rute-a"])

    const filterRute = saringOpsiPetugasRute(
      [
        { id: "petugas-a", namaLapangan: "Agus" },
        { id: "petugas-b", namaLapangan: "Budi" },
      ],
      [
        { id: "rute-a", kode: "Rute A" },
        { id: "rute-b", kode: "Rute B" },
      ],
      [
        { pencatatId: "petugas-a", ruteId: "rute-a" },
        { pencatatId: "petugas-b", ruteId: "rute-b" },
      ],
      "",
      "rute-b",
    )

    expect(filterRute.pencatats.map(({ id }) => id)).toEqual(["petugas-b"])
  })

  it("membatasi zona dan rute berdasarkan wilayah serta membatasi wilayah dari zona", () => {
    const filterWilayah = keadaan({ wilayahDistId: "wil-a" })
    expect(
      saringOpsiFilterPencarian("zonaId", opsi.zonaId!, filterWilayah, opsi).map(
        ({ value }) => value,
      ),
    ).toEqual(["zona-a"])
    expect(
      saringOpsiFilterPencarian(
        "ruteLanjutanId",
        opsi.ruteLanjutanId!,
        filterWilayah,
        opsi,
      ).map(({ value }) => value),
    ).toEqual(["rute-a"])

    const filterZona = keadaan({ zonaId: "zona-b" })
    expect(
      saringOpsiFilterPencarian(
        "wilayahDistId",
        opsi.wilayahDistId!,
        filterZona,
        opsi,
      ).map(({ value }) => value),
    ).toEqual(["wil-b"])
  })

  it("membatasi kelurahan berdasarkan kecamatan dan kecamatan berdasarkan kelurahan", () => {
    const filterKecamatan = keadaan({ kecamatanId: "kec-a" })
    expect(
      saringOpsiFilterPencarian(
        "kelurahanId",
        opsi.kelurahanId!,
        filterKecamatan,
        opsi,
      ).map(({ value }) => value),
    ).toEqual(["kel-a"])

    const filterKelurahan = keadaan({ kelurahanId: "kel-b" })
    expect(
      saringOpsiFilterPencarian(
        "kecamatanId",
        opsi.kecamatanId!,
        filterKelurahan,
        opsi,
      ).map(({ value }) => value),
    ).toEqual(["kec-b"])
  })

  it("membersihkan pilihan turunan yang tidak cocok setelah induknya berubah", () => {
    const nilaiAwal = keadaan({
      wilayahDistId: "wil-a",
      zonaId: "zona-a",
      ruteLanjutanId: "rute-a",
    })
    expect(
      sesuaikanFilterPencarian("wilayahDistId", "wil-b", nilaiAwal, opsi).nilai,
    ).toMatchObject({
      wilayahDistId: "wil-b",
      zonaId: "",
      ruteLanjutanId: "",
    })

    const pencatatAwal = keadaan({
      pencatatLanjutanId: "petugas-a",
      ruteLanjutanId: "rute-a",
    })
    expect(
      sesuaikanFilterPencarian(
        "pencatatLanjutanId",
        "petugas-b",
        pencatatAwal,
        opsi,
      ).nilai.ruteLanjutanId,
    ).toBe("")
  })
})
