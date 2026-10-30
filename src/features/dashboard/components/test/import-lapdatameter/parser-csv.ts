// features/dashboard/components/impor/parser-csv.ts — pengurai berkas sumber
// (CSV maupun Excel) di SISI BROWSER, plus pemetaan kolom tiap jenis berkas.
//
// KENAPA DIURAI DI BROWSER, BUKAN DIKIRIM MENTAH KE SERVER. Berkas nyata
// 4-10 MB berisi ~22.500 baris. Mengunggahnya utuh berarti pengguna menunggu
// tanpa kabar, satu timeout menghanguskan semuanya, dan kesalahan format baru
// ketahuan setelah seluruh berkas terkirim. Diurai di sini, pengguna langsung
// melihat "22.590 baris, periode 202601, kolom cocok" SEBELUM satu byte pun
// dikirim — dan pengirimannya bisa dipotong jadi batch yang aman.

import * as XLSX from "xlsx"

/// Pemisah kolom TIDAK BOLEH dipatok mati — berkas yang sama bisa datang
/// dengan "," maupun ";".
///
/// `lapdatametertes.csv` asli dari Aurora memakai ",". Berkas jan–mei di
/// `prisma/data/` memakai ";" karena PERNAH DIKONVERSI MANUAL, bukan karena
/// Aurora berubah format. Deteksi otomatis ini membuat konversi manual itu
/// tidak perlu lagi — dan itu penting, karena menyunting berkas mentah
/// menghapus jejak audit "data asli dari sistem lama itu apa"
/// (lihat prisma/README.md, "Filosofi ETL").
///
/// Kutip ganda tetap dihormati karena alamat kerap memuat pemisah di
/// dalam kutip.
type Pemisah = ";" | ","

/// Disimpulkan dari BARIS HEADER — satu-satunya baris yang dijamin tidak
/// memuat alamat berkoma di dalam kutip. Menebaknya dari baris data bisa
/// meleset pada berkas yang alamatnya penuh koma.
function deteksiPemisah(header: string): Pemisah {
  return header.split(";").length > header.split(",").length ? ";" : ","
}

function uraiBaris(baris: string, pemisah: Pemisah): string[] {
  const keluar: string[] = []
  let isi = ""
  let dalamKutip = false
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i]
    if (dalamKutip) {
      if (c === '"') {
        if (baris[i + 1] === '"') { isi += '"'; i++ } else dalamKutip = false
      } else isi += c
      continue
    }
    if (c === '"') dalamKutip = true
    else if (c === pemisah) { keluar.push(isi); isi = "" }
    else isi += c
  }
  keluar.push(isi)
  return keluar
}

export interface TabelCsv {
  header: string[]
  /// Baris data; index 0 = baris ke-2 di berkas (baris 1 adalah header).
  baris: string[][]
}

/// Berkas .xlsx/.xls dibaca jadi TabelCsv yang sama persis, supaya seluruh
/// pemetaan kolom di bawah tidak perlu tahu berkasnya datang dalam bentuk apa.
///
/// KENAPA PERLU: berkas resmi tidak selalu CSV. PBPK saja sudah datang
/// berselang-seling (.csv untuk sebagian bulan, .xlsx untuk bulan lain) —
/// karena itu impor PBPK sudah menerima keduanya sejak awal. Memaksa operator
/// mengonversi r-nomor/lapdatameter ke CSV lebih dulu bukan cuma merepotkan:
/// "Save as CSV" di Excel diam-diam memotong nol di depan nomor langganan dan
/// mengubah tata tanggal, dan kerusakannya baru ketahuan setelah data masuk.
///
/// `raw: false` -> sel dibaca sebagai teks SEPERTI YANG TERLIHAT di Excel,
/// bukan angka serial mentah. Tanpa itu, tanggal berubah jadi bilangan
/// (mis. 46234) dan nomor langganan kehilangan nol di depannya.
export function uraiExcel(buffer: ArrayBuffer): TabelCsv {
  const wb = XLSX.read(buffer, { type: "array" })
  const namaSheet = wb.SheetNames[0]
  const sheet = namaSheet ? wb.Sheets[namaSheet] : undefined
  if (!sheet) throw new Error("Berkas Excel tidak punya sheet yang bisa dibaca.")

  const matriks = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  })
  const garis = matriks.map((baris) => baris.map((sel) => String(sel ?? "").trim()))
  const isi = garis.filter((baris) => baris.some((sel) => sel !== ""))
  if (isi.length < 2) throw new Error("Berkas kosong atau hanya berisi baris header.")

  return { header: isi[0]!, baris: isi.slice(1) }
}

export function uraiCsv(teks: string): TabelCsv {
  // BOM UTF-8 dibuang: tanpa ini nama kolom pertama jadi "<BOM>No Pel" dan
  // seluruh pemetaan gagal dengan pesan yang membingungkan.
  //
  // Ditulis \uFEFF, BUKAN karakter BOM harfiah. Keduanya identik bagi mesin,
  // tapi yang harfiah tak kasat mata di editor maupun diff — gampang
  // terhapus tanpa sadar saat menyunting baris ini, dan impor CSV rusak.
  const bersih = teks.replace(/^\uFEFF/, "")
  const garis = bersih.split(/\r?\n/).filter((g) => g.trim() !== "")
  if (garis.length < 2) throw new Error("Berkas kosong atau hanya berisi baris header.")
  const pemisah = deteksiPemisah(garis[0]!)
  const header = uraiBaris(garis[0]!, pemisah).map((h) => h.trim())
  const baris = garis.slice(1).map((g) => uraiBaris(g, pemisah))
  return { header, baris }
}

const keAngka = (v: string | undefined): number | null => {
  const t = (v ?? "").trim().replace(/\./g, "").replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/// Nomor langganan: HURUF DIPERTAHANKAN.
///
/// Versi pertama memakai `replace(/\D/g, "")` — membuang semua non-digit.
/// Itu bukan sekadar gagal mengenali, melainkan MEMELINTIR: "00A06100820"
/// berubah jadi "00006100820", nomor yang sah milik orang lain. Kebetulan
/// ketiga nomor berhuruf di data ini tidak punya kembaran, jadi barisnya
/// hanya terlewat. Kalau kembarannya ada, pembacaan satu pelanggan akan
/// tertulis ke rekening pelanggan lain tanpa satu pun peringatan.
///
/// Perilakunya kini sama persis dengan `normalizeNolg` di seed: huruf
/// dipertahankan, dan yang tidak sah dikembalikan `null` supaya barisnya
/// DITOLAK dengan alasan yang terbaca — bukan dipaksa jadi nomor lain.
function nolg(v: string | undefined): string | null {
  const t = (v ?? "").trim().toUpperCase()
  if (t === "") return null
  if (!/^[0-9A-Z]+$/.test(t)) return null
  if (t.length > 11) return null
  return t.padStart(11, "0")
}

// ── Pencatatan harian (lapdatametertes.csv) ──────────────────────────────
export interface BarisPencatatan {
  baris: number
  nomorLangganan: string
  periode: number
  standAwal: number
  standAkhir: number
  /// Pemakaian APA ADANYA dari berkas — bukan dihitung ulang dari selisih
  /// stand. Angka ini sudah matang: ia hasil verifikasi berjenjang di
  /// Aurora, dan menghitungnya sendiri berarti menaksir ulang keputusan
  /// yang sudah diambil manusia.
  pemakaian?: number | null
  pemakaianLalu?: number | null
  /// Penyimpangan dari bulan lalu (%). DIAMBIL dari berkas, bukan dihitung
  /// ulang: inilah angka yang dipakai verifikator untuk menyaring anomali,
  /// dan menghitung sendiri berisiko berbeda dari yang dilihat petugas.
  persentase?: number | null
  kondisi?: string | null
  namaPetugas?: string | null
  tanggalCatat?: string | null
}

/// Kolom yang WAJIB ada. Nama "Kd_kel" memang menyesatkan — di lapdatameter
/// isinya KODE KONDISI CATAT, bukan kelurahan.
const KOLOM_PENCATATAN = ["No Pel", "Periode", "St AWAL", "St Akhir"] as const

export function petakanPencatatan(tabel: TabelCsv): {
  baris: BarisPencatatan[]
  ditolak: { baris: number; alasan: string }[]
  periode: number[]
} {
  const hilang = KOLOM_PENCATATAN.filter((k) => !tabel.header.includes(k))
  if (hilang.length > 0) {
    throw new Error(
      `Ini bukan berkas pencatatan harian — kolom yang hilang: ${hilang.join(", ")}. ` +
        `Kolom yang diharapkan: ${KOLOM_PENCATATAN.join("; ")}`,
    )
  }
  const idx = Object.fromEntries(tabel.header.map((h, i) => [h, i])) as Record<string, number>
  const ambil = (k: string[], kolom: string) => k[idx[kolom] ?? -1]

  const baris: BarisPencatatan[] = []
  const ditolak: { baris: number; alasan: string }[] = []
  const periode = new Set<number>()

  tabel.baris.forEach((k, i) => {
    const nomorBaris = i + 2 // +1 header, +1 karena manusia menghitung dari 1
    const nomorLangganan = nolg(ambil(k, "No Pel"))
    const p = keAngka(ambil(k, "Periode"))
    const awal = keAngka(ambil(k, "St AWAL"))
    const akhir = keAngka(ambil(k, "St Akhir"))

    if (nomorLangganan === null) {
      ditolak.push({
        baris: nomorBaris,
        alasan: `Nomor langganan tidak sah: ${JSON.stringify((ambil(k, "No Pel") ?? "").trim())}`,
      })
      return
    }
    if (p === null || p < 190001) { ditolak.push({ baris: nomorBaris, alasan: "Periode tidak terbaca" }); return }
    if (awal === null || akhir === null) {
      ditolak.push({ baris: nomorBaris, alasan: "Stand awal/akhir tidak terbaca" }); return
    }

    periode.add(p)
    baris.push({
      baris: nomorBaris,
      nomorLangganan,
      periode: p,
      standAwal: awal,
      standAkhir: akhir,
      pemakaian: keAngka(ambil(k, "Pakai")),
      pemakaianLalu: keAngka(ambil(k, "Pakai Lau")),
      persentase: keAngka(ambil(k, "persentase")),
      kondisi: (ambil(k, "Kd_kel") ?? "").trim() || null,
      namaPetugas: (ambil(k, "kd_petugas") ?? "").trim() || null,
      tanggalCatat: (ambil(k, "tgl_catat") ?? "").trim() || null,
    })
  })

  return { baris, ditolak, periode: [...periode].sort() }
}

// ── Pemutusan (r-nomor.csv) ──────────────────────────────────────────────
export interface BarisPemutusan {
  baris: number
  nomorLangganan: string
  periode: number
  jenis: string
  noSurat?: string | null
  tanggalTutup?: string | null
  tanggalCabut?: string | null
}

const KOLOM_PEMUTUSAN = ["periode", "jenis_pemutusan", "nomor_pelanggan"] as const

/// r-nomor menulis tanggal gaya AS (M/D/YY) — terverifikasi konsisten di
/// seluruh berkas. Dikonversi ke ISO di sini supaya server tidak perlu
/// menebak tata tanggal.
function tanggalUsKeIso(raw: string | undefined): string | null {
  const t = (raw ?? "").trim()
  // Sudah ISO (lazim bila berkasnya .xlsx dan selnya bertipe tanggal betul):
  // diterima apa adanya. Bentuk D/M/Y — yang muncul kalau Excel memformat
  // ulang menurut locale Indonesia — SENGAJA tidak ditebak: "7/3/26" bisa
  // berarti 7 Maret atau 3 Juli, dan menebaknya salah akan menggeser tanggal
  // pemutusan tanpa ada yang tahu. Yang tak terbaca dibiarkan kosong.
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  const bulan = Number(m[1]), hari = Number(m[2])
  let tahun = Number(m[3])
  if (tahun < 100) tahun += 2000
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return null
  return `${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`
}

export function petakanPemutusan(tabel: TabelCsv): {
  baris: BarisPemutusan[]
  ditolak: { baris: number; alasan: string }[]
  periode: number[]
} {
  const hilang = KOLOM_PEMUTUSAN.filter((k) => !tabel.header.includes(k))
  if (hilang.length > 0) {
    throw new Error(
      `Ini bukan berkas pemutusan (r-nomor) — kolom yang hilang: ${hilang.join(", ")}.`,
    )
  }
  const idx = Object.fromEntries(tabel.header.map((h, i) => [h, i])) as Record<string, number>
  const ambil = (k: string[], kolom: string) => k[idx[kolom] ?? -1]

  const baris: BarisPemutusan[] = []
  const ditolak: { baris: number; alasan: string }[] = []
  const periode = new Set<number>()

  tabel.baris.forEach((k, i) => {
    const nomorBaris = i + 2
    const nomorLangganan = nolg(ambil(k, "nomor_pelanggan"))
    const p = keAngka(ambil(k, "periode"))
    const jenis = (ambil(k, "jenis_pemutusan") ?? "").trim().toUpperCase()

    if (nomorLangganan === null) {
      ditolak.push({
        baris: nomorBaris,
        alasan: `Nomor pelanggan tidak sah: ${JSON.stringify((ambil(k, "nomor_pelanggan") ?? "").trim())}`,
      })
      return
    }
    if (p === null || p < 190001) { ditolak.push({ baris: nomorBaris, alasan: "Periode tidak terbaca" }); return }
    if (jenis === "") { ditolak.push({ baris: nomorBaris, alasan: "Jenis pemutusan kosong" }); return }

    periode.add(p)
    baris.push({
      baris: nomorBaris,
      nomorLangganan,
      periode: p,
      jenis,
      noSurat: (ambil(k, "no_surat") ?? "").trim() || null,
      tanggalTutup: tanggalUsKeIso(ambil(k, "tgl_tutup")),
      tanggalCabut: tanggalUsKeIso(ambil(k, "tgl_cabut")),
    })
  })

  return { baris, ditolak, periode: [...periode].sort() }
}
