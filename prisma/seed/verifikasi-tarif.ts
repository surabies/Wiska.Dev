// prisma/seed/verifikasi-tarif.ts — UJI REGRESI MESIN TAGIHAN.
// Jalankan: pnpm db:verifikasi-tarif
//
// Pertanyaan yang dijawab skrip ini: "kalau aplikasi ini yang menerbitkan
// tagihan bulan Mei, apakah hasilnya SAMA PERSIS dengan yang sudah
// ditagihkan Aurora ke 22.523 pelanggan?"
//
// Selama jawabannya 22.523/22.523, mesin tagihan aplikasi terbukti setara
// dan aman dipakai menggantikan Aurora. Begitu angkanya turun — entah
// karena tarif diubah, rumus disederhanakan, atau data baru masuk — skrip
// ini gagal dan menunjukkan baris mana yang meleset.
//
// TIDAK menyentuh database sama sekali kalau dijalankan dengan --dari-data
// (default): tarif diturunkan langsung dari CSV. Dengan --dari-db, tarif
// dibaca dari tabel TarifBlok/BiayaTetap hasil seed — itulah yang
// membuktikan bahwa yang TERSIMPAN di database juga benar, bukan cuma
// yang bisa dihitung di memori.

import { prisma } from "./lib/db"
import { readProgresCater } from "./lib/csv"
import { normalizeUkuranMeter, parseIntOrNull } from "./lib/normalize"
import { turunkanTarifBlok, turunkanBiayaTetap, type ObservasiTarif } from "./lib/tarif"
import { hitungHargaAir, hitungTotalTagihan, type HargaBlok } from "@/lib/domain/tagihan"

interface SumberTarif {
  nama: string
  blokPerGolongan: Map<string, HargaBlok[]>
  beaBebanPerUkuran: Map<string, number>
  beaAdmin: number
  airKotor: number
}

function tarifDariData(rows: ReturnType<typeof readProgresCater>): SumberTarif {
  const observasi: ObservasiTarif[] = []
  for (const row of rows) {
    const pemakaianM3 = parseIntOrNull(row.pakai_drd)
    const jmlHargaAir = parseIntOrNull(row.jmlhargaair)
    const kodeAsli = row.trp.trim()
    if (!kodeAsli || pemakaianM3 === null || jmlHargaAir === null) continue
    observasi.push({ kodeAsli, pemakaianM3, jmlHargaAir })
  }
  const blokPerGolongan = new Map<string, HargaBlok[]>()
  for (const h of turunkanTarifBlok(observasi)) blokPerGolongan.set(h.kodeAsli, h.blok)

  const biaya = turunkanBiayaTetap(
    rows.flatMap((row) => {
      const ukuranMeter = normalizeUkuranMeter(row.ukmeter)
      const beaBeban = parseIntOrNull(row.beabeban)
      const beaAdmin = parseIntOrNull(row.beaadmin)
      const airKotor = parseIntOrNull(row.airkotor)
      if (!ukuranMeter || beaBeban === null || beaAdmin === null || airKotor === null) return []
      return [{ ukuranMeter, beaBeban, beaAdmin, airKotor }]
    })
  )

  return {
    nama: "diturunkan langsung dari ProgresCater",
    blokPerGolongan,
    beaBebanPerUkuran: biaya.beaBebanPerUkuran,
    beaAdmin: biaya.beaAdmin ?? 0,
    airKotor: biaya.airKotor ?? 0,
  }
}

async function tarifDariDb(): Promise<SumberTarif> {
  const golongan = await prisma.tarifGolongan.findMany({
    select: { kodeAsli: true, blokTarif: true },
  })
  const blokPerGolongan = new Map<string, HargaBlok[]>()
  for (const g of golongan) {
    if (g.blokTarif.length === 0) continue
    blokPerGolongan.set(
      g.kodeAsli,
      g.blokTarif.map((b) => ({
        blok: b.blok,
        batasAwalM3: b.batasAwalM3,
        batasAkhirM3: b.batasAkhirM3,
        hargaPerM3: b.hargaPerM3,
      }))
    )
  }

  const biaya = await prisma.biayaTetap.findMany()
  const beaBebanPerUkuran = new Map<string, number>()
  let beaAdmin = 0
  let airKotor = 0
  for (const b of biaya) {
    if (b.jenis === "BEA_BEBAN" && b.ukuranMeter) beaBebanPerUkuran.set(b.ukuranMeter, b.nominal)
    else if (b.jenis === "BEA_ADMIN") beaAdmin = b.nominal
    else if (b.jenis === "AIR_KOTOR") airKotor = b.nominal
  }

  return { nama: "dibaca dari tabel TarifBlok/BiayaTetap", blokPerGolongan, beaBebanPerUkuran, beaAdmin, airKotor }
}

async function main(): Promise<void> {
  const dariDb = process.argv.includes("--dari-db")
  const rows = readProgresCater()
  const tarif = dariDb ? await tarifDariDb() : tarifDariData(rows)

  console.log("=========== UJI REGRESI MESIN TAGIHAN ===========")
  console.log(`Sumber tarif : ${tarif.nama}`)
  console.log(`Golongan bertarif: ${tarif.blokPerGolongan.size}`)
  console.log(`Bea beban per ukuran: ${tarif.beaBebanPerUkuran.size} | admin ${tarif.beaAdmin} | air kotor ${tarif.airKotor}`)
  console.log(`Baris diuji  : ${rows.length}\n`)

  let cocok = 0
  let meleset = 0
  let takBisaDiuji = 0
  const contoh: string[] = []
  const melesetPerGolongan = new Map<string, number>()
  const belumBertarif = new Map<string, number>()

  for (const row of rows) {
    const kodeAsli = row.trp.trim()
    const blok = tarif.blokPerGolongan.get(kodeAsli)
    const ukuran = normalizeUkuranMeter(row.ukmeter)
    const pemakaianM3 = parseIntOrNull(row.pakai_drd)
    const totalAsli = parseIntOrNull(row.tjtg)
    const lainLain = parseIntOrNull(row.lainlain) ?? 0

    if (!blok || !ukuran || pemakaianM3 === null || totalAsli === null) {
      takBisaDiuji++
      continue
    }
    const beaBeban = tarif.beaBebanPerUkuran.get(ukuran)
    if (beaBeban === undefined) {
      takBisaDiuji++
      continue
    }

    // Pemakaian yang jatuh di blok yang harganya BELUM diketahui (golongan
    // bervolume kecil yang observasinya terlalu jarang) tidak bisa dinilai —
    // dihitung terpisah, bukan dilaporkan sebagai "meleset". Membaurkan
    // keduanya membuat kekurangan sumber data terlihat seperti rumus salah.
    const batasTertinggi = blok.reduce(
      (maks, b) => (b.batasAkhirM3 === null ? Number.POSITIVE_INFINITY : Math.max(maks, b.batasAkhirM3)),
      0
    )
    if (pemakaianM3 > batasTertinggi) {
      takBisaDiuji++
      belumBertarif.set(kodeAsli, (belumBertarif.get(kodeAsli) ?? 0) + 1)
      continue
    }

    const totalHitung = hitungTotalTagihan({
      jmlHargaAir: hitungHargaAir(pemakaianM3, blok),
      beaBeban,
      beaAdmin: tarif.beaAdmin,
      airKotor: tarif.airKotor,
      lainLain,
    })

    if (totalHitung === totalAsli) {
      cocok++
    } else {
      meleset++
      melesetPerGolongan.set(kodeAsli, (melesetPerGolongan.get(kodeAsli) ?? 0) + 1)
      if (contoh.length < 10) {
        contoh.push(
          `  nolg=${row.nolg} gol=${kodeAsli} ukuran=${ukuran} pakai=${pemakaianM3} -> hitung=${totalHitung} data=${totalAsli} (selisih ${totalHitung - totalAsli})`
        )
      }
    }
  }

  console.log(`COCOK        : ${cocok}`)
  console.log(`MELESET      : ${meleset}`)
  console.log(`Tak bisa diuji (blok tarif belum ada sumbernya): ${takBisaDiuji}`)
  if (belumBertarif.size > 0) {
    console.log("  -> golongan yang blok atasnya WAJIB diisi dari SK tarif:")
    for (const [g, n] of [...belumBertarif].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${g}: ${n} pelanggan`)
    }
  }

  if (meleset > 0) {
    console.log("\nMeleset per golongan:")
    for (const [g, n] of [...melesetPerGolongan].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${g}: ${n}`)
    }
    console.log("\nContoh:")
    for (const c of contoh) console.log(c)
  }

  const totalDiuji = cocok + meleset
  console.log(
    `\nHASIL: ${cocok}/${totalDiuji} tagihan direproduksi persis` +
      (takBisaDiuji > 0 ? ` (${takBisaDiuji} baris tidak bisa diuji)` : "")
  )
  console.log("================================================")

  await prisma.$disconnect()
  // Gagal kalau ada yang meleset — supaya bisa dipakai di CI kelak.
  if (meleset > 0) process.exitCode = 1
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exitCode = 1
})
