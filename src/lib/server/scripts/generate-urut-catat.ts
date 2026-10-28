// scripts/generate-urut-catat.ts — MENURUNKAN URUTAN KUNJUNGAN PETUGAS dari
// JAM PENCATATAN yang tersimpan di ProgresCater.
//
// Jalankan: pnpm server:generate-urut-catat            (pratinjau, tidak menulis)
//           pnpm server:generate-urut-catat --terapkan
//
// ─── KENAPA DARI JAM, DAN KENAPA BUKAN DARI YANG LAIN ───────────────────
//
// Urutan kunjungan TIDAK ADA di data induk mana pun: di aplikasi lama,
// petugas sendiri yang menyusunnya. Yang tertinggal di data hanyalah
// JEJAKNYA — jam saat tiap rumah dicatat. Kolom `tglcatat` di ProgresCater
// menyimpannya lengkap sampai detik ("2026-07-06 10:17:16"), 100% terisi di
// ketujuh berkas bulanan, dengan sebaran jam yang persis hari kerja: puncak
// 08.00-11.00, meredup sampai 17.00.
//
// Dua percobaan sebelumnya gagal dan alasannya perlu dicatat supaya tidak
// diulang:
//
//   - Urutan BARIS lapdatametertes.csv. Ditolak: di dalam satu rute, 99,2%
//     barisnya menaik menurut nomor langganan (78 dari 115 rute terurut
//     sempurna). Berkas itu diurutkan, bukan direkam.
//   - Uji kestabilan antar bulan atas urutan itu memberi 91-96% dan sempat
//     saya kira bukti. Bukan: daftar yang TERURUT stabil dengan sendirinya.
//     Kestabilan hanya berarti sesuatu bila urutannya tidak tersusun menurut
//     hal struktural apa pun.
//
// Urutan dari jam lolos KEDUA ujinya sekaligus:
//
//   kemiripan dengan urutan nomor langganan : 50,3-50,6%  (= setara acak)
//   kestabilan antar bulan (LCS per rute)   : 95,0-96,2%  (6 transisi, 115 rute)
//
// Tidak berhubungan dengan nomor, tapi berulang tiap bulan. Itu definisi
// kebiasaan.
//
// ─── KENAPA MEDIAN, BUKAN BULAN TERAKHIR ────────────────────────────────
//
// Satu bulan bisa kacau karena hal sepele: petugas sakit dan rutenya
// dititipkan, hujan memaksa memutar balik, satu blok ditunda ke hari lain.
// Memakai bulan terakhir berarti satu kejadian seperti itu menetapkan urutan
// untuk seterusnya. Median atas semua bulan mengambil posisi LAZIMNYA dan
// mengabaikan bulan yang menyimpang.
//
// Posisi disimpan sebagai PECAHAN (peringkat / jumlah anggota rute bulan
// itu), bukan peringkat mentah: jumlah anggota rute berubah tiap bulan
// (cabutan, PBPK), dan peringkat 50 dari 100 bukan hal yang sama dengan 50
// dari 200.
//
// ─── YANG TIDAK PUNYA JEJAK ─────────────────────────────────────────────
//
// Pelanggan yang tidak pernah muncul berjam di berkas mana pun ditaruh di
// EKOR rutenya, berurut nomor persil lalu nomor langganan. Nomor persil
// dipakai karena ia cerminan hirarki data (urutan DPM) — tebakan terbaik
// yang tersedia untuk rumah yang belum pernah dikunjungi dengan jejak waktu.
import { DATA_DIR } from "./env"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { prisma } from "@db"

const BERKAS = ["jan", "feb", "mar", "apr", "mei", "juni", "juli"]

interface BarisCater {
  nolg: string
  rute: string
  tgl: string
}

function bacaProgresCater(dir: string): BarisCater[] | null {
  const path = resolve(DATA_DIR, dir, "ProgresCater-PW5.csv")
  if (!existsSync(path)) return null
  const garis = readFileSync(path, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((g) => g.trim() !== "")
  const header = garis[0]!.split(";").map((h) => h.trim())
  const iNo = header.indexOf("nolg")
  const iRute = header.indexOf("rute_kode")
  const iTgl = header.indexOf("tglcatat")
  if (iNo < 0 || iRute < 0 || iTgl < 0) return null
  return garis.slice(1).map((g) => {
    const k = g.split(";")
    return {
      nolg: (k[iNo] ?? "").trim().padStart(11, "0"),
      rute: (k[iRute] ?? "").trim(),
      tgl: (k[iTgl] ?? "").trim(),
    }
  })
}

const BENTUK_WAKTU = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

function median(nilai: number[]): number {
  const urut = [...nilai].sort((a, b) => a - b)
  const t = urut.length >> 1
  return urut.length % 2 === 1 ? urut[t]! : (urut[t - 1]! + urut[t]!) / 2
}

async function main(): Promise<void> {
  const terapkan = process.argv.includes("--terapkan")

  // nomorLangganan -> daftar posisi pecahan, satu per bulan.
  const posisi = new Map<string, number[]>()
  for (const dir of BERKAS) {
    const rows = bacaProgresCater(dir)
    if (!rows) {
      console.warn(`  ${dir}: berkas/kolom tidak lengkap — dilewati`)
      continue
    }

    // Dikelompokkan menurut rute DI BULAN ITU: urutan kunjungan hanya punya
    // arti di dalam satu rute, dan rute seorang pelanggan bisa berpindah.
    const perRute = new Map<string, BarisCater[]>()
    let tanpaWaktu = 0
    for (const r of rows) {
      if (!BENTUK_WAKTU.test(r.tgl)) {
        tanpaWaktu++
        continue
      }
      const daftar = perRute.get(r.rute) ?? []
      daftar.push(r)
      perRute.set(r.rute, daftar)
    }
    for (const daftar of perRute.values()) {
      // Tie-break nomor langganan hanya untuk stempel waktu yang identik
      // sampai detik — jarang, tapi harus deterministik.
      daftar.sort(
        (a, b) => a.tgl.localeCompare(b.tgl) || a.nolg.localeCompare(b.nolg),
      )
      daftar.forEach((r, i) => {
        const p = posisi.get(r.nolg) ?? []
        p.push((i + 1) / daftar.length)
        posisi.set(r.nolg, p)
      })
    }
    console.log(
      `  ${dir}: ${rows.length} baris, ${perRute.size} rute, tanpa waktu ${tanpaWaktu}`,
    )
  }
  console.log(`Jejak waktu terkumpul untuk ${posisi.size} nomor langganan`)

  const pelanggan = await prisma.pelanggan.findMany({
    where: { deletedAt: null, ruteId: { not: null } },
    select: {
      id: true,
      nomorLangganan: true,
      nomorPersil: true,
      ruteId: true,
      noUrutRute: true,
    },
  })

  const perRute = new Map<string, typeof pelanggan>()
  for (const p of pelanggan) {
    const daftar = perRute.get(p.ruteId!) ?? []
    daftar.push(p)
    perRute.set(p.ruteId!, daftar)
  }

  const rencana: { id: string; urut: number }[] = []
  let tanpaJejak = 0
  for (const daftar of perRute.values()) {
    const berurut = [...daftar].sort((a, b) => {
      const pa = posisi.get(a.nomorLangganan)
      const pb = posisi.get(b.nomorLangganan)
      if (pa && pb) {
        const beda = median(pa) - median(pb)
        if (beda !== 0) return beda
        return a.nomorLangganan.localeCompare(b.nomorLangganan)
      }
      if (pa) return -1
      if (pb) return 1
      // Sama-sama tanpa jejak: pakai hirarki data (nomor persil).
      return (
        (a.nomorPersil ?? "").localeCompare(b.nomorPersil ?? "") ||
        a.nomorLangganan.localeCompare(b.nomorLangganan)
      )
    })
    berurut.forEach((p, i) => {
      if (!posisi.has(p.nomorLangganan)) tanpaJejak++
      const urut = i + 1
      if (p.noUrutRute !== urut) rencana.push({ id: p.id, urut })
    })
  }

  console.log(`Rute diproses          : ${perRute.size}`)
  console.log(`Pelanggan ber-rute     : ${pelanggan.length}`)
  console.log(`Tanpa jejak waktu (ekor): ${tanpaJejak}`)
  console.log(`Nomor urut berubah     : ${rencana.length}`)

  if (!terapkan) {
    console.log(
      "\n(PRATINJAU — tidak ada yang ditulis. Tambahkan --terapkan untuk menjalankan.)",
    )
    await prisma.$disconnect()
    return
  }

  const UKURAN = 200
  let ditulis = 0
  for (let i = 0; i < rencana.length; i += UKURAN) {
    const kelompok = rencana.slice(i, i + UKURAN)
    await prisma.$transaction(
      kelompok.map((r) =>
        prisma.pelanggan.update({
          where: { id: r.id },
          data: { noUrutRute: r.urut },
        }),
      ),
    )
    ditulis += kelompok.length
    if (ditulis % 4000 === 0 || ditulis === rencana.length)
      console.log(`  ${ditulis}/${rencana.length}`)
  }
  console.log(`\nDitulis: ${ditulis}`)
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exitCode = 1
})
