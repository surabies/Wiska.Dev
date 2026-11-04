/**
 * Perhitungan pemakaian meter air — modul domain MURNI.
 *
 * Aturan:
 *  - Tidak mengimpor Prisma, Hono, atau apa pun yang berefek samping.
 *    Input masuk, hasil keluar; mudah diuji dan dipakai ulang oleh API,
 *    worker sinkronisasi, dan skrip impor.
 *  - TIDAK PERNAH diam-diam menghasilkan 0 saat data meragukan. Stand mundur
 *    yang tidak masuk akal, data kurang, atau kondisi khusus berakhir sebagai
 *    PERLU_REVIEW atau TAKSIRAN (yang wajib disetujui manusia).
 *  - Semua angka default di DEFAULT_PARAMETER adalah NILAI AWAL UNTUK KALIBRASI,
 *    bukan kebijakan resmi Perumda. Tetapkan nilai final bersama pemilik proses.
 *
 * Satuan: stand dan pemakaian dalam bilangan bulat (m³). Jika kebijakan
 * mencatat sampai liter, ubah ke satuan terkecil (liter) di seluruh sistem —
 * jangan campur satuan.
 */

export const KONDISI_KUNJUNGAN = [
  "NORMAL", // meter terbaca normal, stand wajib ada
  "RUMAH_KOSONG", // meter terjangkau & terbaca, penghuni tidak ada (jalur sama dengan NORMAL)
  "RUMAH_TERKUNCI", // meter tidak terjangkau karena akses terkunci
  "METER_TERHALANG", // meter tertutup/tertimbun/tidak terjangkau
  "METER_RUSAK", // register/kaca rusak, angka tidak dapat dipercaya
  "METER_MATI", // register tidak bergerak walau ada aliran
  "METER_TERBALIK", // terpasang terbalik / aliran balik
  "METER_HILANG",
  "METER_DIGANTI", // diganti pada kunjungan ini (butuh data segmen)
] as const

export type KondisiKunjungan = (typeof KONDISI_KUNJUNGAN)[number]

export type Flag =
  | "PEMAKAIAN_NOL"
  | "PEMAKAIAN_TINGGI"
  | "METER_MACET_DUGAAN"
  | "ROLLOVER_TERDETEKSI"

export type AlasanReview =
  | "STAND_TIDAK_VALID"
  | "STAND_WAJIB_ADA"
  | "STAND_MELEBIHI_KAPASITAS"
  | "STAND_MUNDUR_TIDAK_MASUK_AKAL"
  | "DATA_PENGGANTIAN_TIDAK_LENGKAP"
  | "SEGMEN_PENGGANTIAN_TIDAK_VALID"
  | "RIWAYAT_TIDAK_CUKUP_UNTUK_TAKSIRAN"

export interface ParameterHitung {
  /** Banyak periode terakhir yang dirata-ratakan untuk taksiran. */
  periodeTaksiran: number
  /** Riwayat valid minimum agar taksiran boleh dibuat. */
  minimumRiwayatTaksiran: number
  /** Batas atas wajar = max(lantaiBatasAtas, faktorBatasAtas × rata-rata riwayat). */
  faktorBatasAtas: number
  /** Lantai batas atas (m³) supaya pelanggan kecil tidak terlalu sering ditandai. */
  lantaiBatasAtas: number
  /** Berapa periode berturut-turut pemakaian 0 sebelum dicurigai meter macet. */
  periodeNolCurigaMacet: number
}

export const DEFAULT_PARAMETER: Readonly<ParameterHitung> = Object.freeze({
  periodeTaksiran: 3,
  minimumRiwayatTaksiran: 2,
  faktorBatasAtas: 3,
  lantaiBatasAtas: 50,
  periodeNolCurigaMacet: 3,
})

export interface DataPenggantian {
  /** Stand meter LAMA saat dicabut. */
  standCabut: number
  /** Stand meter BARU saat dipasang (meter baru biasanya 0). */
  standPasang: number
  /** Nilai tampilan maksimum register meter baru, mis. 99999. */
  kapasitasMeterBaru: number
}

export interface InputHitung {
  kondisi: KondisiKunjungan
  /** Stand resmi periode sebelumnya pada meter yang berlaku saat itu. */
  standLalu: number
  /** Angka yang dibaca petugas; null bila tidak ada angka. */
  standKini: number | null
  /** Nilai tampilan maksimum register, mis. 9999 (4 digit) atau 99999 (5 digit). */
  kapasitasRegister: number
  /** Hanya untuk METER_DIGANTI. */
  penggantian?: DataPenggantian
  /**
   * Pemakaian resmi periode-periode sebelumnya, TERBARU DULU.
   * Isi hanya pemakaian TERUKUR (jangan masukkan taksiran agar taksiran tidak
   * berantai).
   */
  riwayat: readonly number[]
  parameter?: Partial<ParameterHitung>
}

export type HasilPemakaian =
  | {
      jenis: "TERUKUR"
      metode: "SELISIH" | "ROLLOVER" | "SEGMEN_GANTI_METER"
      pemakaian: number
      flag: Flag[]
    }
  | {
      jenis: "TAKSIRAN"
      metode: "RATA_RATA_RIWAYAT"
      pemakaian: number
      /** Riwayat yang dipakai sebagai dasar, untuk jejak audit. */
      dasar: number[]
      /** Taksiran tidak pernah final tanpa persetujuan. */
      wajibPersetujuan: true
      flag: Flag[]
    }
  | {
      jenis: "PERLU_REVIEW"
      alasan: AlasanReview
      /** Usulan angka bila ada; null bila tidak ada dasar yang masuk akal. */
      pemakaianUsulan: number | null
      flag: Flag[]
    }

const KONDISI_TANPA_ANGKA_DIPERCAYA: ReadonlySet<KondisiKunjungan> = new Set([
  "RUMAH_TERKUNCI",
  "METER_TERHALANG",
  "METER_RUSAK",
  "METER_MATI",
  "METER_TERBALIK",
  "METER_HILANG",
])

function bilanganBulatNonNegatif(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0
}

/** Pembulatan setengah ke atas untuk bilangan non-negatif. */
function bulatkan(n: number): number {
  return Math.floor(n + 0.5)
}

function gabungParameter(p?: Partial<ParameterHitung>): ParameterHitung {
  return { ...DEFAULT_PARAMETER, ...(p ?? {}) }
}

/** Hanya angka valid (bilangan bulat ≥ 0) yang dipakai untuk statistik. */
function riwayatValid(riwayat: readonly number[]): number[] {
  return riwayat.filter(bilanganBulatNonNegatif)
}

export function hitungBatasWajarAtas(
  riwayat: readonly number[],
  parameter?: Partial<ParameterHitung>
): number {
  const p = gabungParameter(parameter)
  const data = riwayatValid(riwayat).slice(0, p.periodeTaksiran)
  if (data.length === 0) return p.lantaiBatasAtas
  const rata = data.reduce((a, b) => a + b, 0) / data.length
  return Math.max(p.lantaiBatasAtas, Math.ceil(rata * p.faktorBatasAtas))
}

function flagDariPemakaian(
  pemakaian: number,
  riwayat: readonly number[],
  p: ParameterHitung,
  batasAtas: number
): Flag[] {
  const flag: Flag[] = []
  if (pemakaian === 0) {
    flag.push("PEMAKAIAN_NOL")
    const terakhir = riwayatValid(riwayat).slice(0, p.periodeNolCurigaMacet - 1)
    const nolBerturut =
      terakhir.length === p.periodeNolCurigaMacet - 1 &&
      terakhir.every((x) => x === 0)
    if (nolBerturut) flag.push("METER_MACET_DUGAAN")
  }
  if (pemakaian > batasAtas) flag.push("PEMAKAIAN_TINGGI")
  return flag
}

type HasilSegmen =
  | {
      ok: true
      pemakaian: number
      metode: "SELISIH" | "ROLLOVER"
    }
  | { ok: false; alasan: AlasanReview }

/**
 * Pemakaian satu segmen meter (awal → akhir pada satu register).
 * Stand mundur hanya dianggap rollover bila pemakaian yang tersirat masuk akal.
 */
function hitungSegmen(
  awal: number,
  akhir: number,
  kapasitas: number,
  batasAtas: number
): HasilSegmen {
  if (!bilanganBulatNonNegatif(awal) || !bilanganBulatNonNegatif(akhir)) {
    return { ok: false, alasan: "STAND_TIDAK_VALID" }
  }
  if (!bilanganBulatNonNegatif(kapasitas) || kapasitas <= 0) {
    return { ok: false, alasan: "STAND_TIDAK_VALID" }
  }
  if (awal > kapasitas || akhir > kapasitas) {
    return { ok: false, alasan: "STAND_MELEBIHI_KAPASITAS" }
  }
  if (akhir >= awal) {
    return { ok: true, pemakaian: akhir - awal, metode: "SELISIH" }
  }
  // Stand mundur: kandidat rollover. Modulus register = kapasitas + 1
  // (mis. register 4 digit menampilkan 0000–9999, setelah 9999 kembali ke 0000).
  const tersirat = kapasitas + 1 - awal + akhir
  if (tersirat <= batasAtas) {
    return { ok: true, pemakaian: tersirat, metode: "ROLLOVER" }
  }
  return { ok: false, alasan: "STAND_MUNDUR_TIDAK_MASUK_AKAL" }
}

function taksirDariRiwayat(
  riwayat: readonly number[],
  p: ParameterHitung
): HasilPemakaian {
  const data = riwayatValid(riwayat).slice(0, p.periodeTaksiran)
  if (data.length < p.minimumRiwayatTaksiran) {
    return {
      jenis: "PERLU_REVIEW",
      alasan: "RIWAYAT_TIDAK_CUKUP_UNTUK_TAKSIRAN",
      pemakaianUsulan: null,
      flag: [],
    }
  }
  const rata = data.reduce((a, b) => a + b, 0) / data.length
  return {
    jenis: "TAKSIRAN",
    metode: "RATA_RATA_RIWAYAT",
    pemakaian: bulatkan(rata),
    dasar: data,
    wajibPersetujuan: true,
    flag: [],
  }
}

/**
 * Titik masuk tunggal perhitungan pemakaian periode berjalan.
 * Fungsi murni: input sama selalu menghasilkan hasil sama.
 */
export function hitungPemakaian(input: InputHitung): HasilPemakaian {
  const p = gabungParameter(input.parameter)
  const batasAtas = hitungBatasWajarAtas(input.riwayat, p)

  // 1) Kondisi yang membuat angka tidak dapat dipercaya / tidak ada angka.
  if (KONDISI_TANPA_ANGKA_DIPERCAYA.has(input.kondisi)) {
    return taksirDariRiwayat(input.riwayat, p)
  }

  // 2) Penggantian meter: jumlahkan dua segmen yang sah.
  if (input.kondisi === "METER_DIGANTI") {
    const g = input.penggantian
    if (!g || input.standKini === null) {
      return {
        jenis: "PERLU_REVIEW",
        alasan: "DATA_PENGGANTIAN_TIDAK_LENGKAP",
        pemakaianUsulan: null,
        flag: [],
      }
    }
    // Segmen lama: standLalu → standCabut. Rollover pada segmen ini tidak
    // diterima otomatis; stand cabut yang lebih kecil dari stand lalu diarahkan
    // ke review.
    if (
      !bilanganBulatNonNegatif(input.standLalu) ||
      !bilanganBulatNonNegatif(g.standCabut) ||
      g.standCabut < input.standLalu
    ) {
      return {
        jenis: "PERLU_REVIEW",
        alasan: "SEGMEN_PENGGANTIAN_TIDAK_VALID",
        pemakaianUsulan: null,
        flag: [],
      }
    }
    // Segmen baru: standPasang → standKini pada meter baru.
    const baru = hitungSegmen(
      g.standPasang,
      input.standKini,
      g.kapasitasMeterBaru,
      batasAtas
    )
    // Meter baru tidak mungkin sudah rollover; stand mundur pada segmen ini
    // selalu masalah data penggantian, apa pun nilai yang tersirat.
    if (!baru.ok || baru.metode !== "SELISIH") {
      const alasan: AlasanReview =
        !baru.ok && baru.alasan !== "STAND_MUNDUR_TIDAK_MASUK_AKAL"
          ? baru.alasan
          : "SEGMEN_PENGGANTIAN_TIDAK_VALID"
      return {
        jenis: "PERLU_REVIEW",
        alasan,
        pemakaianUsulan: null,
        flag: [],
      }
    }
    const total = g.standCabut - input.standLalu + baru.pemakaian
    return {
      jenis: "TERUKUR",
      metode: "SEGMEN_GANTI_METER",
      pemakaian: total,
      flag: flagDariPemakaian(total, input.riwayat, p, batasAtas),
    }
  }

  // 3) Jalur normal (NORMAL, RUMAH_KOSONG): angka wajib ada.
  if (input.standKini === null) {
    return {
      jenis: "PERLU_REVIEW",
      alasan: "STAND_WAJIB_ADA",
      pemakaianUsulan: null,
      flag: [],
    }
  }

  const seg = hitungSegmen(
    input.standLalu,
    input.standKini,
    input.kapasitasRegister,
    batasAtas
  )
  if (!seg.ok) {
    return {
      jenis: "PERLU_REVIEW",
      alasan: seg.alasan,
      pemakaianUsulan: null,
      flag: [],
    }
  }

  const flag = flagDariPemakaian(seg.pemakaian, input.riwayat, p, batasAtas)
  if (seg.metode === "ROLLOVER") flag.push("ROLLOVER_TERDETEKSI")
  return {
    jenis: "TERUKUR",
    metode: seg.metode,
    pemakaian: seg.pemakaian,
    flag,
  }
}
