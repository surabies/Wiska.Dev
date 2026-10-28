// scripts/backfill-golongan-tagihan.ts — mengisi Tagihan.tarifGolonganId
// untuk baris warisan impor Aurora.
//
// Jalankan: pnpm server:backfill-golongan
//
// GOLONGANNYA DITURUNKAN DARI ANGKA TAGIHAN ITU SENDIRI, bukan dari golongan
// pelanggan hari ini. Alasannya justru inti dari kolom yang sedang diisi:
// golongan pelanggan BISA berubah setelah tagihan terbit, dan memakai nilai
// hari ini akan membekukan angka yang salah — persis kesalahan yang membuat
// kolom ini dibutuhkan.
//
// Caranya: untuk tiap tagihan, cari golongan yang blok tarifnya mereproduksi
// `jmlHargaAir` dari `pemakaianM3` yang tersimpan. Kalau tepat satu golongan
// cocok, itu jawabannya. Kalau NOL atau LEBIH DARI SATU cocok, baris itu
// DILEWATI dan dilaporkan — menebak di antara dua kemungkinan sama saja
// dengan mengarang.
import "./env"
import { prisma } from "@db"
import { hitungHargaAir, type HargaBlok } from "@/lib/domain/tagihan"

const UKURAN_BATCH = 1000

async function main(): Promise<void> {
  const golongan = await prisma.tarifGolongan.findMany({
    select: {
      id: true,
      kode: true,
      blokTarif: {
        select: {
          blok: true,
          batasAwalM3: true,
          batasAkhirM3: true,
          hargaPerM3: true,
          berlakuMulai: true,
          berlakuSampai: true,
        },
      },
    },
  })

  const belum = await prisma.tagihan.count({ where: { tarifGolonganId: null } })
  console.log(`Tagihan tanpa golongan beku: ${belum}`)
  if (belum === 0) {
    await prisma.$disconnect()
    return
  }

  // Daftar id diambil SEKALI di awal, lalu diproses sekali jalan. Versi
  // pertama berkas ini mengambil ulang `where tarifGolonganId: null` tiap
  // putaran — baris yang TIDAK bisa diturunkan akan terambil lagi terus dan
  // membuat loopnya berputar tanpa akhir.
  const semua = await prisma.tagihan.findMany({
    where: { tarifGolonganId: null },
    select: {
      id: true,
      periode: true,
      pemakaianM3: true,
      jmlHargaAir: true,
      pelanggan: { select: { nomorLangganan: true, tarifGolonganId: true } },
    },
  })

  let diproses = 0
  let terisi = 0
  let takAdaYangCocok = 0
  let ambigu = 0
  let lewatGolonganBerjalan = 0
  const contohGagal: string[] = []

  for (let i = 0; i < semua.length; i += UKURAN_BATCH) {
    const batch = semua.slice(i, i + UKURAN_BATCH)
    const perbarui: { id: string; golonganId: string }[] = []

    for (const t of batch) {
      diproses++
      // Blok yang berlaku pada PERIODE TAGIHAN ITU — bukan yang berlaku
      // sekarang.
      const kandidat: { id: string; kode: string; blok: HargaBlok[] }[] = []
      for (const g of golongan) {
        const blok = g.blokTarif
          .filter(
            (b) =>
              b.berlakuMulai <= t.periode &&
              (b.berlakuSampai === null || b.berlakuSampai >= t.periode),
          )
          .map((b) => ({
            blok: b.blok,
            batasAwalM3: b.batasAwalM3,
            batasAkhirM3: b.batasAkhirM3,
            hargaPerM3: b.hargaPerM3,
          }))
        if (blok.length > 0) kandidat.push({ id: g.id, kode: g.kode, blok })
      }

      const cocok = kandidat.filter(
        (g) => hitungHargaAir(t.pemakaianM3, g.blok) === t.jmlHargaAir,
      )
      if (cocok.length === 1) {
        perbarui.push({ id: t.id, golonganId: cocok[0]!.id })
        continue
      }
      // PEMUTUS SERI yang sah: golongan pelanggan SAAT INI, tapi HANYA bila
      // ia termasuk kandidat yang benar-benar mereproduksi angka tagihan.
      // Ini bukan menebak — harga sudah menyempitkan pilihan, dan golongan
      // berjalan memilih di antara yang sama-sama benar. Kalau golongan
      // berjalan TIDAK ada di antara kandidat, barisnya tetap dilewati:
      // artinya pelanggan itu memang pernah pindah golongan dan kita tidak
      // punya dasar untuk memilih.
      //
      // Ambiguitasnya nyata dan tak terhindarkan: 1A dan 1B punya harga blok
      // 1-2 yang identik (900/900), dan pemakaian 0 m3 menghasilkan harga 0
      // di SELURUH golongan.
      if (cocok.length > 1 && t.pelanggan.tarifGolonganId) {
        const pilih = cocok.find((c) => c.id === t.pelanggan.tarifGolonganId)
        if (pilih) {
          perbarui.push({ id: t.id, golonganId: pilih.id })
          lewatGolonganBerjalan++
          continue
        }
      }

      if (cocok.length === 0) takAdaYangCocok++
      else ambigu++
      if (contohGagal.length < 10) {
        contohGagal.push(
          `${t.pelanggan.nomorLangganan} pakai=${t.pemakaianM3} harga=${t.jmlHargaAir} -> ${cocok.length} golongan cocok` +
            (cocok.length > 1
              ? ` (${cocok.map((c) => c.kode).join(", ")})`
              : ""),
        )
      }
    }

    // Dikelompokkan per golongan: 22 ribu update satu per satu ke Postgres
    // terkelola makan waktu berjam-jam (pelajaran dari skrip seed).
    const perGolonganId = new Map<string, string[]>()
    for (const u of perbarui) {
      const arr = perGolonganId.get(u.golonganId)
      if (arr) arr.push(u.id)
      else perGolonganId.set(u.golonganId, [u.id])
    }
    for (const [golonganId, ids] of perGolonganId) {
      const res = await prisma.tagihan.updateMany({
        where: { id: { in: ids } },
        data: { tarifGolonganId: golonganId },
      })
      terisi += res.count
    }
  }

  console.log(`Diproses     : ${diproses}`)
  console.log(
    `Terisi       : ${terisi}  (${lewatGolonganBerjalan} di antaranya lewat pemutus golongan berjalan)`,
  )
  console.log(`Tak ada cocok: ${takAdaYangCocok}`)
  console.log(`Ambigu       : ${ambigu}`)
  if (contohGagal.length > 0) {
    console.log("Contoh yang tidak bisa diturunkan:")
    for (const c of contohGagal) console.log(`  ${c}`)
  }
  console.log(
    `Sisa tanpa golongan beku: ${await prisma.tagihan.count({ where: { tarifGolonganId: null } })}`,
  )
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exitCode = 1
})
