// prisma/seed/lib/csv.ts — pembaca CSV bertipe untuk keempat sumber data
// legacy. Sebagian besar file memakai delimiter ";" dan BOM UTF-8 (standar
// export Excel Indonesia), TAPI TIDAK SEMUA — lihat deteksiPemisah(). File
// mentah TIDAK PERNAH ditulis ulang oleh kode ini — hanya dibaca (lihat
// prisma/docs/README.md bagian "Filosofi ETL").

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "csv-parse/sync"

const DATA_DIR = join(process.cwd(), "prisma", "data")

/// Menyimpulkan pemisah kolom dari BARIS HEADER, bukan dari asumsi.
///
/// KENAPA ADA: `lapdatametertes.csv` periode jan–mei memakai ";", sedangkan
/// juni dan juli memakai ",". Sumbernya sama (ekspor Aurora), formatnya
/// berubah di tengah jalan tanpa pemberitahuan. Delimiter yang dipatok mati
/// membuat berkas bulan baru terurai jadi SATU kolom raksasa — dan karena
/// `relax_column_count` menelan bentuk apa pun tanpa protes, hasilnya bukan
/// error melainkan nol baris yang sunyi. Persis kegagalan yang paling mahal:
/// seed "berhasil" tapi datanya tidak masuk.
///
/// Header dipakai karena ia satu-satunya baris yang dijamin tidak memuat
/// alamat berkoma/bertitik-koma di dalam kutip.
function deteksiPemisah(isi: string): ";" | "," {
  const akhirBaris = isi.indexOf("\n")
  const header = akhirBaris === -1 ? isi : isi.slice(0, akhirBaris)
  return header.split(";").length > header.split(",").length ? ";" : ","
}

function urai<T>(isi: string): T[] {
  return parse(isi, {
    delimiter: deteksiPemisah(isi),
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as T[]
}

function readCsv<T>(filename: string): T[] {
  return urai<T>(readFileSync(join(DATA_DIR, filename), "utf-8"))
}

/// ProgresCater-PW5.csv — closing pencatatan meter bulanan, dasar
/// rekapitulasi wilayah pelayanan & DRD. Sumber utama untuk Pelanggan,
/// Meter, PembacaanMeter, Tagihan, dan hierarki wilayah.
export interface ProgresCaterRow {
  thbl: string
  nolg: string
  nprs: string
  nama: string
  almt: string
  trp: string
  namatrp: string
  ukr: string
  tmss: string
  ketcatat: string
  stml: string
  stma: string
  pakai_drd: string
  blok_m3: string
  jmlhargaair: string
  beabeban: string
  beaadmin: string
  airkotor: string
  lainlain: string
  tjtg: string
  pakailalu: string
  blok_m3lalu: string
  wiladmkode: string
  wiladmnama: string
  kdkec: string
  namakec: string
  kdkel: string
  namakel: string
  rw: string
  rt: string
  caterseksikode: string
  caterseksinama: string
  rute_kode: string
  pencatat: string
  wildistkode: string
  wildistnama: string
  wilseksikode: string
  wilseksinama: string
  zonakode: string
  zonanama: string
  obid: string
  obnama: string
  gbid: string
  gbnama: string
  isovb: string
  ps: string
  mbr: string
  ismbr: string
  kd_merkmeter: string
  ukmeter: string
  nometer: string
  nosegelmeter: string
  tglpasangmeter: string
  umurmeterthn: string
  umurmeterbln: string
  umurmeterhari: string
  umurmeterkode: string
  umurmeternama: string
  notelp: string
  potensialpenagihan: string
  potensialcater: string
  durasi: string
  jamgilirstart: string
  jamgilirend: string
  waktugilir: string
  pb: string
  pk: string
  jmlreknunggak: string
  tagnunggak: string
  jmlreknunggakkode: string
  jmlreknunggaknama: string
  nominalnunggakkode: string
  nominalnunggaknama: string
  blokm3nama: string
  nominalkode: string
  nominalnama: string
  kondisimeterkode: string
  kondisimeternama: string
  wpkode: string
  dmakode: string
  mutasikode: string
  mutasinama: string
  kategorialkode: string
  kategorialnama: string
  tglcatat: string
}

/// ────────────────────────────────────────────────────────────────────────
/// PEMBACAAN PER PERIODE
///
/// Data disusun per folder bulan di `prisma/data/{jan,…,juli}`.
/// Susunan ini bukan kerapian belaka — ia yang memungkinkan impor progresif:
/// Januari MEMBENTUK database, bulan berikutnya MEMPERBARUI, dan pelanggan
/// yang HILANG antar-bulan berarti dicabut.
///
/// PERAN KEDUA BERKAS — DIKOREKSI 2026-08-01, sebelumnya tertulis terbalik:
///
///   `lapdatametertes.csv` = DAFTAR CATAT (DPM). Inilah daftar kerja petugas
///     yang benar-benar dijalankan di Aurora, dan karena itu ia acuan untuk
///     "siapa yang harus dikunjungi periode ini".
///
///   `ProgresCater-PW5.csv` = HASIL CLOSING (DRD). Ia KELUARAN dari periode
///     yang sudah ditutup, bukan masukan. Di aplikasi ini padanannya adalah
///     ekspor DRD.
///
/// Keduanya tetap dibaca bersama, karena daftar kerja Aurora sesekali
/// kehilangan satu rute utuh akibat gagal unggah (Maret: 157 sambungan di
/// TA607 & KC202; April: 34 di KC302) sementara pelanggannya TETAP ditagih.
/// Karena itu DPM diturunkan sebagai gabungan keduanya — lihat
/// steps/11-daftar-catat.ts.
/// ────────────────────────────────────────────────────────────────────────

/// Urutan periode WAJIB kronologis: seluruh deteksi cabutan & sambungan baru
/// bersandar pada perbandingan bulan-ke-bulan yang berurutan.
const SEMUA_PERIODE = [
  { folder: "jan", thbl: 202601 },
  { folder: "feb", thbl: 202602 },
  { folder: "mar", thbl: 202603 },
  { folder: "apr", thbl: 202604 },
  { folder: "mei", thbl: 202605 },
  { folder: "juni", thbl: 202606 },
  { folder: "juli", thbl: 202607 },
  { folder: "agustus", thbl: 202608 },
] as const

export type Periode = (typeof SEMUA_PERIODE)[number]

/// SEED_PERIODE membatasi periode mana yang dibaca seed — dipakai untuk
/// menguji kemandirian aplikasi: impor ProgresCater HANYA untuk Januari
/// (membentuk populasi awal), lalu bulan-bulan berikutnya harus dihasilkan
/// aplikasi sendiri dari laporan lapangan, bukan dari berkas Aurora.
///
///   SEED_PERIODE=jan          pnpm db:seed
///   SEED_PERIODE=jan,feb      pnpm db:seed
///
/// Tanpa variabel ini seluruh periode dibaca, seperti sebelumnya. Nama
/// folder yang tidak dikenal MELEDAK, bukan diabaikan diam-diam — salah
/// ketik di sini akan menghasilkan database yang sunyi-sunyi tidak lengkap.
function pilihPeriode(): readonly Periode[] {
  const raw = process.env.SEED_PERIODE?.trim()
  if (!raw) return SEMUA_PERIODE
  const diminta = raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s !== "")
  const dikenal = new Set(SEMUA_PERIODE.map((p) => p.folder))
  const asing = diminta.filter((f) => !dikenal.has(f as Periode["folder"]))
  if (asing.length > 0) {
    throw new Error(
      `SEED_PERIODE memuat folder yang tidak dikenal: ${asing.join(", ")}. Pilihannya: ${[...dikenal].join(", ")}`
    )
  }
  // Filter atas SEMUA_PERIODE, bukan map atas input -> urutan kronologis
  // tetap terjaga berapa pun urutan pengetikannya.
  return SEMUA_PERIODE.filter((p) => diminta.includes(p.folder))
}

export const PERIODE_TERSEDIA: readonly Periode[] = pilihPeriode()

function bacaOpsional<T>(folder: string, nama: string): T[] {
  const jalur = join(DATA_DIR, folder, nama)
  if (!existsSync(jalur)) return []
  return urai<T>(readFileSync(jalur, "utf-8"))
}

export function readProgresCaterPeriode(folder: string): ProgresCaterRow[] {
  return bacaOpsional<ProgresCaterRow>(folder, "ProgresCater-PW5.csv")
}

/// `lapdatametertes.csv` — DAFTAR CATAT periode itu (lihat penjelasan peran
/// di atas). Hanya kolom yang benar-benar dipakai yang diketikkan; berkasnya
/// punya 25 kolom, tetapi mengetikkan semuanya berarti memelihara daftar
/// yang tidak pernah dibaca.
///
/// Nama kolomnya memang begini apa adanya di sumber — berspasi, berbeda
/// gaya kapital, dan `No Pel` berawalan karakter tab. Normalisasinya
/// dikerjakan pemakai lewat normalizeNolg(), bukan dengan menyunting berkas
/// (lihat prisma/docs/README.md, "Filosofi ETL").
export interface LapDataMeterRow {
  "No Pel": string
  Nama: string
  Alamat: string
  Periode: string
  "St AWAL": string
  "St Akhir": string
  Pakai: string
  /// Pemakaian bulan lalu — bukan salah ketik, kolomnya memang bernama
  /// "Pakai Lau" (tanpa "l") di berkas sumber.
  "Pakai Lau": string
  Kd_kel: string
  Nm_Kel: string
  Rute: string
  "Nama Petugas": string
  tgl_catat: string
}

export function readLapDataMeterPeriode(folder: string): LapDataMeterRow[] {
  return bacaOpsional<LapDataMeterRow>(folder, "lapdatametertes.csv")
}

/// Gabungan periode yang DIPILIH (menghormati SEED_PERIODE).
export function readProgresCaterSemua(): ProgresCaterRow[] {
  return PERIODE_TERSEDIA.flatMap((p) => readProgresCaterPeriode(p.folder))
}

/// Gabungan SELURUH periode yang berkasnya ada — SENGAJA mengabaikan
/// SEED_PERIODE.
///
/// Dipakai khusus untuk menurunkan TARIF. Blok tarif bukan data periode,
/// melainkan data referensi yang kebetulan harus dipecahkan dari observasi:
/// makin banyak titik (pemakaian -> harga), makin lengkap blok yang bisa
/// dipastikan. Dengan Januari saja, golongan 2A1 hanya punya 6 observasi
/// yang semuanya di atas 30 m3 — blok 1-3 tak terpecahkan, dan blok 4 ikut
/// gugur karena ia butuh alas dari blok di bawahnya. Enam periode memberi
/// 24 titik dan keempat bloknya terpecahkan.
///
/// Ini BUKAN mengimpor data periode lain: tidak satu pun baris pelanggan,
/// pembacaan, atau tagihan dari periode di luar jendela yang masuk database.
/// Yang diambil hanya pasangan angka untuk memecahkan harga per blok.
export function readProgresCaterSemuaPeriodeUntukTarif(): ProgresCaterRow[] {
  return SEMUA_PERIODE.flatMap((p) => readProgresCaterPeriode(p.folder))
}

/// Kompatibilitas step lama: dulu hanya ada SATU berkas di akar data/.
/// Sekarang mengembalikan gabungan semua periode supaya step referensi
/// tidak kehilangan wilayah/rute/pencatat yang cuma muncul di bulan
/// tertentu.
export function readProgresCater(): ProgresCaterRow[] {
  return readProgresCaterSemua()
}
