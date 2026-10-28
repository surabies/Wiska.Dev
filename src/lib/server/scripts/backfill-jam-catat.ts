// scripts/backfill-jam-catat.ts — MENGEMBALIKAN JAM PADA `tanggalCatat`.
//
// Jalankan: pnpm server:backfill-jam-catat            (pratinjau, tidak menulis)
//           pnpm server:backfill-jam-catat --terapkan
//
// MASALAHNYA. `tanggalCatat` di database berisi tanggal saja — 22.531 dari
// 22.532 baris laporan harian dan SELURUH 157.706 pembacaan meter berjam
// 00:00:00. Jam-nya tidak pernah hilang di sumbernya: berkas seed memakai
// `lapdatametertes.csv` yang memang hanya membawa tanggal, sementara
// `ProgresCater-PW5.csv` menyimpan waktu lengkap sampai detik
// ("2026-07-06 10:17:16") dan 100% terisi di ketujuh bulan.
//
// KENAPA JAMNYA PENTING, bukan sekadar kerapian. Waktu kunjungan adalah
// SATU-SATUNYA jejak urutan berjalan petugas — di aplikasi lama urutan itu
// disusun petugas sendiri dan tidak pernah diekspor ke tabel mana pun.
// Dengan jamnya utuh, layar rute bisa menampilkan "dicatat 08:47" di tiap
// baris, dan urutan rute bisa diturunkan ulang kapan saja tanpa membaca CSV.
//
// TANGGALNYA TIDAK DIUBAH, HANYA DILENGKAPI JAM. Kalau tanggal di database
// berbeda hari dari tanggal di ProgresCater, barisnya DILEWATI dan dilaporkan
// — perbedaan hari berarti dua sumber bicara tentang kunjungan yang berbeda,
// dan menimpanya akan menghapus keterangan yang mungkin benar.
import { DATA_DIR } from "./env"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { prisma } from "@db"

const BERKAS: Record<string, number> = {
  jan: 202601,
  feb: 202602,
  mar: 202603,
  apr: 202604,
  mei: 202605,
  juni: 202606,
  juli: 202607,
}
const BENTUK = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

/// Waktu di berkas Aurora adalah waktu LOKAL Bandung (UTC+7). Disimpan
/// sebagai UTC supaya sebanding dengan stempel kiriman aplikasi, yang juga
/// UTC. Tanpa penyesuaian ini, "08:47 WIB" akan terbaca 15:47 di layar.
function keUtc(teks: string): Date | null {
  const m = BENTUK.exec(teks)
  if (!m) return null
  const [, th, bl, hr, jj, mm, dd] = m
  return new Date(Date.UTC(+th!, +bl! - 1, +hr!, +jj! - 7, +mm!, +dd!))
}

const hariLokal = (d: Date): string =>
  new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10)

function bacaWaktu(dir: string): Map<string, Date> {
  const peta = new Map<string, Date>()
  const path = resolve(DATA_DIR, dir, "ProgresCater-PW5.csv")
  if (!existsSync(path)) return peta
  const garis = readFileSync(path, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((g) => g.trim() !== "")
  const header = garis[0]!.split(";").map((h) => h.trim())
  const iNo = header.indexOf("nolg")
  const iTgl = header.indexOf("tglcatat")
  if (iNo < 0 || iTgl < 0) return peta
  for (const g of garis.slice(1)) {
    const k = g.split(";")
    const waktu = keUtc((k[iTgl] ?? "").trim())
    if (waktu) peta.set((k[iNo] ?? "").trim().padStart(11, "0"), waktu)
  }
  return peta
}

interface Hitung {
  cocok: number
  bedaHari: number
  sudahBerjam: number
  takAdaWaktu: number
}

async function main(): Promise<void> {
  const terapkan = process.argv.includes("--terapkan")
  const total: Hitung = {
    cocok: 0,
    bedaHari: 0,
    sudahBerjam: 0,
    takAdaWaktu: 0,
  }

  for (const [dir, thbl] of Object.entries(BERKAS)) {
    const waktu = bacaWaktu(dir)
    if (waktu.size === 0) {
      console.log(`${thbl}: berkas tidak ada — dilewati`)
      continue
    }

    // Laporan harian (pra-verifikasi) dan pembacaan resmi sama-sama membawa
    // tanggalCatat, dan keduanya dibaca layar yang berbeda — jadi keduanya
    // dilengkapi, bukan salah satu.
    const laporan = await prisma.laporanHarianPetugas.findMany({
      where: { periode: thbl },
      select: { id: true, nomorLangganan: true, tanggalCatat: true },
    })
    const pembacaan = await prisma.pembacaanMeter.findMany({
      where: {
        periode: new Date(
          Date.UTC(Math.floor(thbl / 100), (thbl % 100) - 1, 1),
        ),
      },
      select: {
        id: true,
        tanggalCatat: true,
        meter: { select: { pelanggan: { select: { nomorLangganan: true } } } },
      },
    })

    const rencana: {
      tabel: "laporan" | "pembacaan"
      id: string
      waktu: Date
    }[] = []
    const nilai = (nolg: string | null | undefined, lama: Date | null) => {
      if (!nolg) {
        total.takAdaWaktu++
        return null
      }
      const baru = waktu.get(nolg)
      if (!baru) {
        total.takAdaWaktu++
        return null
      }
      if (lama && (lama.getUTCHours() !== 0 || lama.getUTCMinutes() !== 0)) {
        total.sudahBerjam++
        return null
      }
      // Hari harus sama; beda hari = dua kunjungan yang berbeda.
      if (lama && hariLokal(lama) !== hariLokal(baru)) {
        total.bedaHari++
        return null
      }
      total.cocok++
      return baru
    }

    for (const l of laporan) {
      const w = nilai(l.nomorLangganan, l.tanggalCatat)
      if (w) rencana.push({ tabel: "laporan", id: l.id, waktu: w })
    }
    for (const b of pembacaan) {
      const w = nilai(b.meter?.pelanggan?.nomorLangganan, b.tanggalCatat)
      if (w) rencana.push({ tabel: "pembacaan", id: b.id, waktu: w })
    }

    console.log(
      `${thbl}: laporan ${laporan.length}, pembacaan ${pembacaan.length} -> akan dilengkapi ${rencana.length}`,
    )

    if (!terapkan) continue

    // SATU pernyataan UPDATE ... FROM (VALUES ...) per potongan, bukan
    // setumpuk update lewat Prisma. Bentuk bertumpuk sempat dicoba dan
    // menabrak batas waktu transaksi interaktif Prisma (P2028, 5 detik) pada
    // 500 baris — 180 ribu baris memang bukan pekerjaan untuk round-trip
    // satu per satu. Parameter posisi dipakai, BUKAN penyisipan nilai ke
    // dalam string (lihat server/README.md).
    const UKURAN = 1000
    for (const tabel of ["laporan", "pembacaan"] as const) {
      const daftar = rencana.filter((r) => r.tabel === tabel)
      const nama =
        tabel === "laporan" ? "laporan_harian_petugas" : "pembacaan_meter"
      for (let i = 0; i < daftar.length; i += UKURAN) {
        const kel = daftar.slice(i, i + UKURAN)
        const nilaiSql = kel
          .map((_, j) => `($${j * 2 + 1}::text, $${j * 2 + 2}::timestamptz)`)
          .join(",")
        const params = kel.flatMap((r) => [r.id, r.waktu.toISOString()])
        await prisma.$executeRawUnsafe(
          `UPDATE ${nama} t SET "tanggalCatat" = v.w FROM (VALUES ${nilaiSql}) AS v(id, w) WHERE t.id = v.id`,
          ...params,
        )
      }
    }
    console.log(`  ditulis ${rencana.length}`)
  }

  console.log(
    `\ncocok ${total.cocok} | beda hari ${total.bedaHari} | sudah berjam ${total.sudahBerjam} | tanpa waktu di berkas ${total.takAdaWaktu}`,
  )
  if (!terapkan)
    console.log(
      "\n(PRATINJAU — tidak ada yang ditulis. Tambahkan --terapkan untuk menjalankan.)",
    )
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exitCode = 1
})
