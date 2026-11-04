// prisma/seed/index.ts — orkestrator seed. Dijalankan via `pnpm db:seed`
// atau `npx prisma db seed` (lihat migrations.seed di prisma.config.ts).
//
// MENJALANKAN STEP SATU PER SATU (tanpa argumen = jalankan semua):
//   pnpm db:seed -- 05              satu step (prefix nomor cukup)
//   pnpm db:seed -- 05 06 07        beberapa step, urutannya tetap urutan
//                                   kanonik di bawah, bukan urutan ketik
//   pnpm db:seed -- --from=06       step 06 sampai terakhir
//   pnpm db:seed -- --to=05         step pertama sampai 05
//   pnpm db:seed -- --from=05 --to=07
//   pnpm db:seed -- --list          tampilkan daftar step lalu keluar
//
// Menjalankan sebagian step AMAN karena setiap step idempoten (semua tulis
// lewat upsert) — tapi PRASYARAT FK tetap berlaku: step 06 butuh baris
// Pelanggan dari 05, dst. Kalau prasyaratnya belum pernah dijalankan,
// step-nya tidak error fatal, hanya melewati baris + mencatat warning di
// laporan. Cek bagian "butuh" di daftar di bawah sebelum menjalankan
// sebagian.
//
// SATU-SATUNYA SUMBER SEED ADALAH ProgresCater — ini aturan, bukan kebetulan.
//
// ProgresCater adalah berkas olahan bagian STI dari aplikasi Aurora; edisi
// Januari sendiri merupakan hasil olahan Desember tahun sebelumnya. Ia potret
// SERAH TERIMA: satu kali, untuk membentuk populasi awal.
//
// Tiga berkas lain BUKAN urusan seed, karena ketiganya adalah kejadian
// BULANAN yang di dunia nyata masuk lewat layar aplikasi:
//
//   lapdatameter  catatan petugas, disetor HARIAN sepanjang bulan
//                 -> Impor pencatatan harian (frontend) -> PembacaanMeter
//   PBPK          sambungan baru bulan berjalan, diinput di AKHIR pencatatan
//                 setelah petugas mencapai target & verifikator selesai
//                 -> /dashboard/pbpk -> petakan rute -> verifikasi V1-V3
//   r-nomor       pemutusan, menjelang closing -> layar pemutusan
//
// Dulu ketiganya diimpor di sini (step 07, 08, 09 dan dua jalur di step 05).
// Itu keliru: ia membuat aplikasi terlihat berfungsi padahal yang bekerja
// adalah berkas Aurora, dan menyembunyikan apakah aplikasi ini benar-benar
// sanggup MENGHASILKAN bulan berikutnya sendiri — satu-satunya alasan
// aplikasi ini dibuat. Step-step itu sudah dihapus.
//
// URUTAN STEP MENGIKUTI DEPENDENSI FK — jangan diacak:
//   01 referensi (Divisi, TarifGolongan)
//   02 wilayah (WilayahAdm..Zona, Kecamatan/Kelurahan)
//   03 golongan besar + DMA
//   04 pencatat
//   05 Pelanggan (butuh 01-04)                <- status-sensitive, lihat lib/status.ts
//   06 Meter + PembacaanMeter + Tagihan (butuh 05)
//   10 geometri PostGIS (butuh 02 & 05)
//   11 DaftarCatat/DPM (butuh 02, 04, 05, 06)
//
// SETIAP step dibungkus try/catch level-atas di sini SEBAGAI TAMBAHAN dari
// penanganan per-baris di masing-masing step — kalau satu step gagal total
// (mis. file CSV hilang), step-step lain tetap lanjut jalan alih-alih
// seluruh proses berhenti. Semua upsert bersifat idempoten (aman dijalankan
// berkali-kali, lihat komentar di tiap steps/*.ts) sehingga re-run setelah
// error parsial tidak akan membuat duplikat.

import { prisma } from "./lib/db"
import { SeedReport } from "./lib/report"
import { seedReferensi } from "./steps/01-referensi"
import { seedWilayah } from "./steps/02-wilayah"
import { seedGolonganBesarDma } from "./steps/03-golongan-besar-dma"
import { seedPencatat } from "./steps/04-pencatat"
import { seedPelanggan } from "./steps/05-pelanggan"
import { seedMeter } from "./steps/06-meter"
import { seedPembacaanTagihan } from "./steps/07-pembacaan-tagihan"
import { seedGeometri } from "./steps/10-geometri"
import { seedDaftarCatat } from "./steps/11-daftar-catat"

const STEPS: Array<{ name: string; run: (report: SeedReport) => Promise<void> }> = [
  { name: "01-referensi", run: (r) => seedReferensi(prisma, r) },
  { name: "02-wilayah", run: (r) => seedWilayah(prisma, r) },
  { name: "03-golongan-besar-dma", run: (r) => seedGolonganBesarDma(prisma, r) },
  { name: "04-pencatat", run: (r) => seedPencatat(prisma, r) },
  { name: "05-pelanggan", run: (r) => seedPelanggan(prisma, r) },
  { name: "06-meter", run: (r) => seedMeter(prisma, r) },
  // Terakhir: geometri PostGIS (area kelurahan/kecamatan + koordinat
  // pelanggan dari GeoJSON) — butuh baris kelurahan (02) & pelanggan (05)
  // sudah ada untuk dicocokkan.
  { name: "10-geometri", run: (r) => seedGeometri(prisma, r) },
  // Daftar Catat (DPM) per periode — butuh Pelanggan (05), Rute (02),
  // Pencatat (04). Dijalankan SEBELUM 07 supaya 07 bisa menandai baris yang
  // pembacaannya terbit sebagai DICATAT.
  { name: "11-daftar-catat", run: (r) => seedDaftarCatat(prisma, r) },
  // Sejarah: pembacaan meter (dari lapdatameter) + tagihan (dari DRD) untuk
  // periode yang SUDAH ditutup di Aurora. Periode terakhir sengaja dilewati
  // supaya ada satu bulan yang benar-benar ditutup lewat aplikasi.
  { name: "07-pembacaan-tagihan", run: (r) => seedPembacaanTagihan(prisma, r) },
]

/// Memilih step mana yang dijalankan berdasarkan argumen CLI. Selalu
/// mengembalikan step dalam URUTAN KANONIK (urutan array STEPS), berapa pun
/// urutan pengetikan argumennya — urutan itu menegakkan dependensi FK dan
/// tidak boleh ditentukan oleh urutan ketik pengguna.
///
/// Pencocokan nama memakai prefix ("05" cocok dengan "05-pelanggan", dan
/// nama penuh juga diterima) supaya tidak perlu mengetik nama panjang.
export function selectSteps<T extends { name: string }>(
  argv: readonly string[],
  steps: readonly T[]
): { selected: readonly T[]; error?: string } {
  const positional: string[] = []
  let from: string | undefined
  let to: string | undefined

  for (const arg of argv) {
    if (arg.startsWith("--from=")) from = arg.slice("--from=".length)
    else if (arg.startsWith("--to=")) to = arg.slice("--to=".length)
    else if (arg.startsWith("--")) return { selected: [], error: `Argumen tidak dikenal: ${arg}` }
    else positional.push(arg)
  }

  const indexOf = (token: string): number =>
    steps.findIndex((s) => s.name === token || s.name.startsWith(token))

  if (positional.length > 0 && (from !== undefined || to !== undefined)) {
    return { selected: [], error: "Jangan campur nama step dengan --from/--to — pilih salah satu gaya." }
  }

  if (positional.length > 0) {
    const picked = new Set<string>()
    for (const token of positional) {
      const i = indexOf(token)
      if (i === -1) return { selected: [], error: `Step "${token}" tidak ada. Pakai --list untuk melihat daftarnya.` }
      picked.add(steps[i]!.name)
    }
    // Filter atas STEPS, bukan map atas argumen -> urutan kanonik terjaga.
    return { selected: steps.filter((s) => picked.has(s.name)) }
  }

  let start = 0
  let end = steps.length - 1
  if (from !== undefined) {
    start = indexOf(from)
    if (start === -1) return { selected: [], error: `Step "${from}" (--from) tidak ada.` }
  }
  if (to !== undefined) {
    end = indexOf(to)
    if (end === -1) return { selected: [], error: `Step "${to}" (--to) tidak ada.` }
  }
  if (start > end) {
    return { selected: [], error: `--from (${steps[start]!.name}) ada SESUDAH --to (${steps[end]!.name}).` }
  }
  return { selected: steps.slice(start, end + 1) }
}

/// Penjaga: seed ini adalah MIGRASI SEKALI JALAN dari sistem lama, bukan
/// jalur kode sehari-hari.
///
/// Sejak aplikasi punya jalurnya sendiri untuk seluruh siklus (impor PBPK,
/// rekonsiliasi data induk, closing, buka bulan baru, ekspor DRD), membaca
/// CSV Aurora tidak lagi punya tempat dalam operasi normal. Yang berbahaya
/// bukan skripnya, melainkan kebiasaannya: begitu "jalankan seed dulu" jadi
/// langkah rutin, data resmi diam-diam kembali bersandar pada berkas ekspor
/// aplikasi lain — persis yang ingin dihentikan.
///
/// Karena itu di lingkungan produksi seed menolak jalan tanpa pernyataan
/// eksplisit. Ini bukan soal keamanan (siapa pun yang bisa menjalankannya
/// sudah punya kredensial database), melainkan soal membuat keputusannya
/// SADAR dan tercatat di riwayat perintah.
/// Menolak jalan bila DATABASE_URL bukan Postgres lokal.
///
/// KENAPA INI ADA, dan kenapa `NODE_ENV` saja TIDAK CUKUP. Pada 2026-08-01
/// seed ini berjalan penuh ke Neon produksi dan memperbarui 22.576 baris
/// `pelanggan` sebelum dihentikan. `pastikanBolehMigrasi()` tidak menahannya
/// karena `NODE_ENV` di mesin pengembang memang bukan "production" — padahal
/// DATABASE_URL-nya menunjuk produksi. Yang menentukan bahaya adalah KE MANA
/// tulisannya pergi, bukan label lingkungan di mesin yang menjalankannya.
///
/// Sebabnya sepele dan akan terulang: baris `DATABASE_URL` di `.env` ditimpa
/// URL produksi sementara komentar di atasnya masih tertulis "LOKAL".
/// Penjaga ini membaca nilainya, bukan komentarnya.
function pastikanDatabaseLokal(): boolean {
  const url = process.env.DATABASE_URL ?? ""
  let host = ""
  try {
    host = new URL(url.replace(/^postgres(ql)?:\/\//, "https://")).hostname
  } catch {
    host = "(tidak bisa diurai)"
  }
  const lokal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "db"
  if (lokal) return true
  if (process.env.IZINKAN_SEED_NONLOKAL === "ya") {
    console.warn(`PERINGATAN: seed berjalan ke database NON-LOKAL (${host}) atas izin eksplisit.`)
    return true
  }
  console.error(
    [
      `DITOLAK: DATABASE_URL menunjuk host NON-LOKAL (${host}).`,
      "",
      "Seed menulis puluhan ribu baris data induk. Menjalankannya ke database",
      "produksi akan menimpa data pelanggan yang sedang dipakai aplikasi live.",
      "",
      "Untuk uji siklus, sematkan URL lokal LANGSUNG di perintah — jangan",
      "mengandalkan .env, karena baris di sana mudah tertukar:",
      "",
      '  DATABASE_URL="postgresql://surabie:surabie@localhost:5433/surabiedev" \\',
      '    DIRECT_URL="postgresql://surabie:surabie@localhost:5433/surabiedev" \\',
      "    pnpm db:seed",
      "",
      "Kalau ini memang disengaja ke database jauh, nyatakan eksplisit:",
      "  IZINKAN_SEED_NONLOKAL=ya pnpm db:seed",
    ].join("\n")
  )
  return false
}

function pastikanBolehMigrasi(): boolean {
  if (process.env.NODE_ENV !== "production") return true
  if (process.env.IZINKAN_MIGRASI_AURORA === "ya") return true
  console.error(
    [
      "DITOLAK: seed membaca CSV ekspor Aurora dan hanya untuk MIGRASI sekali jalan.",
      "",
      "Operasi normal TIDAK memerlukannya — gunakan jalur aplikasi:",
      "  sambungan baru      -> /dashboard/pbpk",
      "  koreksi data induk  -> /dashboard/master-pelanggan",
      "  terbitkan tagihan   -> /dashboard/closing",
      "  daftar kerja baru   -> /dashboard/closing (panel bulan baru)",
      "",
      "Kalau ini memang migrasi yang disengaja, jalankan ulang dengan:",
      "  IZINKAN_MIGRASI_AURORA=ya pnpm db:seed",
    ].join("\n")
  )
  return false
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)

  // Penjaga TUJUAN diperiksa lebih dulu: ke mana tulisannya pergi adalah
  // pertanyaan yang lebih menentukan daripada label lingkungan.
  if (!argv.includes("--list") && !pastikanDatabaseLokal()) {
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }

  if (!argv.includes("--list") && !pastikanBolehMigrasi()) {
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }

  if (argv.includes("--list")) {
    console.log("Step seed yang tersedia:")
    for (const s of STEPS) console.log(`  ${s.name}`)
    console.log("\nContoh: pnpm db:seed -- 05        (satu step)")
    console.log("        pnpm db:seed -- --from=06  (step 06 sampai terakhir)")
    await prisma.$disconnect()
    return
  }

  const { selected, error } = selectSteps(argv, STEPS)
  if (error) {
    console.error(`Argumen seed tidak valid: ${error}`)
    console.error("Pakai --list untuk melihat daftar step.")
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }

  if (selected.length < STEPS.length) {
    console.log(
      `Menjalankan SEBAGIAN step (${selected.length}/${STEPS.length}): ${selected.map((s) => s.name).join(", ")}`
    )
    console.log("Pastikan prasyarat FK-nya sudah pernah diseed — lihat catatan di atas file ini.")
  }

  const report = new SeedReport()

  for (const step of selected) {
    const startedAt = Date.now()
    console.log(`\n>>> ${step.name} ...`)
    try {
      await step.run(report)
      console.log(`<<< ${step.name} selesai (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`)
    } catch (err) {
      // Jaring pengaman level-step: satu step gagal total TIDAK
      // menghentikan step lain. Error per-baris di dalam step sendiri
      // sudah ditangani di masing-masing steps/*.ts.
      report.error(step.name, `Step gagal total: ${(err as Error).message}`)
      console.error(`!!! ${step.name} GAGAL:`, err)
    }
  }

  report.printSummary()
  const reportPath = report.writeToFile()
  console.log(`Laporan lengkap: ${reportPath}`)

  await prisma.$disconnect()

  if (report.errorCount > 0) {
    process.exitCode = 1
  }
}

main().catch(async (err) => {
  console.error("Seed gagal fatal:", err)
  await prisma.$disconnect()
  process.exitCode = 1
})
