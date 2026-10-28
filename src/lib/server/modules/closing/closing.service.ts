// server/modules/closing/closing.service.ts — CLOSING PERIODE: menerbitkan
// tagihan resmi satu periode sekaligus (DRD bulanan).
//
// INILAH LANGKAH YANG MEMBALIK ARAH ALIRAN DATA. Selama ini aplikasi
// MENGIMPOR hasil closing dari CSV Aurora (ProgresCater). Dengan modul ini,
// aplikasi yang MEMPRODUKSI closing: laporan lapangan → verifikasi V1→V2→V3
// → PembacaanMeter resmi → (di sini) Tagihan. ProgresCater menjadi keluaran,
// bukan masukan.
//
// TIGA HAL YANG DIJAGA KETAT DI FILE INI:
//
// 1. **Nominal tidak pernah datang dari client.** Semua dihitung ulang dari
//    TarifBlok + BiayaTetap yang berlaku pada periode ybs, memakai mesin
//    tunggal di @/lib/domain/tagihan — yang terbukti mereproduksi
//    22.516 dari 22.517 tagihan Mei 2026 (`pnpm db:verifikasi-tarif`).
//
// 2. **Tagihan yang sudah ada TIDAK PERNAH ditimpa.** Closing hanya
//    menerbitkan untuk pembacaan yang BELUM punya tagihan. Periode hasil
//    impor (yang tagihannya sudah lengkap) karena itu aman ditutup: tidak
//    ada satu pun baris berubah, hanya statusnya dikunci.
//
// 3. **Kesiapan diperiksa DULU, bukan ditemukan di tengah jalan.**
//    `pratinjauClosing` menjawab "kalau ditutup sekarang, apa yang terjadi"
//    tanpa menulis apa pun. Menutup periode yang setengah terverifikasi
//    berarti menagih sebagian pelanggan dan meninggalkan sisanya — dan itu
//    tidak bisa dibatalkan diam-diam setelah tagihan sampai ke warga.

import type { Prisma } from "@db"
import { prisma } from "@db"
import {
  hitungHargaAir,
  hitungTotalTagihan,
  type HargaBlok,
} from "@/lib/domain/tagihan"
import { BadRequestError, ConflictError } from "../../lib/errors"
import { recordAudit } from "../../lib/audit"
import { periodeToDate } from "../../lib/periode"

/// Berapa baris ditulis sekaligus. Tagihan diterbitkan lewat createMany
/// berkelompok — 22 ribu insert satu per satu ke Postgres terkelola makan
/// waktu berjam-jam (pelajaran dari skrip seed, lihat prisma/PEMETAAN-DATA.md).
const UKURAN_BATCH = 500

/// Berapa banyak nomor langganan dicantumkan sebagai contoh pada tiap
/// hambatan. Operator tidak bisa berbuat apa-apa dengan "8 pelanggan
/// dilewati" tanpa tahu SIAPA; sebaliknya melampirkan 22 ribu nomor akan
/// membuat respons pratinjau tak terpakai. Angka ini cukup untuk mulai
/// menelusuri, dan `jumlah` tetap melaporkan skala sebenarnya.
const MAKS_CONTOH_HAMBATAN = 20

export interface HambatanClosing {
  kode: string
  pesan: string
  jumlah: number
  /// Sebagian nomor langganan yang terkena — maksimal MAKS_CONTOH_HAMBATAN.
  /// Kosong hanya untuk hambatan yang tidak berbasis pelanggan.
  contoh: string[]
}

export interface PratinjauClosing {
  periode: number
  status: "BERJALAN" | "TERKUNCI" | "BELUM_ADA"
  /// Daftar catat (DPM) periode ini — dasar "berapa yang SEHARUSNYA ditagih".
  daftarCatat: { total: number; perStatus: Record<string, number> }
  /// Laporan lapangan yang belum tuntas verifikasinya.
  verifikasi: { total: number; selesaiV3: number; belumSelesai: number }
  /// Pembacaan resmi periode ini.
  pembacaan: { total: number; sudahDitagih: number; akanDitagih: number }
  /// Perkiraan hasil closing bila dijalankan sekarang.
  perkiraan: { jumlahSL: number; totalM3: number; totalTagihan: number }
  /// Hal yang membuat closing tidak disarankan / tidak mungkin.
  hambatan: HambatanClosing[]
  bisaDitutup: boolean
}

interface KonteksTarif {
  blokPerGolongan: Map<string, HargaBlok[]>
  beaBebanPerUkuran: Map<string, number>
  beaAdmin: number | null
  airKotor: number | null
}

/// Memuat SELURUH tarif yang berlaku pada periode ini sekali di awal.
/// Menghitung 22 ribu tagihan dengan query tarif per baris akan mengulang
/// pekerjaan yang sama ribuan kali untuk hasil yang identik.
async function muatTarif(periode: Date): Promise<KonteksTarif> {
  const [golongan, biaya] = await Promise.all([
    prisma.tarifGolongan.findMany({
      select: {
        id: true,
        blokTarif: {
          where: {
            berlakuMulai: { lte: periode },
            OR: [{ berlakuSampai: null }, { berlakuSampai: { gte: periode } }],
          },
          orderBy: [{ blok: "asc" }, { berlakuMulai: "desc" }],
        },
      },
    }),
    prisma.biayaTetap.findMany({
      where: {
        berlakuMulai: { lte: periode },
        OR: [{ berlakuSampai: null }, { berlakuSampai: { gte: periode } }],
      },
      orderBy: { berlakuMulai: "desc" },
    }),
  ])

  const blokPerGolongan = new Map<string, HargaBlok[]>()
  for (const g of golongan) {
    if (g.blokTarif.length === 0) continue
    blokPerGolongan.set(
      g.id,
      g.blokTarif.map((b) => ({
        blok: b.blok,
        batasAwalM3: b.batasAwalM3,
        batasAkhirM3: b.batasAkhirM3,
        hargaPerM3: b.hargaPerM3,
      })),
    )
  }

  const beaBebanPerUkuran = new Map<string, number>()
  let beaAdmin: number | null = null
  let airKotor: number | null = null
  for (const b of biaya) {
    if (b.jenis === "BEA_BEBAN" && b.ukuranMeter) {
      if (!beaBebanPerUkuran.has(b.ukuranMeter))
        beaBebanPerUkuran.set(b.ukuranMeter, b.nominal)
    } else if (b.jenis === "BEA_ADMIN" && beaAdmin === null)
      beaAdmin = b.nominal
    else if (b.jenis === "AIR_KOTOR" && airKotor === null) airKotor = b.nominal
  }

  return { blokPerGolongan, beaBebanPerUkuran, beaAdmin, airKotor }
}

export interface BarisSiapTagih {
  pembacaanId: string
  pelangganId: string
  nomorLangganan: string
  /// Golongan yang DIPAKAI untuk menghitung baris ini — dibekukan ke
  /// Tagihan.tarifGolonganId supaya tagihan bisa menjelaskan dasarnya
  /// sendiri di kemudian hari.
  tarifGolonganId: string
  pemakaianM3: number
  jmlHargaAir: number
  beaBeban: number
  beaAdmin: number
  airKotor: number
  totalTagihan: number
}

/// Menghitung tagihan untuk pembacaan periode ini. Murni membaca — tidak
/// menulis apa pun.
///
/// `sertakanYangSudahDitagih` dipakai oleh skrip verifikasi: dengan opsi itu
/// fungsi ini menghitung ulang SEMUA pembacaan, termasuk yang tagihannya
/// sudah ada, sehingga hasilnya bisa dibandingkan dengan tagihan yang
/// benar-benar tersimpan. Itulah cara membuktikan mesin closing menghasilkan
/// angka yang sama dengan Aurora tanpa perlu menutup periode sungguhan.
export async function hitungBarisSiapTagih(
  periode: Date,
  periodeThbl: number,
  opsi?: { sertakanYangSudahDitagih?: boolean },
): Promise<{
  baris: BarisSiapTagih[]
  hambatan: HambatanClosing[]
  totalPembacaan: number
  sudahDitagih: number
}> {
  // DUA GOLONGAN YANG ADA DI DAFTAR CATAT TAPI TIDAK BOLEH DITAGIH.
  //
  // Keduanya punya pemakaian 0, jadi tanpa penjaga ini mereka tidak
  // menghasilkan tagihan bernilai nol — melainkan tagihan berisi bea beban +
  // bea admin + air kotor (±Rp 28.100) untuk air yang tidak pernah dipakai.
  // Di Aurora keduanya sama sekali TIDAK ADA di DRD, dan itu terverifikasi
  // pada tujuh periode berturut-turut.
  //
  //   DICABUT — dicabut PADA periode ini. Petugas tetap mengunjunginya
  //     (tetap beban kerja, karena itu tetap di daftar catat), tetapi
  //     sambungannya sudah putus. 19 sambungan/bulan pada data nyata.
  //
  //   PBPK periode pertama — sambungan baru dibuka dengan stand nol sebagai
  //     baris pembuka. Ia dicatat bulan ini, tetapi BARU ditagih bulan
  //     depan; itulah sebabnya MASUK(N→N+1) selalu tepat sama dengan
  //     PBPK(N). 5–26 sambungan/bulan pada data nyata.
  const takBolehDitagih = await prisma.daftarCatat.findMany({
    where: {
      periode: periodeThbl,
      OR: [{ status: "DICABUT" }, { sumber: "PBPK" }],
    },
    select: { pelangganId: true, status: true, sumber: true },
  })
  const dikecualikan = new Map<string, "DICABUT" | "PBPK">()
  for (const d of takBolehDitagih) {
    dikecualikan.set(d.pelangganId, d.status === "DICABUT" ? "DICABUT" : "PBPK")
  }

  const pembacaan = await prisma.pembacaanMeter.findMany({
    where: { periode },
    select: {
      id: true,
      pemakaianM3: true,
      // `tarifGolonganId` tagihan ikut dibaca: saat MENGHITUNG ULANG baris
      // yang sudah bertagihan (dipakai skrip verifikasi), golongan yang
      // benar adalah yang DIPAKAI dulu, bukan golongan pelanggan hari ini.
      // Tanpa ini, setiap pelanggan yang pernah pindah golongan akan
      // terlihat "meleset" padahal tagihannya benar.
      tagihan: { select: { id: true, tarifGolonganId: true } },
      meter: {
        select: {
          ukuran: true,
          pelanggan: {
            select: {
              id: true,
              nomorLangganan: true,
              tarifGolonganId: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  })

  const tarif = await muatTarif(periode)
  const baris: BarisSiapTagih[] = []
  let sudahDitagih = 0

  // Tiap hambatan mencatat jumlah DAN sebagian nomor langganannya. Menghitung
  // saja tidak cukup: "8 pelanggan tidak ditagih" tanpa nomor tidak bisa
  // ditindaklanjuti siapa pun, dan justru pelanggan yang dilewati inilah yang
  // paling perlu diperiksa manusia sebelum periode dikunci.
  const terkena = {
    tanpaGolongan: [] as string[],
    tanpaTarifBlok: [] as string[],
    tanpaBiayaTetap: [] as string[],
    pelangganDihapus: [] as string[],
    diLuarBlok: [] as string[],
    dicabut: [] as string[],
    pbpkBaru: [] as string[],
  }
  const jumlah = {
    tanpaGolongan: 0,
    tanpaTarifBlok: 0,
    tanpaBiayaTetap: 0,
    pelangganDihapus: 0,
    diLuarBlok: 0,
    dicabut: 0,
    pbpkBaru: 0,
  }
  const catat = (kunci: keyof typeof terkena, nomor: string) => {
    jumlah[kunci]++
    if (terkena[kunci].length < MAKS_CONTOH_HAMBATAN) terkena[kunci].push(nomor)
  }

  for (const p of pembacaan) {
    if (p.tagihan) {
      sudahDitagih++
      if (!opsi?.sertakanYangSudahDitagih) continue
    }
    const pelanggan = p.meter.pelanggan
    if (pelanggan.deletedAt) {
      catat("pelangganDihapus", pelanggan.nomorLangganan)
      continue
    }
    // Dicek SEBELUM tarif: keduanya bukan kegagalan menghitung, melainkan
    // keputusan bahwa barisnya memang tidak ditagihkan periode ini.
    const alasanKecuali = dikecualikan.get(pelanggan.id)
    if (alasanKecuali === "DICABUT") {
      catat("dicabut", pelanggan.nomorLangganan)
      continue
    }
    if (alasanKecuali === "PBPK") {
      catat("pbpkBaru", pelanggan.nomorLangganan)
      continue
    }
    // Golongan yang dibekukan di tagihan menang atas golongan berjalan —
    // lihat alasan di select di atas. Untuk penerbitan tagihan BARU
    // (tagihan masih null) yang berlaku tetap golongan berjalan.
    const golonganDipakai =
      p.tagihan?.tarifGolonganId ?? pelanggan.tarifGolonganId
    if (!golonganDipakai) {
      catat("tanpaGolongan", pelanggan.nomorLangganan)
      continue
    }
    const blok = tarif.blokPerGolongan.get(golonganDipakai)
    if (!blok) {
      catat("tanpaTarifBlok", pelanggan.nomorLangganan)
      continue
    }
    // Pemakaian yang melampaui blok tertinggi yang HARGANYA DIKETAHUI tidak
    // boleh ditagih. `hitungHargaAir` akan berhenti di blok terakhir yang
    // ada dan mengembalikan angka yang MASUK AKAL TAPI TERLALU KECIL —
    // pelanggan 4A dengan pemakaian 56 m3 ditagih seolah cuma memakai 20 m3.
    // Kekurangan data tarif harus menghasilkan penolakan yang terlihat,
    // bukan tagihan yang diam-diam salah. (Ditemukan oleh scripts/cek-closing.ts
    // — persis alasan skrip itu ada.)
    const batasTertinggi = blok.reduce(
      (maks, b) =>
        b.batasAkhirM3 === null
          ? Number.POSITIVE_INFINITY
          : Math.max(maks, b.batasAkhirM3),
      0,
    )
    if (p.pemakaianM3 > batasTertinggi) {
      catat("diLuarBlok", pelanggan.nomorLangganan)
      continue
    }
    const beaBeban = tarif.beaBebanPerUkuran.get(p.meter.ukuran)
    if (
      beaBeban === undefined ||
      tarif.beaAdmin === null ||
      tarif.airKotor === null
    ) {
      catat("tanpaBiayaTetap", pelanggan.nomorLangganan)
      continue
    }

    const jmlHargaAir = hitungHargaAir(p.pemakaianM3, blok)
    baris.push({
      pembacaanId: p.id,
      pelangganId: pelanggan.id,
      nomorLangganan: pelanggan.nomorLangganan,
      tarifGolonganId: golonganDipakai,
      pemakaianM3: p.pemakaianM3,
      jmlHargaAir,
      beaBeban,
      beaAdmin: tarif.beaAdmin,
      airKotor: tarif.airKotor,
      totalTagihan: hitungTotalTagihan({
        jmlHargaAir,
        beaBeban,
        beaAdmin: tarif.beaAdmin,
        airKotor: tarif.airKotor,
        lainLain: 0,
      }),
    })
  }

  const hambatan: HambatanClosing[] = []
  // Dua yang pertama BUKAN masalah — mereka hasil aturan yang benar, dan
  // dilaporkan justru supaya angkanya bisa dicocokkan operator.
  if (jumlah.dicabut > 0) {
    hambatan.push({
      kode: "DICABUT_TIDAK_DITAGIH",
      pesan:
        "Dicabut pada periode ini — tetap dikunjungi petugas (tetap di daftar catat) tetapi TIDAK diterbitkan tagihannya. Ini yang diharapkan, bukan masalah",
      jumlah: jumlah.dicabut,
      contoh: terkena.dicabut,
    })
  }
  if (jumlah.pbpkBaru > 0) {
    hambatan.push({
      kode: "PBPK_BELUM_DITAGIH",
      pesan:
        "Sambungan baru (PBPK) periode ini — dibuka dengan stand nol sebagai baris pembuka, jadi belum ditagih. Tagihan pertamanya terbit periode depan. Ini yang diharapkan, bukan masalah",
      jumlah: jumlah.pbpkBaru,
      contoh: terkena.pbpkBaru,
    })
  }
  if (jumlah.tanpaGolongan > 0) {
    hambatan.push({
      kode: "TANPA_GOLONGAN_TARIF",
      pesan:
        "Pelanggan belum punya golongan tarif — tagihannya tidak bisa dihitung",
      jumlah: jumlah.tanpaGolongan,
      contoh: terkena.tanpaGolongan,
    })
  }
  if (jumlah.tanpaTarifBlok > 0) {
    hambatan.push({
      kode: "TARIF_BLOK_KOSONG",
      pesan:
        "Golongan tarif pelanggan belum punya TarifBlok yang berlaku pada periode ini — isi dari SK tarif dulu",
      jumlah: jumlah.tanpaTarifBlok,
      contoh: terkena.tanpaTarifBlok,
    })
  }
  if (jumlah.diLuarBlok > 0) {
    hambatan.push({
      kode: "PEMAKAIAN_DI_LUAR_BLOK_TARIF",
      pesan:
        "Pemakaian melampaui blok tertinggi yang harganya diketahui — tagihannya TIDAK diterbitkan supaya tidak menagih terlalu murah. Lengkapi blok tarif dari SK dulu",
      jumlah: jumlah.diLuarBlok,
      contoh: terkena.diLuarBlok,
    })
  }
  if (jumlah.tanpaBiayaTetap > 0) {
    hambatan.push({
      kode: "BIAYA_TETAP_KOSONG",
      pesan:
        "Bea beban/admin/air kotor belum diatur untuk ukuran meter atau periode ini",
      jumlah: jumlah.tanpaBiayaTetap,
      contoh: terkena.tanpaBiayaTetap,
    })
  }
  if (jumlah.pelangganDihapus > 0) {
    hambatan.push({
      kode: "PELANGGAN_DIHAPUS",
      pesan:
        "Ada pembacaan milik pelanggan yang sudah dihapus — dilewati, tidak ditagih",
      jumlah: jumlah.pelangganDihapus,
      contoh: terkena.pelangganDihapus,
    })
  }

  return { baris, hambatan, totalPembacaan: pembacaan.length, sudahDitagih }
}

export async function pratinjauClosing(
  periodeThbl: number,
): Promise<PratinjauClosing> {
  const periode = periodeToDate(periodeThbl)

  const [row, dpm, laporanTotal, laporanSelesai, hasil] = await Promise.all([
    prisma.periodePenagihan.findUnique({ where: { periode: periodeThbl } }),
    prisma.daftarCatat.groupBy({
      by: ["status"],
      where: { periode: periodeThbl },
      _count: true,
    }),
    prisma.laporanHarianPetugas.count({ where: { periode: periodeThbl } }),
    // Tuntas = V3 terisi ATAU penanda final legacy (isVerified) terisi.
    // Baris hasil impor sistem lama hanya punya penanda legacy — memakai
    // verif3At saja membuat periode hasil impor terlihat 0% terverifikasi
    // padahal tagihannya justru sudah terbit semua.
    prisma.laporanHarianPetugas.count({
      where: {
        periode: periodeThbl,
        OR: [{ verif3At: { not: null } }, { isVerified: true }],
      },
    }),
    hitungBarisSiapTagih(periode, periodeThbl),
  ])

  const perStatus: Record<string, number> = {}
  let dpmTotal = 0
  for (const d of dpm) {
    perStatus[d.status] = d._count
    dpmTotal += d._count
  }

  const hambatan = [...hasil.hambatan]
  const belumSelesai = laporanTotal - laporanSelesai
  if (belumSelesai > 0) {
    // Nomor langganannya diambil terpisah (bukan dari count di atas) supaya
    // operator bisa langsung menelusuri laporan mana yang menahan closing.
    const contoh = await prisma.laporanHarianPetugas.findMany({
      where: { periode: periodeThbl, verif3At: null, isVerified: false },
      select: { nomorLangganan: true },
      orderBy: { nomorLangganan: "asc" },
      take: MAKS_CONTOH_HAMBATAN,
    })
    hambatan.push({
      kode: "VERIFIKASI_BELUM_TUNTAS",
      pesan:
        "Masih ada laporan lapangan yang belum tuntas V3 — pelanggan ini tidak akan ditagih pada closing ini",
      jumlah: belumSelesai,
      contoh: contoh.map((r) => r.nomorLangganan),
    })
  }
  const belumDicatat =
    (perStatus.BELUM_DICATAT ?? 0) + (perStatus.TIDAK_TERCATAT ?? 0)
  if (belumDicatat > 0) {
    const contoh = await prisma.daftarCatat.findMany({
      where: {
        periode: periodeThbl,
        status: { in: ["BELUM_DICATAT", "TIDAK_TERCATAT"] },
      },
      select: { pelanggan: { select: { nomorLangganan: true } } },
      orderBy: { pelanggan: { nomorLangganan: "asc" } },
      take: MAKS_CONTOH_HAMBATAN,
    })
    hambatan.push({
      kode: "DAFTAR_CATAT_BELUM_TUNTAS",
      pesan:
        "Masih ada pelanggan di daftar catat periode ini yang belum menghasilkan pembacaan",
      jumlah: belumDicatat,
      contoh: contoh.map((r) => r.pelanggan.nomorLangganan),
    })
  }

  const status = row ? row.status : "BELUM_ADA"

  return {
    periode: periodeThbl,
    status,
    daftarCatat: { total: dpmTotal, perStatus },
    verifikasi: {
      total: laporanTotal,
      selesaiV3: laporanSelesai,
      belumSelesai,
    },
    pembacaan: {
      total: hasil.totalPembacaan,
      sudahDitagih: hasil.sudahDitagih,
      akanDitagih: hasil.baris.length,
    },
    perkiraan: {
      jumlahSL: hasil.baris.length,
      totalM3: hasil.baris.reduce((n, b) => n + b.pemakaianM3, 0),
      totalTagihan: hasil.baris.reduce((n, b) => n + b.totalTagihan, 0),
    },
    // Hambatan yang bersifat "sebagian pelanggan tidak ikut" TIDAK memblokir
    // — closing sebagian kadang memang keputusan yang diambil sadar. Yang
    // memblokir hanyalah periode yang sudah terkunci; sisanya peringatan
    // yang wajib dibaca operator sebelum menekan tombol.
    hambatan,
    bisaDitutup: status !== "TERKUNCI",
  }
}

export interface JejakAudit {
  ipAddress?: string | null
  userAgent?: string | null
}

export interface TutupPeriodeInput {
  periode: number
  tanggalJatuhTempo: Date
  olehUserId: string
  jejak?: JejakAudit
}

export interface HasilClosing {
  periode: number
  tagihanDiterbitkan: number
  tagihanSudahAda: number
  jumlahSL: number
  totalM3: number
  totalTagihan: number
  hambatan: HambatanClosing[]
}

export async function tutupPeriode(
  input: TutupPeriodeInput,
): Promise<HasilClosing> {
  const periode = periodeToDate(input.periode)

  const existing = await prisma.periodePenagihan.findUnique({
    where: { periode: input.periode },
  })
  if (existing?.status === "TERKUNCI") {
    throw new ConflictError(
      `Periode ${input.periode} sudah ditutup pada ${existing.ditutupAt?.toISOString().slice(0, 10)} — buka kembali dulu bila memang perlu diubah`,
    )
  }

  if (input.tanggalJatuhTempo <= periode) {
    throw new BadRequestError("Tanggal jatuh tempo harus setelah awal periode")
  }

  const hasil = await hitungBarisSiapTagih(periode, input.periode)
  if (hasil.baris.length === 0 && hasil.sudahDitagih === 0) {
    throw new BadRequestError(
      `Tidak ada pembacaan meter untuk periode ${input.periode} — tidak ada yang bisa ditagihkan`,
    )
  }

  // Tunggakan: dihitung dari tagihan periode SEBELUMNYA yang belum lunas.
  // Ini data nyata (bukan tebakan) dan dipakai untuk menandai tagihan baru
  // sebagai JATUH_TEMPO, mengikuti aturan yang sama seperti saat impor.
  const tunggakan = new Map<string, { jumlah: number; nominal: bigint }>()
  if (hasil.baris.length > 0) {
    const belumLunas = await prisma.tagihan.groupBy({
      by: ["pelangganId"],
      where: {
        periode: { lt: periode },
        status: { in: ["BELUM_BAYAR", "JATUH_TEMPO"] },
        pelangganId: { in: hasil.baris.map((b) => b.pelangganId) },
      },
      _count: true,
      _sum: { totalTagihan: true },
    })
    for (const t of belumLunas) {
      tunggakan.set(t.pelangganId, {
        jumlah: t._count,
        nominal: BigInt(t._sum.totalTagihan ?? 0),
      })
    }
  }

  let diterbitkan = 0
  for (let mulai = 0; mulai < hasil.baris.length; mulai += UKURAN_BATCH) {
    const kelompok = hasil.baris.slice(mulai, mulai + UKURAN_BATCH)
    const data: Prisma.TagihanCreateManyInput[] = kelompok.map((b) => {
      const tgk = tunggakan.get(b.pelangganId)
      return {
        pelangganId: b.pelangganId,
        pembacaanId: b.pembacaanId,
        tarifGolonganId: b.tarifGolonganId,
        periode,
        pemakaianM3: b.pemakaianM3,
        jmlHargaAir: b.jmlHargaAir,
        beaBeban: b.beaBeban,
        beaAdmin: b.beaAdmin,
        airKotor: b.airKotor,
        lainLain: 0,
        totalTagihan: b.totalTagihan,
        tanggalJatuhTempo: input.tanggalJatuhTempo,
        jumlahRekTunggak: tgk?.jumlah ?? 0,
        nominalTunggak: tgk?.nominal ?? BigInt(0),
        status: tgk && tgk.jumlah > 0 ? "JATUH_TEMPO" : "BELUM_BAYAR",
      }
    })
    // skipDuplicates: kalau closing sempat gagal di tengah lalu diulang,
    // baris yang sudah masuk tidak membuat seluruh batch gagal.
    const res = await prisma.tagihan.createMany({ data, skipDuplicates: true })
    diterbitkan += res.count
  }

  // Ringkasan DIHITUNG DARI DATABASE, bukan dari variabel di memori — supaya
  // angka yang dibekukan benar-benar mencerminkan isi tabel, termasuk baris
  // yang sudah ada sebelum closing ini.
  const ringkas = await prisma.tagihan.aggregate({
    where: { periode },
    _count: true,
    _sum: { pemakaianM3: true, totalTagihan: true },
  })

  const jumlahSL = ringkas._count
  const totalM3 = ringkas._sum.pemakaianM3 ?? 0
  const totalTagihan = ringkas._sum.totalTagihan ?? 0

  // Penguncian periode + penandaan daftar catat + jejak audit dalam SATU
  // transaksi: menutup periode tanpa jejak siapa yang menutupnya bukan
  // pilihan yang boleh ada.
  await prisma.$transaction(async (tx) => {
    await tx.periodePenagihan.upsert({
      where: { periode: input.periode },
      create: {
        periode: input.periode,
        status: "TERKUNCI",
        tanggalJatuhTempo: input.tanggalJatuhTempo,
        ditutupAt: new Date(),
        ditutupById: input.olehUserId,
        jumlahSL,
        totalM3,
        totalTagihan: BigInt(totalTagihan),
      },
      update: {
        status: "TERKUNCI",
        tanggalJatuhTempo: input.tanggalJatuhTempo,
        ditutupAt: new Date(),
        ditutupById: input.olehUserId,
        jumlahSL,
        totalM3,
        totalTagihan: BigInt(totalTagihan),
        // Jejak pembukaan sebelumnya sengaja TIDAK dihapus — riwayat bahwa
        // periode ini pernah dibuka kembali adalah informasi audit.
      },
    })

    // Baris daftar catat yang sudah DIBACA ditandai selesai.
    //
    // Syaratnya PEMBACAAN, bukan tagihan. DICATAT berarti "petugas sudah
    // mengunjungi dan mencatat", dan itu tidak sama dengan "ditagih":
    // sambungan PBPK periode pertama dicatat dengan stand nol tetapi sengaja
    // tidak ditagih (lihat hitungBarisSiapTagih). Memakai tagihan sebagai
    // syarat membuat mereka tertinggal BELUM_DICATAT selamanya, seolah
    // petugas tidak pernah datang.
    await tx.daftarCatat.updateMany({
      where: {
        periode: input.periode,
        status: { in: ["BELUM_DICATAT"] },
        pelanggan: { meter: { some: { pembacaan: { some: { periode } } } } },
      },
      data: { status: "DICATAT", selesaiAt: new Date() },
    })

    await recordAudit(tx, {
      userId: input.olehUserId,
      aksi: "TUTUP_PERIODE",
      entitas: "PeriodePenagihan",
      entitasId: String(input.periode),
      perubahan: {
        periode: input.periode,
        tagihanDiterbitkan: diterbitkan,
        tagihanSudahAda: hasil.sudahDitagih,
        jumlahSL,
        totalM3,
        totalTagihan,
        tanggalJatuhTempo: input.tanggalJatuhTempo.toISOString(),
      },
      ipAddress: input.jejak?.ipAddress ?? null,
      userAgent: input.jejak?.userAgent ?? null,
    })
  })

  return {
    periode: input.periode,
    tagihanDiterbitkan: diterbitkan,
    tagihanSudahAda: hasil.sudahDitagih,
    jumlahSL,
    totalM3,
    totalTagihan,
    hambatan: hasil.hambatan,
  }
}

export interface BukaPeriodeInput {
  periode: number
  alasan: string
  olehUserId: string
  jejak?: JejakAudit
}

/// Membuka kembali periode yang sudah ditutup. SENGAJA DIPERSULIT:
/// tagihan yang sudah dibayar tidak boleh berada di periode yang bisa
/// diubah lagi — uangnya sudah masuk, angkanya sudah jadi sejarah.
export async function bukaPeriode(input: BukaPeriodeInput) {
  const row = await prisma.periodePenagihan.findUnique({
    where: { periode: input.periode },
  })
  if (!row)
    throw new BadRequestError(`Periode ${input.periode} belum pernah ditutup`)
  if (row.status !== "TERKUNCI") {
    throw new ConflictError(`Periode ${input.periode} tidak sedang terkunci`)
  }

  const periode = periodeToDate(input.periode)
  const sudahDibayar = await prisma.tagihan.count({
    where: { periode, status: "SUDAH_BAYAR" },
  })
  if (sudahDibayar > 0) {
    throw new ConflictError(
      `Periode ${input.periode} sudah punya ${sudahDibayar} tagihan LUNAS — tidak bisa dibuka kembali. Koreksi yang perlu dilakukan harus lewat penyesuaian tagihan, bukan membuka periode.`,
    )
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.periodePenagihan.update({
      where: { periode: input.periode },
      data: {
        status: "BERJALAN",
        dibukaAt: new Date(),
        dibukaById: input.olehUserId,
        alasanBuka: input.alasan,
      },
    })
    await recordAudit(tx, {
      userId: input.olehUserId,
      aksi: "BUKA_PERIODE",
      entitas: "PeriodePenagihan",
      entitasId: String(input.periode),
      perubahan: { periode: input.periode, alasan: input.alasan },
      ipAddress: input.jejak?.ipAddress ?? null,
      userAgent: input.jejak?.userAgent ?? null,
    })
    return updated
  })
}
