// prisma/seed/steps/07-pembacaan-tagihan.ts — MIGRASI SEJARAH: pembacaan
// meter dan tagihan periode-periode yang SUDAH ditutup di Aurora.
//
// KENAPA STEP INI ADA. Repo ini sempat tidak punya jalur apa pun untuk
// memindahkan sejarah: seed hanya membentuk populasi, dan pembacaan/tagihan
// "harus dihasilkan aplikasi sendiri". Prinsip itu benar untuk bulan KE
// DEPAN, tapi diterapkan pada sejarah ia berarti operator disuruh mengunggah
// ulang tujuh berkas lewat browser satu per satu — padahal berkasnya sudah
// ada di repo dan sudah dibaca seed untuk keperluan lain. Hasilnya database
// yang punya 22 ribu pelanggan tapi nol pembacaan: tidak ada tunggakan, tidak
// ada `standLalu`, tidak ada `pemakaianLalu`, dan tidak ada yang bisa dilihat.
//
// SUMBER TIAP ANGKA — dan kenapa dua berkas, bukan satu:
//
//   PembacaanMeter  <- lapdatametertes.csv   (DAFTAR CATAT)
//     Inilah hasil pencatatan petugas yang sebenarnya: stand awal, stand
//     akhir, kondisi meter, siapa yang mencatat, kapan.
//
//   Tagihan         <- ProgresCater-PW5.csv  (DRD, hasil closing)
//     Nominal rupiah TIDAK PERNAH dihitung ulang di sini. Ini impor sejarah,
//     bukan penerbitan ulang tagihan: angka yang sudah sampai ke pelanggan
//     adalah fakta, dan menghitungnya ulang dengan tarif hari ini akan
//     menulis ulang sejarah. Mesin closing (packages/server) yang berhak
//     menghitung — untuk periode yang BELUM ditutup.
//
// PERIODE TERAKHIR SENGAJA DILEWATI. Step ini berhenti sebelum periode
// paling akhir supaya ada satu bulan yang benar-benar ditutup lewat
// aplikasi. Tanpa itu tidak ada cara membuktikan mesin closing bekerja —
// database sudah berisi semua jawabannya sejak awal.
//
// PEMAKAIAN RIIL vs PEMAKAIAN TAGIH: `pakai_drd` (ditagihkan) sering berbeda
// dari `stma - stml` (terbaca) — 45% baris di periode 202605. Keduanya
// disimpan terpisah beserta `alasanTaksir` yang menjelaskan sebabnya.
// Alasannya DILABELI dari apa yang terjadi di data, bukan dihitung ulang
// lalu menimpa angka aslinya.

import type { Prisma } from "@generated"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { PERIODE_TERSEDIA, readLapDataMeterPeriode, readProgresCaterPeriode } from "../lib/csv"
import {
  normalizeNolg,
  normalizeKondisiCatat,
  normalizeGolonganTarif,
  parseIntOrNull,
  periodeToDate,
} from "../lib/normalize"
import { usulkanPemakaianTagih, type AlasanTaksir } from "@/lib/domain/tagihan"

const STEP = "07-pembacaan-tagihan"

/// 22 ribu insert satu per satu ke Postgres makan waktu berjam-jam.
const UKURAN_BATCH = 1000

/// Melabeli KENAPA pemakaian tagih berbeda dari pemakaian riil. Deskriptif,
/// bukan preskriptif: nilai tagih dari sumber tidak pernah diubah — fungsi
/// ini hanya mencocokkannya dengan aturan yang berlaku supaya perbedaannya
/// bisa dijelaskan saat pelanggan bertanya atau auditor memeriksa.
function labeliAlasanTaksir(params: {
  pemakaianRiil: number
  pemakaianTagih: number
  kondisi: string
  pemakaianLalu: number | null
}): AlasanTaksir | null {
  const { pemakaianRiil, pemakaianTagih, kondisi, pemakaianLalu } = params
  if (pemakaianTagih === pemakaianRiil) return null
  const usulan = usulkanPemakaianTagih({ pemakaianRiil, kondisi, pemakaianLalu })
  if (usulan.pemakaianTagih === pemakaianTagih && usulan.alasan !== null) return usulan.alasan
  // Berbeda dari riil TAPI tidak cocok satu pun aturan — berarti seseorang
  // menetapkannya secara sadar. Dicatat apa adanya.
  return "OVERRIDE_MANUAL"
}

function addMonthsUTC(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()))
}

export async function seedPembacaanTagihan(
  prisma: PrismaClientLike,
  report: SeedReport
): Promise<void> {
  // Periode TERAKHIR dilewati — lihat catatan di kepala berkas.
  //
  // KECUALI bila diminta sebaliknya. Menyisakan satu bulan kosong bagus untuk
  // MENGUJI mesin closing, tetapi menghalangi saat yang dibutuhkan adalah
  // aplikasi yang bisa langsung dipakai: petugas membuka aplikasi pada bulan
  // berjalan, tidak menemukan daftar kerja, dan layarnya berputar tanpa
  // penjelasan. Env var ini membuat pilihannya sadar, bukan tersembunyi.
  const sertakanTerakhir = process.env.SEED_SERTAKAN_PERIODE_TERAKHIR === "ya"
  const periodeSejarah = sertakanTerakhir ? [...PERIODE_TERSEDIA] : PERIODE_TERSEDIA.slice(0, -1)
  const periodeDilewati = sertakanTerakhir ? null : PERIODE_TERSEDIA[PERIODE_TERSEDIA.length - 1]

  if (periodeSejarah.length === 0) {
    report.warn(STEP, "Hanya satu periode tersedia — semuanya disisakan untuk closing lewat aplikasi.")
    return
  }

  const [pelangganRows, meterRows, pencatatRows, golonganRows] = await Promise.all([
    prisma.pelanggan.findMany({ select: { id: true, nomorLangganan: true } }),
    prisma.meter.findMany({ where: { isAktif: true }, select: { id: true, pelangganId: true } }),
    prisma.pencatat.findMany({ select: { id: true, namaLapangan: true } }),
    prisma.tarifGolongan.findMany({ select: { id: true, kode: true } }),
  ])
  const pelangganCache = new Map(pelangganRows.map((p) => [p.nomorLangganan, p.id]))
  const meterCache = new Map(meterRows.map((m) => [m.pelangganId, m.id]))
  const pencatatCache = new Map(pencatatRows.map((p) => [p.namaLapangan, p.id]))
  const golonganCache = new Map(golonganRows.map((g) => [g.kode, g.id]))

  const ringkasan: string[] = []

  for (const p of periodeSejarah) {
    const tanggalPeriode = periodeToDate(p.thbl)

    // ── 1) PEMBACAAN dari daftar catat (lapdatameter) ──────────────────
    const drd = new Map<string, ReturnType<typeof readProgresCaterPeriode>[number]>()
    for (const row of readProgresCaterPeriode(p.folder)) {
      const nolg = normalizeNolg(row.nolg)
      if (nolg) drd.set(nolg, row)
    }

    const pembacaan: Prisma.PembacaanMeterCreateManyInput[] = []
    const petaBaris = new Map<string, { pelangganId: string }>()

    for (const row of readLapDataMeterPeriode(p.folder)) {
      const nolg = normalizeNolg(row["No Pel"])
      if (!nolg) continue
      const pelangganId = pelangganCache.get(nolg)
      if (!pelangganId) {
        report.skipped(STEP)
        continue
      }
      const meterId = meterCache.get(pelangganId)
      if (!meterId) {
        report.warn(STEP, `${nolg} tidak punya meter aktif — pembacaan ${p.thbl} dilewati`, { key: nolg })
        report.skipped(STEP)
        continue
      }

      const standLalu = parseIntOrNull(row["St AWAL"]) ?? 0
      const standAkhir = parseIntOrNull(row["St Akhir"]) ?? 0
      const pemakaianRiil = Math.max(0, standAkhir - standLalu)
      const pemakaianLalu = parseIntOrNull(row["Pakai Lau"])
      // Yang DITAGIHKAN diambil dari DRD bila barisnya ada di sana; kalau
      // tidak (cabutan & PBPK — memang tidak ditagih), pakai angka catat.
      const barisDrd = drd.get(nolg)
      const pemakaianTagih = barisDrd ? (parseIntOrNull(barisDrd.pakai_drd) ?? 0) : (parseIntOrNull(row.Pakai) ?? 0)
      const kondisiKode = (row.Kd_kel ?? "").trim()

      pembacaan.push({
        meterId,
        periode: tanggalPeriode,
        standLalu,
        standAkhir,
        pemakaianM3: pemakaianTagih,
        pemakaianRiil,
        alasanTaksir: labeliAlasanTaksir({
          pemakaianRiil,
          pemakaianTagih,
          kondisi: kondisiKode,
          pemakaianLalu,
        }),
        blokTarif: barisDrd ? (parseIntOrNull(barisDrd.blok_m3) ?? 1) : 1,
        pemakaianLalu,
        blokTarifLalu: barisDrd ? parseIntOrNull(barisDrd.blok_m3lalu) : null,
        kondisi: normalizeKondisiCatat(kondisiKode) ?? "NORMAL",
        kategori: "ONSITE",
        pencatatId: pencatatCache.get((row["Nama Petugas"] ?? "").trim().toUpperCase()) ?? null,
        tanggalCatat: row.tgl_catat ? new Date(row.tgl_catat) : null,
      })
      petaBaris.set(nolg, { pelangganId })
    }

    let dibuatPembacaan = 0
    for (let m = 0; m < pembacaan.length; m += UKURAN_BATCH) {
      const res = await prisma.pembacaanMeter.createMany({
        data: pembacaan.slice(m, m + UKURAN_BATCH),
        skipDuplicates: true,
      })
      dibuatPembacaan += res.count
    }
    for (let n = 0; n < dibuatPembacaan; n++) report.created(`${STEP}:pembacaan`)

    // ── 2) TAGIHAN dari DRD, ditautkan ke pembacaan yang baru dibuat ────
    const pembacaanTersimpan = await prisma.pembacaanMeter.findMany({
      where: { periode: tanggalPeriode },
      select: { id: true, meter: { select: { pelangganId: true } } },
    })
    const pembacaanPerPelanggan = new Map(
      pembacaanTersimpan.map((x) => [x.meter.pelangganId, x.id])
    )

    const tagihan: Prisma.TagihanCreateManyInput[] = []
    for (const [nolg, row] of drd) {
      const pelangganId = pelangganCache.get(nolg)
      if (!pelangganId) continue
      const jumlahNunggak = parseIntOrNull(row.jmlreknunggak) ?? 0
      // GOLONGAN DIBEKUKAN DARI BARIS SUMBER, bukan dari data pelanggan hari
      // ini. `Pelanggan.tarifGolonganId` adalah nilai BERJALAN — step 05
      // menulisnya dari periode TERAKHIR yang di-seed. Tanpa pembekuan ini,
      // menghitung ulang tagihan Mei akan memakai golongan Juli, dan tiap
      // pelanggan yang pernah pindah golongan terlihat "meleset" padahal
      // tagihannya benar. Tagihan adalah dokumen SEJARAH; ia harus bisa
      // menjelaskan dasarnya sendiri saat auditor bertanya.
      const kodeGolongan = normalizeGolonganTarif(row.trp)
      tagihan.push({
        pelangganId,
        pembacaanId: pembacaanPerPelanggan.get(pelangganId) ?? null,
        tarifGolonganId: kodeGolongan ? (golonganCache.get(kodeGolongan) ?? null) : null,
        periode: tanggalPeriode,
        pemakaianM3: parseIntOrNull(row.pakai_drd) ?? 0,
        jmlHargaAir: parseIntOrNull(row.jmlhargaair) ?? 0,
        beaBeban: parseIntOrNull(row.beabeban) ?? 0,
        beaAdmin: parseIntOrNull(row.beaadmin) ?? 0,
        airKotor: parseIntOrNull(row.airkotor) ?? 0,
        lainLain: parseIntOrNull(row.lainlain) ?? 0,
        totalTagihan: parseIntOrNull(row.tjtg) ?? 0,
        jumlahRekTunggak: jumlahNunggak,
        // `tanggalJatuhTempo` TIDAK ADA di sumber mana pun — placeholder
        // periode + 1 bulan. Untuk periode yang ditutup lewat aplikasi,
        // angkanya wajib diisi operator (lihat closing.service).
        tanggalJatuhTempo: addMonthsUTC(tanggalPeriode, 1),
        // Diturunkan dari `jmlreknunggak`, data ASLI — bukan tebakan dari
        // placeholder tanggal di atas.
        status: jumlahNunggak > 0 ? "JATUH_TEMPO" : "BELUM_BAYAR",
      })
    }

    let dibuatTagihan = 0
    for (let m = 0; m < tagihan.length; m += UKURAN_BATCH) {
      const res = await prisma.tagihan.createMany({
        data: tagihan.slice(m, m + UKURAN_BATCH),
        skipDuplicates: true,
      })
      dibuatTagihan += res.count
    }
    for (let n = 0; n < dibuatTagihan; n++) report.created(`${STEP}:tagihan`)

    // ── 3) Kunci periodenya + tandai daftar catat selesai ───────────────
    const ringkas = await prisma.tagihan.aggregate({
      where: { periode: tanggalPeriode },
      _count: true,
      _sum: { pemakaianM3: true, totalTagihan: true },
    })
    await prisma.periodePenagihan.upsert({
      where: { periode: p.thbl },
      create: {
        periode: p.thbl,
        status: "TERKUNCI",
        tanggalJatuhTempo: addMonthsUTC(tanggalPeriode, 1),
        ditutupAt: new Date(),
        jumlahSL: ringkas._count,
        totalM3: ringkas._sum.pemakaianM3 ?? 0,
        totalTagihan: BigInt(ringkas._sum.totalTagihan ?? 0),
      },
      update: {},
    })
    await prisma.daftarCatat.updateMany({
      where: {
        periode: p.thbl,
        status: "BELUM_DICATAT",
        pelanggan: { meter: { some: { pembacaan: { some: { periode: tanggalPeriode } } } } },
      },
      data: { status: "DICATAT", selesaiAt: new Date() },
    })

    ringkasan.push(
      `${p.thbl}: pembacaan ${dibuatPembacaan}, tagihan ${dibuatTagihan}, Rp ${(ringkas._sum.totalTagihan ?? 0).toLocaleString("id-ID")}`
    )
  }

  report.warn(STEP, `Sejarah diimpor — ${ringkasan.join(" | ")}`)
  if (periodeDilewati) {
    report.warn(
      STEP,
      `Periode ${periodeDilewati.thbl} SENGAJA dilewati: tutup lewat /dashboard/closing supaya mesin closing benar-benar teruji.`
    )
  } else {
    report.warn(STEP, "SEED_SERTAKAN_PERIODE_TERAKHIR=ya — seluruh periode diimpor, termasuk yang terakhir.")
  }
}
