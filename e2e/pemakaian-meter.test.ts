import { describe, expect, it } from "vitest"
import {
  DEFAULT_PARAMETER,
  hitungBatasWajarAtas,
  hitungPemakaian,
  type InputHitung,
} from "./pemakaian-meter"

const dasar: InputHitung = {
  kondisi: "NORMAL",
  standLalu: 100,
  standKini: 112,
  kapasitasRegister: 99999,
  riwayat: [10, 12, 11],
}

describe("jalur normal", () => {
  it("menghitung selisih stand", () => {
    const h = hitungPemakaian(dasar)
    expect(h).toEqual({
      jenis: "TERUKUR",
      metode: "SELISIH",
      pemakaian: 12,
      flag: [],
    })
  })

  it("pemakaian 0 diberi flag, bukan dianggap salah", () => {
    const h = hitungPemakaian({ ...dasar, standKini: 100 })
    expect(h.jenis).toBe("TERUKUR")
    if (h.jenis === "TERUKUR") {
      expect(h.pemakaian).toBe(0)
      expect(h.flag).toContain("PEMAKAIAN_NOL")
      expect(h.flag).not.toContain("METER_MACET_DUGAAN")
    }
  })

  it("nol berturut-turut memicu dugaan meter macet", () => {
    const h = hitungPemakaian({ ...dasar, standKini: 100, riwayat: [0, 0, 8] })
    expect(h.jenis).toBe("TERUKUR")
    if (h.jenis === "TERUKUR") {
      expect(h.flag).toEqual(["PEMAKAIAN_NOL", "METER_MACET_DUGAAN"])
    }
  })

  it("pemakaian di atas batas wajar diberi flag", () => {
    const h = hitungPemakaian({
      ...dasar,
      standLalu: 0,
      standKini: 70,
      riwayat: [20, 20, 20],
    })
    expect(hitungBatasWajarAtas([20, 20, 20])).toBe(60)
    expect(h.jenis).toBe("TERUKUR")
    if (h.jenis === "TERUKUR") expect(h.flag).toContain("PEMAKAIAN_TINGGI")
  })

  it("RUMAH_KOSONG memakai jalur yang sama dengan NORMAL", () => {
    const h = hitungPemakaian({ ...dasar, kondisi: "RUMAH_KOSONG", standKini: 100 })
    expect(h.jenis).toBe("TERUKUR")
  })

  it("stand kini kosong pada kondisi NORMAL → review, bukan 0", () => {
    const h = hitungPemakaian({ ...dasar, standKini: null })
    expect(h).toMatchObject({
      jenis: "PERLU_REVIEW",
      alasan: "STAND_WAJIB_ADA",
      pemakaianUsulan: null,
    })
  })
})

describe("validasi input", () => {
  it.each([
    ["negatif", -1],
    ["pecahan", 10.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("menolak stand kini %s", (_nama, nilai) => {
    const h = hitungPemakaian({ ...dasar, standKini: nilai })
    expect(h).toMatchObject({
      jenis: "PERLU_REVIEW",
      alasan: "STAND_TIDAK_VALID",
    })
  })

  it("menolak stand yang melebihi kapasitas register", () => {
    const h = hitungPemakaian({ ...dasar, kapasitasRegister: 9999, standKini: 10000 })
    expect(h).toMatchObject({
      jenis: "PERLU_REVIEW",
      alasan: "STAND_MELEBIHI_KAPASITAS",
    })
  })
})

describe("rollover", () => {
  it("mengenali rollover yang masuk akal (register 4 digit)", () => {
    const h = hitungPemakaian({
      ...dasar,
      kapasitasRegister: 9999,
      standLalu: 9990,
      standKini: 5,
    })
    expect(h).toEqual({
      jenis: "TERUKUR",
      metode: "ROLLOVER",
      pemakaian: 15,
      flag: ["ROLLOVER_TERDETEKSI"],
    })
  })

  it("9999 → 0 berarti pemakaian 1 m³", () => {
    const h = hitungPemakaian({
      ...dasar,
      kapasitasRegister: 9999,
      standLalu: 9999,
      standKini: 0,
    })
    expect(h).toMatchObject({ jenis: "TERUKUR", metode: "ROLLOVER", pemakaian: 1 })
  })

  it("stand mundur jauh dari batas register BUKAN rollover → review, bukan 0", () => {
    const h = hitungPemakaian({ ...dasar, standLalu: 500, standKini: 20 })
    expect(h).toMatchObject({
      jenis: "PERLU_REVIEW",
      alasan: "STAND_MUNDUR_TIDAK_MASUK_AKAL",
      pemakaianUsulan: null,
    })
  })

  it("rollover yang menyiratkan pemakaian di luar batas wajar ditolak", () => {
    const h = hitungPemakaian({
      ...dasar,
      kapasitasRegister: 9999,
      standLalu: 9900,
      standKini: 10,
      riwayat: [10, 10, 10],
    })
    // tersirat 110 m³ > batas wajar max(50, 30) = 50
    expect(h).toMatchObject({
      jenis: "PERLU_REVIEW",
      alasan: "STAND_MUNDUR_TIDAK_MASUK_AKAL",
    })
  })
})

describe("penggantian meter", () => {
  const ganti: InputHitung = {
    kondisi: "METER_DIGANTI",
    standLalu: 480,
    standKini: 12,
    kapasitasRegister: 99999,
    penggantian: { standCabut: 495, standPasang: 0, kapasitasMeterBaru: 99999 },
    riwayat: [14, 15, 13],
  }

  it("menjumlahkan segmen meter lama dan meter baru", () => {
    expect(hitungPemakaian(ganti)).toEqual({
      jenis: "TERUKUR",
      metode: "SEGMEN_GANTI_METER",
      pemakaian: 27, // (495-480) + (12-0)
      flag: [],
    })
  })

  it("stand cabut lebih kecil dari stand lalu → review", () => {
    const h = hitungPemakaian({
      ...ganti,
      penggantian: { standCabut: 470, standPasang: 0, kapasitasMeterBaru: 99999 },
    })
    expect(h).toMatchObject({
      jenis: "PERLU_REVIEW",
      alasan: "SEGMEN_PENGGANTIAN_TIDAK_VALID",
    })
  })

  it("stand kini meter baru lebih kecil dari stand pasang → review", () => {
    const h = hitungPemakaian({
      ...ganti,
      standKini: 3,
      penggantian: { standCabut: 495, standPasang: 10, kapasitasMeterBaru: 99999 },
    })
    expect(h).toMatchObject({
      jenis: "PERLU_REVIEW",
      alasan: "SEGMEN_PENGGANTIAN_TIDAK_VALID",
    })
  })

  it("data penggantian tidak lengkap → review", () => {
    const h = hitungPemakaian({ ...ganti, penggantian: undefined })
    expect(h).toMatchObject({
      jenis: "PERLU_REVIEW",
      alasan: "DATA_PENGGANTIAN_TIDAK_LENGKAP",
    })
  })
})

describe("taksiran", () => {
  it.each([
    "METER_RUSAK",
    "METER_MATI",
    "METER_TERBALIK",
    "METER_HILANG",
    "RUMAH_TERKUNCI",
    "METER_TERHALANG",
  ] as const)("%s → taksiran yang wajib disetujui, stand kini diabaikan", (kondisi) => {
    const h = hitungPemakaian({
      ...dasar,
      kondisi,
      standKini: 99999, // angka tidak dipercaya pada kondisi ini
      riwayat: [20, 22, 18, 30],
    })
    expect(h).toEqual({
      jenis: "TAKSIRAN",
      metode: "RATA_RATA_RIWAYAT",
      pemakaian: 20, // rata-rata 3 periode terakhir: (20+22+18)/3
      dasar: [20, 22, 18],
      wajibPersetujuan: true,
      flag: [],
    })
  })

  it("pembulatan setengah ke atas", () => {
    const h = hitungPemakaian({
      ...dasar,
      kondisi: "METER_RUSAK",
      riwayat: [10, 11],
      parameter: { periodeTaksiran: 2 },
    })
    expect(h).toMatchObject({ jenis: "TAKSIRAN", pemakaian: 11 }) // 10,5 → 11
  })

  it("riwayat kurang dari minimum → review, tidak mengarang angka", () => {
    const h = hitungPemakaian({ ...dasar, kondisi: "METER_MATI", riwayat: [15] })
    expect(h).toMatchObject({
      jenis: "PERLU_REVIEW",
      alasan: "RIWAYAT_TIDAK_CUKUP_UNTUK_TAKSIRAN",
      pemakaianUsulan: null,
    })
  })

  it("mengabaikan nilai riwayat yang tidak valid", () => {
    const h = hitungPemakaian({
      ...dasar,
      kondisi: "METER_RUSAK",
      riwayat: [20, -5, Number.NaN, 22, 18],
    })
    expect(h).toMatchObject({ jenis: "TAKSIRAN", dasar: [20, 22, 18] })
  })
})

describe("invariant", () => {
  it("hasil TERUKUR tidak pernah negatif dan selisih normal selalu tepat", () => {
    // pembangkit pseudo-acak deterministik agar test stabil
    let seed = 12345
    const acak = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed
    }
    for (let i = 0; i < 2000; i++) {
      const kapasitas = [999, 9999, 99999][acak() % 3]!
      const lalu = acak() % (kapasitas + 1)
      const kini = acak() % (kapasitas + 1)
      const h = hitungPemakaian({
        kondisi: "NORMAL",
        standLalu: lalu,
        standKini: kini,
        kapasitasRegister: kapasitas,
        riwayat: [20, 20, 20],
      })
      if (h.jenis === "TERUKUR") {
        expect(h.pemakaian).toBeGreaterThanOrEqual(0)
        if (kini >= lalu) {
          expect(h.pemakaian).toBe(kini - lalu)
          expect(h.metode).toBe("SELISIH")
        } else {
          expect(h.metode).toBe("ROLLOVER")
          expect(h.pemakaian).toBe(kapasitas + 1 - lalu + kini)
          expect(h.pemakaian).toBeLessThanOrEqual(
            hitungBatasWajarAtas([20, 20, 20])
          )
        }
      } else {
        // satu-satunya alasan menolak input valid adalah stand mundur tidak masuk akal
        expect(h.jenis).toBe("PERLU_REVIEW")
        if (h.jenis === "PERLU_REVIEW") {
          expect(h.alasan).toBe("STAND_MUNDUR_TIDAK_MASUK_AKAL")
          expect(kini).toBeLessThan(lalu)
        }
      }
    }
  })

  it("parameter default tidak berubah tanpa disengaja", () => {
    expect(DEFAULT_PARAMETER).toEqual({
      periodeTaksiran: 3,
      minimumRiwayatTaksiran: 2,
      faktorBatasAtas: 3,
      lantaiBatasAtas: 50,
      periodeNolCurigaMacet: 3,
    })
  })

  it("fungsi murni: input tidak dimutasi", () => {
    const input: InputHitung = { ...dasar, riwayat: Object.freeze([10, 12, 11]) }
    const salinan = JSON.stringify(input)
    hitungPemakaian(input)
    expect(JSON.stringify(input)).toBe(salinan)
  })
})
