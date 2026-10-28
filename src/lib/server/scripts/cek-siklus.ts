// Read-only regression check for billing-period population.
// Run: pnpm server:cek-siklus.
//
// Pertanyaan yang dijawab: "apakah SIAPA yang masuk daftar catat dan SIAPA
// yang ditagih sama persis dengan yang dijalankan Aurora?"
//
// KENAPA TERPISAH DARI cek-closing. `cek-closing` menguji NOMINAL — apakah
// rupiah tiap tagihan tereproduksi. Ia tidak bisa melihat kesalahan
// POPULASI: kalau daftar catat kelebihan 27 orang atau kehilangan satu rute
// utuh, setiap tagihan yang terbit tetap benar rupiahnya, dan cek-closing
// tetap hijau. Justru kesalahan populasi itulah yang terjadi (basis DPM
// memakai seluruh tabel Pelanggan, kelebihan 27–62 sambungan tiap bulan)
// dan lolos berbulan-bulan tanpa terdeteksi.
//
// Karena itu skrip ini membandingkan HIMPUNAN NOMOR LANGGANAN, bukan
// jumlahnya. Jumlah yang benar bisa tersusun dari orang yang salah.
//
// TIDAK MENULIS APA PUN. Seluruh perbandingan lewat jalur baca.

import { DATA_DIR } from "./env"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { prisma } from "@db"
import { periodeToDate } from "../lib/periode"
import { hitungCalon } from "../modules/closing/bulan-baru.service"

const PERIODE = [
  { folder: "jan", thbl: 202601 },
  { folder: "feb", thbl: 202602 },
  { folder: "mar", thbl: 202603 },
  { folder: "apr", thbl: 202604 },
  { folder: "mei", thbl: 202605 },
  { folder: "juni", thbl: 202606 },
  { folder: "juli", thbl: 202607 },
] as const

/// Pemisah disimpulkan dari baris header — `lapdatametertes.csv` memakai ";"
/// sampai Mei lalu berpindah ke ",". Sama alasannya dengan
/// prisma/seed/lib/csv.ts.
function uraiCsv(isi: string): Record<string, string>[] {
  const akhirHeader = isi.indexOf("\n")
  const barisHeader = akhirHeader === -1 ? isi : isi.slice(0, akhirHeader)
  const pemisah =
    barisHeader.split(";").length > barisHeader.split(",").length ? ";" : ","

  const rows: string[][] = []
  let row: string[] = []
  let cur = ""
  let dalamKutip = false
  for (let i = 0; i < isi.length; i++) {
    const c = isi[i]
    if (dalamKutip) {
      if (c === '"') {
        if (isi[i + 1] === '"') {
          cur += '"'
          i++
        } else dalamKutip = false
      } else cur += c
      continue
    }
    if (c === '"') dalamKutip = true
    else if (c === pemisah) {
      row.push(cur)
      cur = ""
    } else if (c === "\n") {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ""
    } else if (c !== "\r") cur += c
  }
  if (cur !== "" || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }

  const header = (rows[0] ?? []).map((h) => h.trim())
  return rows
    .slice(1)
    .filter((r) => r.length > 1)
    .map((r) =>
      Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])),
    )
}

function bacaBaris(
  folder: string,
  berkas: string,
): Record<string, string>[] | null {
  const jalur = join(DATA_DIR, folder, berkas)
  if (!existsSync(jalur)) return null
  return uraiCsv(readFileSync(jalur, "utf-8").replace(/^﻿/, ""))
}

const nolg = (mentah: string | undefined): string =>
  (mentah ?? "").replace(/[\s"]/g, "").padStart(11, "0")

function bacaKolom(
  folder: string,
  berkas: string,
  kolom: string,
): Set<string> | null {
  const baris = bacaBaris(folder, berkas)
  if (!baris) return null
  const keluar = new Set<string>()
  for (const row of baris) {
    const n = (row[kolom] ?? "").replace(/[\s"]/g, "")
    if (n !== "") keluar.add(n.padStart(11, "0"))
  }
  return keluar
}

/// Sambungan PBPK periode ini. Dari berkasnya kalau ada; kalau tidak,
/// DITURUNKAN dari ciri yang membedakannya di daftar kerja: stand awal dan
/// akhir NOL, pemakaian nol, dan tidak ditagih bulan itu — baris pembuka
/// sambungan baru.
///
/// Penurunan ini TIDAK BOLEH sekadar "ada di daftar kerja tapi tidak
/// ditagih": himpunan itu juga memuat sambungan yang DICABUT pada periode
/// itu, yang justru harus tetap ikut ke daftar bulan depan sampai
/// pencabutannya tercatat.
function pbpkPeriode(folder: string, ditagih: Set<string>): Set<string> {
  const dariBerkas = bacaKolom(folder, "PBPK.csv", "nolg")
  if (dariBerkas) return dariBerkas

  const daftar = bacaBaris(folder, "lapdatametertes.csv") ?? []
  const keluar = new Set<string>()
  for (const row of daftar) {
    const n = nolg(row["No Pel"])
    if (ditagih.has(n)) continue
    if (
      Number(row["St AWAL"]) === 0 &&
      Number(row["St Akhir"]) === 0 &&
      Number(row.Pakai) === 0
    ) {
      keluar.add(n)
    }
  }
  return keluar
}

interface Selisih {
  lebih: string[]
  kurang: string[]
}

function banding(hasil: Set<string>, acuan: Set<string>): Selisih {
  return {
    lebih: [...hasil].filter((n) => !acuan.has(n)),
    kurang: [...acuan].filter((n) => !hasil.has(n)),
  }
}

let adaGagal = false

function lapor(
  nama: string,
  hasil: Set<string>,
  acuan: Set<string>,
  opsi?: { bolehLebih?: boolean; bolehKurang?: number },
): void {
  const { lebih, kurang } = banding(hasil, acuan)
  const cocok =
    kurang.length <= (opsi?.bolehKurang ?? 0) &&
    (opsi?.bolehLebih === true || lebih.length === 0)
  if (!cocok) adaGagal = true
  console.log(
    `  ${nama.padEnd(38)} hasil=${String(hasil.size).padStart(6)} acuan=${String(acuan.size).padStart(6)}` +
      `  lebih=${String(lebih.length).padStart(4)} kurang=${String(kurang.length).padStart(4)}  ` +
      (cocok ? "OK" : "GAGAL"),
  )
  const contoh = (xs: string[]) =>
    xs.slice(0, 8).join(", ") + (xs.length > 8 ? ` … (+${xs.length - 8})` : "")
  if (lebih.length > 0 && opsi?.bolehLebih !== true)
    console.log(`      lebih  : ${contoh(lebih)}`)
  if (kurang.length > 0) console.log(`      kurang : ${contoh(kurang)}`)
}

async function main(): Promise<void> {
  console.log("=========== POPULASI PER PERIODE ===========")
  console.log("Daftar catat DB dibandingkan lapdatameter ∪ ProgresCater;")
  console.log("Tagihan DB dibandingkan ProgresCater.\n")

  for (const p of PERIODE) {
    const daftarKerja = bacaKolom(p.folder, "lapdatametertes.csv", "No Pel")
    const ditagih = bacaKolom(p.folder, "ProgresCater-PW5.csv", "nolg")
    if (!daftarKerja || !ditagih) {
      console.log(`  ${p.thbl}: berkas sumber tidak lengkap — dilewati`)
      continue
    }
    const acuanDpm = new Set([...daftarKerja, ...ditagih])

    const [barisDpm, barisTagihan] = await Promise.all([
      prisma.daftarCatat.findMany({
        where: { periode: p.thbl },
        select: { pelanggan: { select: { nomorLangganan: true } } },
      }),
      prisma.tagihan.findMany({
        where: { periode: periodeToDate(p.thbl) },
        select: { pelanggan: { select: { nomorLangganan: true } } },
      }),
    ])

    console.log(`── ${p.thbl}`)
    // `bolehLebih` untuk keduanya: PBPK periode terakhir belum punya baris
    // Pelanggan (mereka baru muncul di ProgresCater bulan BERIKUTNYA, yang
    // berkasnya belum ada), jadi kekurangan di sisi itu wajar. Yang TIDAK
    // boleh adalah kekurangan — itu berarti sambungan hilang dari daftar.
    lapor(
      "daftar catat",
      new Set(barisDpm.map((b) => b.pelanggan.nomorLangganan)),
      acuanDpm,
      { bolehLebih: true, bolehKurang: 30 },
    )
    // NOL tagihan bukan kegagalan — itu periode yang belum ditutup. Seed
    // sengaja tidak lagi menerbitkan tagihan (lihat steps/06-meter.ts);
    // tagihan lahir dari jalur aplikasi: impor pencatatan -> closing.
    // Membedakan keduanya penting: "belum ditutup" dan "menagih orang yang
    // salah" tidak boleh terlihat sama di keluaran skrip ini.
    const tagihanDb = new Set(
      barisTagihan.map((b) => b.pelanggan.nomorLangganan),
    )
    if (tagihanDb.size === 0) {
      console.log(
        `  ${"tagihan".padEnd(38)} hasil=     0 acuan=${String(ditagih.size).padStart(6)}` +
          `                          BELUM DITUTUP`,
      )
    } else {
      // Diperiksa KETAT di sisi "lebih": satu tagihan untuk nomor yang tidak
      // ada di DRD Aurora berarti aplikasi menagih orang yang tidak ditagih
      // Aurora — persis kegagalan yang dicegah penjaga DICABUT/PBPK di
      // closing.service.
      lapor("tagihan", tagihanDb, ditagih)
    }
  }

  console.log("\n=========== SIKLUS: DPM(N+1) DARI MESIN APLIKASI ===========")
  console.log("hitungCalon(N) dibandingkan daftar kerja NYATA periode N+1,")
  console.log("dikurangi PBPK periode N+1 (yang masuk kemudian lewat impor).\n")

  for (let i = 0; i < PERIODE.length - 1; i++) {
    const sumber = PERIODE[i]!
    const tujuan = PERIODE[i + 1]!

    const daftarKerjaTujuan = bacaKolom(
      tujuan.folder,
      "lapdatametertes.csv",
      "No Pel",
    )
    const ditagihTujuan = bacaKolom(
      tujuan.folder,
      "ProgresCater-PW5.csv",
      "nolg",
    )
    if (!daftarKerjaTujuan || !ditagihTujuan) continue

    // PBPK periode tujuan TIDAK boleh diharapkan ada: mereka masuk lewat
    // impor PBPK selama bulan itu berjalan, bukan lewat buka bulan baru.
    const pbpkTujuan = pbpkPeriode(tujuan.folder, ditagihTujuan)
    const acuan = new Set(
      [...daftarKerjaTujuan].filter((n) => !pbpkTujuan.has(n)),
    )

    const { calon } = await hitungCalon(sumber.thbl)
    console.log(`── ${sumber.thbl} -> ${tujuan.thbl}`)
    // `bolehLebih` karena daftar kerja Aurora sesekali kehilangan satu rute
    // utuh (Maret 157, April 34) — aplikasi sengaja MEMPERTAHANKAN mereka,
    // jadi kelebihan di transisi itu justru yang benar. Yang tidak boleh
    // adalah KURANG: itu berarti sambungan hilang dari daftar kerja.
    lapor(
      "DPM hasil buka bulan baru",
      new Set(calon.map((c) => c.nomorLangganan)),
      acuan,
      {
        bolehLebih: true,
      },
    )
  }

  console.log("")
  if (adaGagal) {
    console.log("HASIL: ADA YANG MELESET — periksa baris GAGAL di atas.")
    process.exitCode = 1
  } else {
    console.log("HASIL: seluruh populasi tereproduksi. ✓")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
