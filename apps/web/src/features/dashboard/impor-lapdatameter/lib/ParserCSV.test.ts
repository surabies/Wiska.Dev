import { describe, expect, it } from "vitest"
import { petakanPencatatan, petakanPemutusan, uraiCsv } from "./ParserCSV"

describe("uraiCsv", () => {
  it("removes a UTF-8 BOM and respects quoted delimiters", () => {
    const hasil = uraiCsv(
      '\uFEFFNo Pel;Periode;Keterangan\r\n001;202601;"Jalan; gang utama"'
    )

    expect(hasil).toEqual({
      header: ["No Pel", "Periode", "Keterangan"],
      baris: [["001", "202601", "Jalan; gang utama"]],
    })
  })

  it("maps valid reading rows and reports invalid customer numbers", () => {
    const tabel = uraiCsv(
      [
        "No Pel,Periode,St AWAL,St Akhir,Pakai,Kd_kel",
        "00A06100820,202601,1.234,1.250,16,NORMAL",
        "12!,202601,1,2,1,TERHALANG",
      ].join("\n")
    )

    expect(petakanPencatatan(tabel)).toEqual({
      baris: [
        {
          baris: 2,
          nomorLangganan: "00A06100820",
          periode: 202601,
          standAwal: 1234,
          standAkhir: 1250,
          pemakaian: 16,
          pemakaianLalu: null,
          persentase: null,
          kondisi: "NORMAL",
          namaPetugas: null,
          tanggalCatat: null,
        },
      ],
      ditolak: [
        {
          baris: 3,
          alasan: 'Nomor langganan tidak sah: "12!"',
        },
      ],
      periode: [202601],
    })
  })

  it("normalizes US-style dates in termination rows", () => {
    const tabel = uraiCsv(
      [
        "periode,jenis_pemutusan,nomor_pelanggan,no_surat,tgl_tutup,tgl_cabut",
        "202601,tsm,00123456789,SK/1,1/2/26,2026-01-03",
      ].join("\n")
    )

    expect(petakanPemutusan(tabel)).toEqual({
      baris: [
        {
          baris: 2,
          nomorLangganan: "00123456789",
          periode: 202601,
          jenis: "TSM",
          noSurat: "SK/1",
          tanggalTutup: "2026-01-02",
          tanggalCabut: "2026-01-03",
        },
      ],
      ditolak: [],
      periode: [202601],
    })
  })
})
