// prisma/seed/cek-konsistensi.ts — audit read-only kondisi data hasil seed.
// TIDAK menulis apa pun. Dipakai untuk menjawab "apakah angka di database
// sudah konsisten dengan sumbernya" sebelum data dipakai sebagai dasar
// penagihan resmi. Jalankan: pnpm db:cek
//
// Angka acuan yang diverifikasi langsung dari CSV sumber (periode 202605):
//   lapdatameter 22.553 = ProgresCater 22.523 + PBPK 11 + r-nomor 19
// Artinya:
//   - baris Pelanggan seharusnya 22.553 (SEMUA yang pernah muncul, termasuk
//     19 yang dicabut — mereka disimpan berstatus non-aktif, bukan dihapus);
//   - SL yang DITAGIH Mei              = 22.523;
//   - daftar catat (DPM) Juni          = 22.534 = 22.523 + 11 PBPK.

import { prisma } from "./lib/db"

async function main(): Promise<void> {
  const [
    totalPelanggan,
    perStatus,
    totalMeterAktif,
    pembacaan202605,
    tagihan202605,
    totalPemutusan,
    totalMutasi,
    tarifBlok,
  ] = await Promise.all([
    prisma.pelanggan.count(),
    prisma.pelanggan.groupBy({ by: ["status"], _count: true }),
    prisma.meter.count({ where: { isAktif: true } }),
    prisma.pembacaanMeter.count({ where: { periode: new Date(Date.UTC(2026, 4, 1)) } }),
    prisma.tagihan.aggregate({
      where: { periode: new Date(Date.UTC(2026, 4, 1)) },
      _count: true,
      _sum: { totalTagihan: true, pemakaianM3: true },
    }),
    prisma.pemutusan.count(),
    prisma.mutasiPelanggan.count(),
    prisma.tarifBlok.count(),
  ])

  console.log("=========== AUDIT KONSISTENSI DATA ===========")
  console.log(`Pelanggan total          : ${totalPelanggan}   (harusnya 22.553 = 22.523 + 11 PBPK + 19 tercabut)`)
  for (const s of perStatus) console.log(`  status ${s.status.padEnd(16)}: ${s._count}`)
  console.log(`Meter aktif              : ${totalMeterAktif}`)
  console.log(`PembacaanMeter 202605    : ${pembacaan202605}   (harusnya 22.523)`)
  console.log(`Tagihan 202605           : ${tagihan202605._count}   (harusnya 22.523)`)
  console.log(`  total ditagih          : Rp ${(tagihan202605._sum.totalTagihan ?? 0).toLocaleString("id-ID")}`)
  console.log(`  total m3 ditagih       : ${tagihan202605._sum.pemakaianM3 ?? 0}`)
  console.log(`Pemutusan (r-nomor)      : ${totalPemutusan}   (harusnya 19)`)
  console.log(`Mutasi PBPK              : ${totalMutasi}   (harusnya 11)`)
  console.log(`TarifBlok                : ${tarifBlok}   (0 = aplikasi BELUM bisa menghitung tagihan sendiri)`)
  console.log(`  buktikan dengan         : pnpm db:verifikasi-tarif --dari-db`)

  // Pelanggan yang punya baris Pemutusan tapi statusnya masih AKTIF —
  // inilah selisih antara "SL aktif menurut database" dan "SL aktif
  // sebenarnya". Seed sengaja tidak mengubahnya otomatis (lihat
  // steps/09-pemutusan.ts), jadi harus dibereskan lewat keputusan manusia.
  const putusTapiAktif = await prisma.pemutusan.findMany({
    where: { pelanggan: { status: "AKTIF" } },
    select: { nomorLangganan: true, jenis: true, periode: true, tanggalCabut: true },
    orderBy: { nomorLangganan: "asc" },
  })
  console.log(`\nSudah diputus tapi status masih AKTIF: ${putusTapiAktif.length}`)
  for (const p of putusTapiAktif) {
    console.log(
      `  ${p.nomorLangganan}  ${p.jenis}  periode=${p.periode}  cabut=${p.tanggalCabut?.toISOString().slice(0, 10) ?? "-"}`
    )
  }

  // Pelanggan tanpa tagihan periode ini = kandidat daftar catat bulan
  // berikutnya yang belum pernah ditagih (PBPK baru).
  const tanpaTagihan = await prisma.pelanggan.count({
    where: { tagihan: { none: { periode: new Date(Date.UTC(2026, 4, 1)) } } },
  })
  console.log(`\nPelanggan tanpa Tagihan 202605: ${tanpaTagihan}   (11 PBPK + 19 tercabut)`)

  // --- Pemakaian riil vs pemakaian tagih ---
  const periode202605 = new Date(Date.UTC(2026, 4, 1))
  const [totalPembacaan, adaRiil, berbeda, perAlasan] = await Promise.all([
    prisma.pembacaanMeter.count({ where: { periode: periode202605 } }),
    prisma.pembacaanMeter.count({ where: { periode: periode202605, pemakaianRiil: { not: null } } }),
    prisma.pembacaanMeter.count({
      where: { periode: periode202605, alasanTaksir: { not: null } },
    }),
    prisma.pembacaanMeter.groupBy({
      by: ["alasanTaksir"],
      where: { periode: periode202605, alasanTaksir: { not: null } },
      _count: true,
    }),
  ])
  console.log(`\n--- Pemakaian riil vs pemakaian tagih (202605) ---`)
  console.log(`PembacaanMeter          : ${totalPembacaan}  (berisi pemakaianRiil: ${adaRiil})`)
  console.log(`Tagih != riil           : ${berbeda}   (acuan dari CSV: 10.160)`)
  for (const a of perAlasan) console.log(`  ${String(a.alasanTaksir).padEnd(20)}: ${a._count}`)

  // --- Daftar catat (DPM) per periode ---
  const dpm = await prisma.daftarCatat.groupBy({ by: ["periode"], _count: true })
  console.log(`\n--- Daftar Catat (DPM) ---`)
  if (dpm.length === 0) {
    console.log("  (kosong — jalankan step 11)")
  }
  for (const d of dpm.sort((a, b) => a.periode - b.periode)) {
    const perStatusDpm = await prisma.daftarCatat.groupBy({
      by: ["status"],
      where: { periode: d.periode },
      _count: true,
    })
    const rincian = perStatusDpm.map((s) => `${s.status}=${s._count}`).join(" ")
    console.log(`  ${d.periode}: ${d._count} SL   ${rincian}`)
  }

  // Beban per pencatat pada periode terakhir — inilah dasar target petugas
  // yang sebelumnya tidak bisa dihitung sama sekali.
  const periodeTerakhir = dpm.sort((a, b) => b.periode - a.periode)[0]?.periode
  if (periodeTerakhir !== undefined) {
    const beban = await prisma.daftarCatat.groupBy({
      by: ["pencatatId"],
      where: { periode: periodeTerakhir },
      _count: true,
    })
    const namaPencatat = new Map(
      (await prisma.pencatat.findMany({ select: { id: true, namaLapangan: true } })).map((p) => [
        p.id,
        p.namaLapangan,
      ])
    )
    console.log(`\n  Beban per pencatat, periode ${periodeTerakhir}:`)
    for (const b of beban.sort((x, y) => y._count - x._count)) {
      const nama = b.pencatatId ? (namaPencatat.get(b.pencatatId) ?? b.pencatatId) : "(belum berpetugas)"
      console.log(`    ${nama.padEnd(22)}: ${b._count}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exitCode = 1
})
