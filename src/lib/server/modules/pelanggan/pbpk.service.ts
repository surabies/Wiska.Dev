// server/modules/pelanggan/pbpk.service.ts — IMPOR PBPK (Pasang Baru /
// Pasang Kembali) sebagai fitur aplikasi, bukan skrip seed.
//
// PBPK adalah pintu masuk sambungan baru ke siklus penagihan. Perilakunya
// terbukti konsisten di enam periode (lihat prisma/PEMETAAN-DATA.md bagian 8):
//
//   - PBPK bulan N SELALU sudah ada di daftar kerja bulan N (26/26, 8/8,
//     5/5, 11/11 pada empat transisi yang bisa diuji), dengan stand awal 0,
//     stand akhir 0, pakai 0, dan BELUM berpetugas;
//   - dan MASUK(N→N+1) = PBPK(N) secara persis — bulan berikutnyalah mereka
//     pertama kali menghasilkan tagihan.
//
// Karena itu impor ini melakukan dua hal sekaligus: membuat baris Pelanggan
// (+ Meter), DAN memasukkannya ke Daftar Catat periode berjalan dengan
// status TIDAK_TERCATAT — "sudah terdaftar, belum menghasilkan pembacaan".
// Tanpa langkah kedua, sambungan baru tidak akan muncul di beban kerja
// siapa pun.
//
// DUA HAL YANG DIJAGA:
//
// 1. **Tidak menimpa pelanggan yang sudah ada.** PBPK membawa data yang
//    lebih minim daripada ProgresCater; menimpanya akan MENGURANGI kualitas
//    data. Nomor yang sudah ada dilaporkan sebagai "sudah ada", bukan
//    diperbarui. Sikap ini disalin dari seed step 05.
//
// 2. **Periode diminta eksplisit, tidak ditebak dari nama berkas.** Berkas
//    nyata bernama macam-macam ("PBPK.csv", "PBPK202605-PW5.csv",
//    "PBPK202606-PW5.xlsx") dan isinya TIDAK punya kolom periode. Menebak
//    dari nama berkas berarti satu penggantian nama diam-diam memasukkan
//    sambungan ke bulan yang salah.

import type { Prisma, UkuranMeter } from "@db"
import { prisma } from "@db"
import * as XLSX from "xlsx"
import { BadRequestError } from "../../lib/errors"
import { recordAudit } from "../../lib/audit"

const MAKS_CONTOH = 20

/// Kolom yang benar-benar dipakai. Berkas PBPK punya 24 kolom; sisanya
/// (updater, sta_aktif, wilayah, kode_wilayah, mutasian, tglaktif) tidak
/// dipetakan di sini — tglaktif khususnya TIDAK boleh jadi tanggal mutasi,
/// lihat catatan `getPbpkPeriode` di seed.
const KOLOM_WAJIB = ["nolg", "nama", "alamat", "kd_rute"] as const

/// Kode `kd_ukmeter` -> enum UkuranMeter. Sama persis dengan tabel bea beban
/// di prisma/PEMETAAN-DATA.md bagian 2 (A=½", C=1", D=1½", E=2", F=3", G=4"),
/// yang mencakup 100% ukuran meter yang benar-benar muncul di data.
/// Kode `B` (¾") TIDAK dipetakan: enum UkuranMeter tidak punya nilainya dan
/// data belum pernah memakainya — kalau muncul, barisnya dilaporkan sebagai
/// tak dikenal, bukan diam-diam dijadikan ½".
const UKURAN_METER: Record<string, UkuranMeter> = {
  A: "INCH_HALF",
  C: "INCH_1",
  D: "INCH_1_HALF",
  E: "INCH_2",
  F: "INCH_3",
  G: "INCH_4",
}

const GOLONGAN_SAH = new Set([
  "GOL_1A",
  "GOL_1B",
  "GOL_2A1",
  "GOL_2A2",
  "GOL_2A3",
  "GOL_2A4",
  "GOL_2A5",
  "GOL_2B",
  "GOL_3A",
  "GOL_3B",
  "GOL_3C",
  "GOL_4A",
  "GOL_4B",
])

function rtRw(raw: string): string | null {
  const t = raw.trim()
  if (t === "") return null
  return /^\d{1,3}$/.test(t) ? t.padStart(3, "0") : t.slice(0, 3)
}

export interface BarisPbpk {
  nomorLangganan: string
  nomorPersil: string
  nama: string
  alamat: string
  rt: string | null
  rw: string | null
  notelp: string | null
  jumlahPenghuni: number | null
  nomorMeter: string | null
  merkKode: string | null
  ukuran: UkuranMeter | null
  kodeGolongan: string | null
  kodeRute: string
  noUrutRute: number | null
  /// PB = Pasang Baru (sambungan yang benar-benar baru), PK = Pasang Kembali
  /// (pelanggan lama yang menyambung ulang). Bedanya nyata di lapangan:
  /// baris PK lazimnya membawa kode rute LAMANYA, sedangkan PB ber-kd_rute
  /// palsu "99999" karena belum pernah dikunjungi siapa pun.
  mutasian: string | null
  geoLat: number | null
  geoLong: number | null
}

/// Menerima CSV (`;`) maupun XLSX. Berkas April & Juni disimpan sebagai
/// .xlsx sementara bulan lain .csv — menerima keduanya menghindari operator
/// harus mengonversi berkas resmi secara manual (dan salah konversi).
export function uraiPbpk(berkas: {
  nama: string
  teks?: string
  buffer?: ArrayBuffer
}): { baris: BarisPbpk[]; galat: string[] } {
  let rekaman: Record<string, string>[]

  if (
    berkas.nama.toLowerCase().endsWith(".xlsx") ||
    berkas.nama.toLowerCase().endsWith(".xls")
  ) {
    if (!berkas.buffer) throw new BadRequestError("Berkas Excel tidak terbaca.")
    const wb = XLSX.read(berkas.buffer, { type: "array" })
    const namaSheet = wb.SheetNames[0]
    const sheet = namaSheet ? wb.Sheets[namaSheet] : undefined
    if (!sheet)
      throw new BadRequestError(
        "Berkas Excel tidak punya sheet yang bisa dibaca.",
      )
    rekaman = XLSX.utils
      .sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
      .map((r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [
            k.trim().toLowerCase(),
            String(v ?? "").trim(),
          ]),
        ),
      )
  } else {
    if (!berkas.teks) throw new BadRequestError("Berkas CSV tidak terbaca.")
    const lines = berkas.teks.split(/\r?\n/).filter((l) => l.trim() !== "")
    const header = (lines[0] ?? "")
      .split(";")
      .map((h) => h.trim().toLowerCase())
    rekaman = lines.slice(1).map((l) => {
      const k = l.split(";")
      return Object.fromEntries(header.map((h, i) => [h, (k[i] ?? "").trim()]))
    })
  }

  if (rekaman.length === 0) throw new BadRequestError("Berkas PBPK kosong.")
  const kolomAda = Object.keys(rekaman[0] ?? {})
  const hilang = KOLOM_WAJIB.filter((k) => !kolomAda.includes(k))
  if (hilang.length > 0) {
    throw new BadRequestError(
      `Berkas ini bukan PBPK — kolom yang hilang: ${hilang.join(", ")}. Kolom terbaca: ${kolomAda.join(", ")}`,
    )
  }

  const galat: string[] = []
  const baris: BarisPbpk[] = []
  const terlihat = new Set<string>()

  rekaman.forEach((r, i) => {
    const ambil = (k: string) => (r[k] ?? "").trim()
    const nolg = ambil("nolg")
    if (!nolg) return
    const nomorLangganan = nolg.toUpperCase().padStart(11, "0")
    if (nomorLangganan.length > 11) {
      galat.push(
        `baris ${i + 2}: nomor langganan "${nolg}" lebih dari 11 karakter`,
      )
      return
    }
    if (terlihat.has(nomorLangganan)) {
      galat.push(`baris ${i + 2}: ${nomorLangganan} muncul lebih dari sekali`)
      return
    }
    terlihat.add(nomorLangganan)

    const nama = ambil("nama")
    const alamat = ambil("alamat")
    if (!nama || !alamat) {
      galat.push(`${nomorLangganan}: nama atau alamat kosong — baris dilewati`)
      return
    }

    const gol = ambil("kd_goltarif").replace(/\./g, "").toUpperCase()
    const kodeGolongan =
      gol && GOLONGAN_SAH.has(`GOL_${gol}`) ? `GOL_${gol}` : null
    if (gol && !kodeGolongan)
      galat.push(`${nomorLangganan}: golongan tarif "${gol}" tidak dikenal`)

    const uk = ambil("kd_ukmeter").toUpperCase()
    const ukuran = uk ? (UKURAN_METER[uk] ?? null) : null
    if (uk && !ukuran)
      galat.push(`${nomorLangganan}: ukuran meter "${uk}" tidak dikenal`)

    const lat = Number(ambil("goe_lat"))
    const long = Number(ambil("geo_long"))
    const urut = Number(ambil("no_urutrute"))
    const huni = Number(ambil("jmlpenghuni"))

    baris.push({
      nomorLangganan,
      nomorPersil: ambil("nolangganan") || nomorLangganan,
      nama,
      alamat,
      rt: rtRw(ambil("rt")),
      rw: rtRw(ambil("rw")),
      notelp: ambil("notelp") || null,
      jumlahPenghuni:
        Number.isFinite(huni) && huni > 0 ? Math.trunc(huni) : null,
      nomorMeter: ambil("nometer") || null,
      merkKode: ambil("kd_merkmeter").toUpperCase() || null,
      ukuran,
      kodeGolongan,
      kodeRute: ambil("kd_rute"),
      noUrutRute: Number.isFinite(urut) ? Math.trunc(urut) : null,
      mutasian: ambil("mutasian").toUpperCase() || null,
      geoLat: Number.isFinite(lat) && ambil("goe_lat") !== "" ? lat : null,
      geoLong: Number.isFinite(long) && ambil("geo_long") !== "" ? long : null,
    })
  })

  if (baris.length === 0)
    throw new BadRequestError(
      "Tidak ada baris PBPK yang bisa dibaca dari berkas.",
    )
  return { baris, galat }
}

export interface BarisPratinjau {
  nomorLangganan: string
  nama: string
  alamat: string
  rt: string | null
  rw: string | null
  kodeRute: string
  /// null = kode rutenya tidak dikenali data induk (mis. "99999", atau rute
  /// lama yang sudah digabung ke rute lain).
  ruteDikenal: boolean
  noUrutRute: number | null
  kodeGolongan: string | null
  golonganDikenal: boolean
  nomorMeter: string | null
  mutasian: string | null
  status: "BARU" | "SUDAH_ADA" | "METER_MENYUSUL"
}

export interface HasilPbpk {
  diterapkan: boolean
  periode: number
  ringkas: {
    totalBaris: number
    akanDibuat: number
    sudahAda: number
    tanpaRute: number
    tanpaGolongan: number
    sudahDiDaftarCatat: number
    /// Sudah punya baris pelanggan tapi belum punya meter aktif — meternya
    /// dibuatkan dari berkas ini supaya mereka bisa ditagih.
    meterMenyusul: number
  }
  contoh: {
    nomorLangganan: string
    jenis: "BARU" | "SUDAH_ADA" | "TANPA_RUTE" | "METER_MENYUSUL"
    keterangan: string
  }[]
  /// SELURUH baris berkas beserta nasibnya, untuk ditampilkan sebagai tabel
  /// pratinjau. `contoh` di atas tetap ada untuk ringkasan singkat; yang ini
  /// yang dibaca layar. Berkas PBPK berisi puluhan baris, bukan puluhan
  /// ribu — mengirim semuanya jauh lebih murah daripada memaksa operator
  /// menebak dari 20 contoh.
  baris: BarisPratinjau[]
  galat: string[]
  ditulis: {
    pelangganDibuat: number
    meterDibuat: number
    daftarCatatDibuat: number
  }
}

export interface ImporPbpkInput {
  berkas: { nama: string; teks?: string; buffer?: ArrayBuffer }
  periode: number
  terapkan: boolean
  olehUserId: string
  jejak?: { ipAddress?: string | null; userAgent?: string | null }
}

export async function imporPbpk(input: ImporPbpkInput): Promise<HasilPbpk> {
  const { baris, galat } = uraiPbpk(input.berkas)

  const [pelangganAda, ruteRows, golonganRows, dcAda, penugasan] =
    await Promise.all([
      prisma.pelanggan.findMany({
        where: { nomorLangganan: { in: baris.map((b) => b.nomorLangganan) } },
        // `_count.meter` ikut dibaca: pelanggan yang sudah ada TAPI belum punya
        // meter aktif tidak bisa ditagih sama sekali, dan berkas PBPK justru
        // membawa nomor meternya. Melewatkan mereka bulat-bulat (seperti versi
        // pertama) meninggalkan sambungan yang mustahil ditagih — persis 11
        // baris PBPK Mei yang ditemukan pemeriksaan kesehatan data.
        select: {
          id: true,
          nomorLangganan: true,
          _count: { select: { meter: { where: { isAktif: true } } } },
        },
      }),
      prisma.rute.findMany({ select: { id: true, kode: true } }),
      prisma.tarifGolongan.findMany({ select: { id: true, kode: true } }),
      prisma.daftarCatat.findMany({
        where: { periode: input.periode },
        select: { pelangganId: true },
      }),
      // Penugasan rute -> pencatat. Baris daftar catat WAJIB langsung
      // berpetugas kalau rutenya memang sudah punya: tanpa itu sambungan baru
      // lahir langsung sebagai temuan "daftar catat tanpa pencatat" dan harus
      // dibereskan menyusul lewat perbaikan otomatis — pekerjaan yang tidak
      // perlu ada kalau diisi sejak awal.
      prisma.penugasanRute.findMany({
        select: { ruteId: true, pencatatId: true, urutan: true },
        orderBy: [{ urutan: "asc" }, { pencatatId: "asc" }],
      }),
    ])

  const adaPer = new Map(pelangganAda.map((p) => [p.nomorLangganan, p]))
  const ruteId = new Map(
    ruteRows.map((r) => [r.kode.trim().toUpperCase(), r.id]),
  )
  const golonganId = new Map(
    golonganRows.map((g) => [g.kode.trim().toUpperCase(), g.id]),
  )
  const dcPelanggan = new Set(dcAda.map((d) => d.pelangganId))
  const pencatatPerRute = new Map<string, string>()
  for (const p of penugasan)
    if (!pencatatPerRute.has(p.ruteId))
      pencatatPerRute.set(p.ruteId, p.pencatatId)

  const contoh: HasilPbpk["contoh"] = []
  const tambah = (c: HasilPbpk["contoh"][number]) => {
    if (contoh.length < MAKS_CONTOH) contoh.push(c)
  }

  const baru: (BarisPbpk & {
    ruteId: string | null
    golonganId: string | null
  })[] = []
  const meterMenyusul: { pelangganId: string; baris: BarisPbpk }[] = []
  let sudahAda = 0
  let tanpaRute = 0
  let tanpaGolongan = 0
  let sudahDiDaftarCatat = 0
  const pratinjau: BarisPratinjau[] = []
  const catat = (
    b: BarisPbpk,
    status: BarisPratinjau["status"],
    rId: string | null,
    gId: string | null,
  ) =>
    pratinjau.push({
      nomorLangganan: b.nomorLangganan,
      nama: b.nama,
      alamat: b.alamat,
      rt: b.rt,
      rw: b.rw,
      kodeRute: b.kodeRute,
      ruteDikenal: rId !== null,
      noUrutRute: b.noUrutRute,
      kodeGolongan: b.kodeGolongan,
      golonganDikenal: gId !== null,
      nomorMeter: b.nomorMeter,
      mutasian: b.mutasian,
      status,
    })

  for (const b of baris) {
    const ada = adaPer.get(b.nomorLangganan)
    if (ada) {
      sudahAda++
      if (dcPelanggan.has(ada.id)) sudahDiDaftarCatat++
      if (ada._count.meter === 0 && b.nomorMeter) {
        meterMenyusul.push({ pelangganId: ada.id, baris: b })
        tambah({
          nomorLangganan: b.nomorLangganan,
          jenis: "METER_MENYUSUL",
          keterangan: `sudah ada tapi belum punya meter aktif — meter ${b.nomorMeter} akan dibuatkan`,
        })
      } else {
        tambah({
          nomorLangganan: b.nomorLangganan,
          jenis: "SUDAH_ADA",
          keterangan: "sudah ada di data pelanggan — tidak ditimpa",
        })
      }
      catat(
        b,
        ada._count.meter === 0 && b.nomorMeter ? "METER_MENYUSUL" : "SUDAH_ADA",
        ruteId.get(b.kodeRute.trim().toUpperCase()) ?? null,
        b.kodeGolongan ? (golonganId.get(b.kodeGolongan) ?? null) : null,
      )
      continue
    }
    const rId = ruteId.get(b.kodeRute.trim().toUpperCase()) ?? null
    const gId = b.kodeGolongan ? (golonganId.get(b.kodeGolongan) ?? null) : null
    if (!rId) {
      tanpaRute++
      tambah({
        nomorLangganan: b.nomorLangganan,
        jenis: "TANPA_RUTE",
        keterangan: `rute "${b.kodeRute}" tidak ada di data induk — pelanggan tetap dibuat, tapi belum masuk beban kerja`,
      })
    }
    if (!gId) tanpaGolongan++
    baru.push({ ...b, ruteId: rId, golonganId: gId })
    catat(b, "BARU", rId, gId)
    if (contoh.length < MAKS_CONTOH && rId) {
      tambah({
        nomorLangganan: b.nomorLangganan,
        jenis: "BARU",
        keterangan: `${b.nama} — rute ${b.kodeRute}`,
      })
    }
  }

  const ringkas = {
    totalBaris: baris.length,
    akanDibuat: baru.length,
    sudahAda,
    tanpaRute,
    tanpaGolongan,
    sudahDiDaftarCatat,
    meterMenyusul: meterMenyusul.length,
  }

  if (!input.terapkan) {
    return {
      diterapkan: false,
      periode: input.periode,
      ringkas,
      contoh,
      baris: pratinjau,
      galat,
      ditulis: { pelangganDibuat: 0, meterDibuat: 0, daftarCatatDibuat: 0 },
    }
  }

  // ── Penerapan ──
  let pelangganDibuat = 0
  let meterDibuat = 0

  // Meter menyusul untuk pelanggan yang SUDAH ada — dikerjakan lebih dulu
  // karena tidak bergantung pada apa pun di bawahnya.
  for (const m of meterMenyusul) {
    try {
      await prisma.meter.create({
        data: {
          pelangganId: m.pelangganId,
          nomorMeter: m.baris.nomorMeter!,
          merkKode: m.baris.merkKode,
          ukuran: m.baris.ukuran ?? "INCH_HALF",
          isAktif: true,
        },
      })
      meterDibuat++
    } catch (err) {
      galat.push(
        `${m.baris.nomorLangganan}: gagal membuat meter — ${(err as Error).message}`,
      )
    }
  }
  let daftarCatatDibuat = 0

  for (const b of baru) {
    // Satu transaksi per sambungan: Pelanggan + Meter + baris Daftar Catat
    // harus lahir bersama. Sambungan yang punya baris pelanggan tapi tidak
    // punya meter tidak bisa ditagih, dan yang tidak masuk daftar catat
    // tidak akan pernah dikunjungi.
    try {
      await prisma.$transaction(async (tx) => {
        const data: Prisma.PelangganUncheckedCreateInput = {
          nomorLangganan: b.nomorLangganan,
          nomorPersil: b.nomorPersil,
          nama: b.nama,
          alamat: b.alamat,
          status: "AKTIF",
          rt: b.rt,
          rw: b.rw,
          notelp: b.notelp,
          jumlahPenghuni: b.jumlahPenghuni,
          tarifGolonganId: b.golonganId,
          ruteId: b.ruteId,
          noUrutRute: b.noUrutRute,
          geoLat: b.geoLat,
          geoLong: b.geoLong,
        }
        const p = await tx.pelanggan.create({ data })
        pelangganDibuat++

        if (b.nomorMeter) {
          await tx.meter.create({
            data: {
              pelangganId: p.id,
              nomorMeter: b.nomorMeter,
              merkKode: b.merkKode,
              ukuran: b.ukuran ?? "INCH_HALF",
              isAktif: true,
            },
          })
          meterDibuat++
        }

        // TIDAK_TERCATAT, bukan BELUM_DICATAT: sambungan ini memang sudah
        // terdaftar bulan ini tetapi belum menghasilkan pembacaan — persis
        // bentuk 11 baris PBPK Mei di data nyata.
        await tx.daftarCatat.create({
          data: {
            periode: input.periode,
            pelangganId: p.id,
            ruteId: b.ruteId,
            pencatatId: b.ruteId
              ? (pencatatPerRute.get(b.ruteId) ?? null)
              : null,
            urutan: b.noUrutRute ?? 0,
            sumber: "PBPK",
            status: "TIDAK_TERCATAT",
          },
        })
        daftarCatatDibuat++
      })
    } catch (err) {
      galat.push(
        `${b.nomorLangganan}: gagal disimpan — ${(err as Error).message}`,
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      userId: input.olehUserId,
      aksi: "IMPOR_PBPK",
      entitas: "Pelanggan",
      entitasId: String(input.periode),
      perubahan: {
        periode: input.periode,
        ...ringkas,
        pelangganDibuat,
        meterDibuat,
        daftarCatatDibuat,
      },
      ipAddress: input.jejak?.ipAddress ?? null,
      userAgent: input.jejak?.userAgent ?? null,
    })
  })

  return {
    diterapkan: true,
    periode: input.periode,
    ringkas,
    contoh,
    baris: pratinjau,
    galat,
    ditulis: { pelangganDibuat, meterDibuat, daftarCatatDibuat },
  }
}
