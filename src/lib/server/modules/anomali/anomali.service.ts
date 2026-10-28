// server/modules/anomali/anomali.service.ts — SAMBUNGAN TIDAK TERUKUR.
//
// Menjawab satu pertanyaan operasional: rumah mana yang harus didatangi,
// karena meternya sudah berbulan-bulan tidak terbaca dan tagihannya selama
// itu hanya perkiraan.
//
// DAFTARNYA DIHITUNG, TIDAK DISIMPAN. Ia turunan dari riwayat
// `PembacaanMeter` + `Tagihan.jumlahRekTunggak`, dan berubah sendiri begitu
// pembacaan baru masuk. Menyimpannya sebagai tabel berarti ia bisa basi dan
// butuh disinkronkan — pekerjaan tambahan yang tidak membeli apa pun. Yang
// disimpan hanyalah hasil kunjungan (`KunjunganAnomali`).
//
// Aturannya sendiri ada di @/lib/domain/anomali supaya dipakai sama
// persis oleh server, layar web, dan aplikasi petugas.

import { prisma } from "@db"
import {
  AMBANG_BULAN_DEFAULT,
  KONDISI_TIDAK_TERUKUR,
  deteksiAnomali,
  prioritasKunjungan,
  type BarisRiwayat,
  type KategoriAnomali,
} from "@/lib/domain/anomali"
import { dateToPeriode, periodeToDate } from "../../lib/periode"

/// Berapa periode ke belakang yang dibaca. Cukup untuk memastikan deretan
/// terpanjang yang masuk akal (satu tahun) tanpa menarik seluruh riwayat
/// pembacaan yang di database ini sudah 135 ribu baris.
const RIWAYAT_PERIODE = 12

export interface BarisAnomali {
  pelangganId: string
  nomorLangganan: string
  nama: string
  alamat: string | null
  kategori: KategoriAnomali
  kondisiTerakhir: string
  bulanBerturut: number
  m3TanpaDasar: number
  skor: number
  /// Jumlah rekening menunggak pada tagihan terakhir. 0 = pelanggan rutin
  /// membayar, dan justru itu yang membuatnya perlu didatangi — ia tidak
  /// akan tersentuh jalur penagihan maupun pemutusan.
  jumlahRekTunggak: number
  prioritas: boolean
  ruteKode: string | null
  /// WILAYAH DAN URUTAN JALAN. Daftar ini diurutkan menurut paparan, dan
  /// paparan tidak mengenal geografi — dua baris berurutan bisa terpisah
  /// beberapa kilometer. Empat field berikut yang membuat petugas bisa
  /// mempersempit ke satu kelurahan/RW lalu menyusurinya menurut urutan baca
  /// meter, alih-alih melompat-lompat sepanjang hari.
  kelurahan: string | null
  rt: string | null
  rw: string | null
  /// Urutan kunjungan dalam rute baca meter (bill_nourutrute). Inilah urutan
  /// jalan kaki yang sudah terbukti dipakai pencatat tiap bulan.
  noUrutRute: number | null
  /// Kunjungan TERAKHIR yang pernah dilakukan, bila ada — supaya petugas
  /// tidak mendatangi rumah yang bulan ini sudah didatangi rekannya.
  kunjunganTerakhir: {
    periode: number
    hasil: string
    dikunjungiAt: Date
  } | null
}

export interface OpsiDaftar {
  ambangBulan?: number
  kategori?: KategoriAnomali
  /// SATU kondisi catat saja (mis. "DK"), dicocokkan ke kondisi TERAKHIR —
  /// kondisi yang sama yang menentukan kategorinya, jadi keduanya tidak
  /// mungkin bertentangan.
  ///
  /// Kenapa terpisah dari `kategori`: kategori mengelompokkan menurut
  /// TINDAKAN (DK, TERHALANG, dan ADA ANJING sama-sama diselesaikan dengan
  /// datang di jam lain), sedangkan pertanyaan lapangan kerap lebih sempit
  /// dari itu — "mana saja yang benar-benar DK". Tanpa saringan ini
  /// satu-satunya jalan adalah memilih kategori lalu memilah dengan mata.
  kondisi?: string
  /// true = hanya yang tanpa tunggakan (prioritas kunjungan).
  hanyaPrioritas?: boolean
  /// Sembunyikan yang sudah dikunjungi pada periode ini.
  sembunyikanSudahDikunjungi?: boolean
  periode?: number
  /// Pencarian bebas: nomor langganan, nama, atau alamat. Daftar ini bisa
  /// berisi ribuan baris, dan pertanyaan yang paling sering datang bukan
  /// "mana yang paling parah" melainkan "sambungan X ini bagaimana" —
  /// menjawabnya tanpa pencarian berarti menggulir ribuan baris.
  q?: string
  /// Kelurahan tertentu saja. Dipakai menyiapkan rute jalan kaki sehari.
  kelurahan?: string
  /// "paparan" (bawaan) = paling merugikan di atas — untuk memutuskan siapa
  /// yang didatangi. "rute" = urutan jalan kaki pencatat (kelurahan → RW → RT
  /// → no urut rute) — untuk menyusuri setelah keputusannya diambil. Keduanya
  /// dibutuhkan pada saat yang BERBEDA, jadi tidak ada satu urutan yang benar.
  urutan?: "paparan" | "rute"
}

/// Normalisasi ringan untuk pencocokan: nomor langganan sering ditulis tanpa
/// nol di depan, dan nama diketik dengan kapitalisasi sekenanya.
function cocok(nilai: string | null, kunci: string): boolean {
  return nilai != null && nilai.toLowerCase().includes(kunci)
}

/// Menghitung seluruh sambungan yang memenuhi syarat anomali.
///
/// SATU QUERY BESAR, BUKAN N+1. Untuk 22 ribu pelanggan × 12 periode,
/// mengambil riwayat per pelanggan berarti 22 ribu round-trip — di database
/// terkelola itu hitungan jam. Semua dibaca sekali lalu dikelompokkan di
/// memori; beban puncaknya ~270 ribu baris ringan, masih jauh di bawah
/// batas wajar untuk proses ini yang jalannya sesekali, bukan per-request
/// pengguna akhir.
const PILIH_PELANGGAN = {
  id: true,
  nomorLangganan: true,
  nama: true,
  alamat: true,
  deletedAt: true,
  rt: true,
  rw: true,
  noUrutRute: true,
  rute: { select: { kode: true } },
  kelurahan: { select: { nama: true } },
} as const

type PelangganRingkas = {
  id: string
  nomorLangganan: string
  nama: string
  alamat: string | null
  deletedAt: Date | null
  rt: string | null
  rw: string | null
  noUrutRute: number | null
  rute: { kode: string } | null
  kelurahan: { nama: string } | null
}

/// Memuat riwayat pembacaan satu jendela periode, dikelompokkan per pelanggan.
/// Urutan tiap riwayat MENURUN — dijamin `orderBy` dan dipakai apa adanya oleh
/// deteksiAnomali.
///
/// DUA HAL YANG SENGAJA TIDAK DILAKUKAN DI SINI, keduanya soal kecepatan:
///
///   1. Tidak memuat data pelanggan. Menyertakannya lewat join berarti nama,
///      alamat, rute, dan kelurahan ikut terkirim SEKALI PER BARIS PEMBACAAN —
///      dua belas kali per pelanggan, untuk 22 ribu pelanggan, padahal yang
///      akhirnya dipakai hanya yang lolos deteksi. Pemanggil mengambilnya
///      sendiri untuk id yang lolos; `trenAnomali` bahkan tidak perlu sama
///      sekali karena cuma menghitung jumlah.
///   2. Tidak dipanggil per periode. `trenAnomali` memuat SEKALI untuk seluruh
///      jendelanya lalu menurunkan tiap titik dari data yang sama. Sebelumnya
///      ia memanggil `daftarAnomali` enam kali dan tiap panggilan menarik ulang
///      ~157 ribu baris dari nol — terukur 10,7 detik untuk satu kali buka.
async function muatRiwayat(
  dariPeriode: number,
  sampaiPeriode: number,
): Promise<Map<string, BarisRiwayat[]>> {
  const pembacaan = await prisma.pembacaanMeter.findMany({
    where: {
      periode: {
        lte: periodeToDate(sampaiPeriode),
        gte: periodeToDate(dariPeriode),
      },
      // Terhapus lunak disaring DI SINI, bukan setelah pengelompokan. Dulu
      // penyaringan itu menumpang pada `deletedAt` yang ikut terbawa join
      // pelanggan; begitu join-nya dibuang demi kecepatan, penyaringnya harus
      // pindah ke sumber — kalau tidak, `trenAnomali` yang memang tak pernah
      // menyentuh tabel pelanggan akan diam-diam ikut menghitung mereka.
      meter: { pelanggan: { deletedAt: null } },
    },
    select: {
      periode: true,
      kondisi: true,
      pemakaianM3: true,
      pemakaianRiil: true,
      meter: { select: { pelangganId: true } },
    },
    orderBy: { periode: "desc" },
  })

  const perPelanggan = new Map<string, BarisRiwayat[]>()
  for (const p of pembacaan) {
    const id = p.meter.pelangganId
    if (id == null) continue
    let r = perPelanggan.get(id)
    if (!r) {
      r = []
      perPelanggan.set(id, r)
    }
    r.push({
      periode: dateToPeriode(p.periode),
      kondisi: p.kondisi,
      pemakaianM3: p.pemakaianM3,
      pemakaianRiil: p.pemakaianRiil,
    })
  }
  return perPelanggan
}

export async function daftarAnomali(
  opsi: OpsiDaftar = {},
): Promise<BarisAnomali[]> {
  const ambangBulan = opsi.ambangBulan ?? AMBANG_BULAN_DEFAULT

  // Periode acuan = periode pembacaan TERAKHIR yang ada di database, bukan
  // bulan kalender. Kalau closing belum jalan, bulan kalender akan menunjuk
  // periode yang belum punya data sama sekali dan daftarnya jadi kosong
  // tanpa penjelasan.
  const terbaru = await prisma.pembacaanMeter.aggregate({
    _max: { periode: true },
  })
  if (!terbaru._max.periode) return []
  const periodeAcuan = opsi.periode ?? dateToPeriode(terbaru._max.periode)

  const perPelanggan = await muatRiwayat(
    mundurPeriode(periodeAcuan, RIWAYAT_PERIODE),
    periodeAcuan,
  )

  // URUTAN LANGKAHNYA SOAL BIAYA: deteksi dulu (murni di memori, tanpa query),
  // baru data pelanggan untuk yang lolos, baru tunggakan & kunjungan untuk
  // yang masih bertahan setelah pencarian. Tiap tahap memperkecil himpunan
  // sebelum tahap berikutnya menyentuh database.
  const lolosDeteksi: {
    id: string
    riwayat: BarisRiwayat[]
    hasil: ReturnType<typeof deteksiAnomali>
  }[] = []
  for (const [id, riwayat] of perPelanggan) {
    const hasil = deteksiAnomali(riwayat, ambangBulan)
    if (!hasil.kategori) continue
    if (opsi.kategori && hasil.kategori !== opsi.kategori) continue
    // Kondisi TERAKHIR — sumber yang sama dengan penentu kategori di
    // deteksiAnomali, bukan "pernah ber-kondisi ini".
    if (opsi.kondisi && riwayat[0]?.kondisi !== opsi.kondisi) continue
    lolosDeteksi.push({ id, riwayat, hasil })
  }
  if (lolosDeteksi.length === 0) return []

  const pelangganList = await prisma.pelanggan.findMany({
    where: { id: { in: lolosDeteksi.map((x) => x.id) }, deletedAt: null },
    select: PILIH_PELANGGAN,
  })
  const petaPelanggan = new Map<string, PelangganRingkas>(
    pelangganList.map((p) => [p.id, p]),
  )

  const kunci = opsi.q?.trim().toLowerCase() ?? ""
  const kelurahanCari = opsi.kelurahan?.trim().toLowerCase() ?? ""

  const lolos: {
    p: PelangganRingkas
    riwayat: BarisRiwayat[]
    hasil: ReturnType<typeof deteksiAnomali>
  }[] = []
  for (const x of lolosDeteksi) {
    const p = petaPelanggan.get(x.id)
    if (!p) continue // terhapus lunak sejak pembacaannya tercatat
    if (
      kunci.length > 0 &&
      !cocok(p.nomorLangganan, kunci) &&
      !cocok(p.nama, kunci) &&
      !cocok(p.alamat, kunci)
    ) {
      continue
    }
    // SAMA PERSIS, bukan mengandung: nilainya datang dari dropdown berisi
    // nama kelurahan yang benar-benar ada, dan pencocokan substring membuat
    // memilih "Cibadak" ikut memuat "Cibadak Kulon" — dua wilayah berbeda
    // yang tidak pernah diminta.
    if (
      kelurahanCari.length > 0 &&
      (p.kelurahan?.nama ?? "").toLowerCase() !== kelurahanCari
    )
      continue
    lolos.push({ p, riwayat: x.riwayat, hasil: x.hasil })
  }
  if (lolos.length === 0) return []

  const idPelanggan = lolos.map((x) => x.p.id)
  const [tagihanTerakhir, kunjungan] = await Promise.all([
    prisma.tagihan.findMany({
      where: {
        pelangganId: { in: idPelanggan },
        periode: periodeToDate(periodeAcuan),
      },
      select: { pelangganId: true, jumlahRekTunggak: true },
    }),
    prisma.kunjunganAnomali.findMany({
      where: { pelangganId: { in: idPelanggan } },
      select: {
        pelangganId: true,
        periode: true,
        hasil: true,
        dikunjungiAt: true,
      },
      orderBy: { periode: "desc" },
    }),
  ])
  const petaTunggak = new Map(
    tagihanTerakhir.map((t) => [t.pelangganId, t.jumlahRekTunggak ?? 0]),
  )
  const petaKunjungan = new Map<string, (typeof kunjungan)[number]>()
  for (const k of kunjungan)
    if (!petaKunjungan.has(k.pelangganId)) petaKunjungan.set(k.pelangganId, k)

  const baris: BarisAnomali[] = []
  for (const { p, riwayat, hasil } of lolos) {
    const tunggak = petaTunggak.get(p.id) ?? 0
    const prioritas = prioritasKunjungan(tunggak)
    if (opsi.hanyaPrioritas && !prioritas) continue

    const terakhir = petaKunjungan.get(p.id) ?? null
    if (opsi.sembunyikanSudahDikunjungi && terakhir?.periode === periodeAcuan)
      continue

    baris.push({
      pelangganId: p.id,
      nomorLangganan: p.nomorLangganan,
      nama: p.nama,
      alamat: p.alamat,
      kategori: hasil.kategori!,
      kondisiTerakhir: riwayat[0]!.kondisi,
      bulanBerturut: hasil.bulanBerturut,
      m3TanpaDasar: hasil.m3TanpaDasar,
      skor: hasil.skor,
      jumlahRekTunggak: tunggak,
      prioritas,
      ruteKode: p.rute?.kode ?? null,
      kelurahan: p.kelurahan?.nama ?? null,
      rt: p.rt,
      rw: p.rw,
      noUrutRute: p.noUrutRute,
      kunjunganTerakhir: terakhir
        ? {
            periode: terakhir.periode,
            hasil: terakhir.hasil,
            dikunjungiAt: terakhir.dikunjungiAt,
          }
        : null,
    })
  }

  if (opsi.urutan === "rute") {
    // Urutan JALAN KAKI, bukan kepentingan: kelurahan → RW → RT → no urut
    // rute. Dipakai setelah keputusan siapa yang didatangi sudah diambil,
    // supaya sehari itu tidak dihabiskan untuk berpindah-pindah wilayah.
    const teks = (v: string | null) => v ?? "￿" // yang kosong ke belakang
    baris.sort(
      (a, b) =>
        teks(a.kelurahan).localeCompare(teks(b.kelurahan), "id") ||
        teks(a.rw).localeCompare(teks(b.rw), "id") ||
        teks(a.rt).localeCompare(teks(b.rt), "id") ||
        (a.noUrutRute ?? Number.MAX_SAFE_INTEGER) -
          (b.noUrutRute ?? Number.MAX_SAFE_INTEGER),
    )
    return baris
  }

  // Prioritas dulu (tanpa tunggakan = tak tersentuh proses lain), lalu skor
  // paparan. Dua kunci, bukan satu: mengurutkan hanya dengan skor akan
  // menenggelamkan pelanggan rutin di bawah penunggak bervolume besar yang
  // sebenarnya sudah ditangani jalur penagihan.
  baris.sort(
    (a, b) => Number(b.prioritas) - Number(a.prioritas) || b.skor - a.skor,
  )
  return baris
}

function mundurPeriode(periode: number, bulan: number): number {
  const t = Math.floor(periode / 100)
  const b = (periode % 100) - bulan
  const tahun = t + Math.floor((b - 1) / 12)
  const bulanBaru = ((((b - 1) % 12) + 12) % 12) + 1
  return tahun * 100 + bulanBaru
}

export interface TitikTren {
  periode: number
  TERKUNCI: number
  DIDUGA_KOSONG: number
  METER_RUSAK: number
  total: number
  /// Sambungan anomali yang BENAR-BENAR didatangi pada periode ini, dihitung
  /// sekali per sambungan dari DUA sumber:
  ///
  ///   1. KunjunganAnomali — kunjungan anomali khusus.
  ///   2. LaporanHarianPetugas yang berhasil MEMBACA meternya (kondisi di luar
  ///      KONDISI_TIDAK_TERUKUR) — sambungan anomali kerap terpecahkan lewat
  ///      kunjungan rutin rute, dan pekerjaan itu nyata meski masuk lewat
  ///      pintu lain.
  ///
  /// Laporan rutin yang kondisinya MASIH tak terukur sengaja TIDAK dihitung:
  /// sambungan ini memang dicatat tiap bulan — itu justru asal-usul kondisi
  /// TTB/DK-nya. Menghitung semuanya akan membuat angka ini mendekati total
  /// dan metriknya kehilangan arti.
  dikunjungi: number
  /// false = riwayat pembacaan belum mencapai `ambangBulan` periode, jadi
  /// angka nol di atas berarti "belum bisa dinilai", BUKAN "tidak ada
  /// anomali". Tanpa penanda ini grafik tren akan terbaca seolah anomali
  /// melonjak dari nol — padahal yang berubah cuma ketersediaan riwayat.
  cukupData: boolean
  /// true = periode ini belum di-closing (belum punya PembacaanMeter), jadi
  /// angka totalnya masih menyalin periode sebelumnya. Ditandai supaya baris
  /// datar di ujung tabel tidak terbaca sebagai "anomali berhenti berkurang".
  berjalan: boolean
}

/// Tren jumlah anomali per periode — SATU-SATUNYA angka yang mengukur
/// keberhasilan modul ini. Tidak ada target kunjungan; yang dinilai adalah
/// apakah garis ini turun.
export async function trenAnomali(
  jumlahPeriode = 6,
  ambangBulan = AMBANG_BULAN_DEFAULT,
): Promise<TitikTren[]> {
  const terbaru = await prisma.pembacaanMeter.aggregate({
    _max: { periode: true },
  })
  if (!terbaru._max.periode) return []
  const periodeTutup = dateToPeriode(terbaru._max.periode)

  // Ujung tren TIDAK berhenti di periode terakhir yang sudah di-closing.
  // Petugas mengirim laporan sepanjang bulan berjalan, dan closing baru
  // menyusul di belakang — tanpa titik untuk bulan berjalan, pekerjaan yang
  // BARU SAJA dikerjakan tidak punya baris untuk muncul, dan orang wajar
  // menyimpulkan laporannya hilang.
  const laporanTerbaru = await prisma.laporanHarianPetugas.aggregate({
    _max: { periode: true },
  })
  const akhir = Math.max(periodeTutup, laporanTerbaru._max.periode ?? 0)

  // Periode pembacaan PALING AWAL yang ada — dipakai menandai titik tren
  // yang riwayatnya belum cukup panjang untuk dinilai.
  const paling = await prisma.pembacaanMeter.aggregate({
    _min: { periode: true },
  })
  const awal = paling._min.periode
    ? dateToPeriode(paling._min.periode)
    : periodeTutup

  const paling1 = mundurPeriode(akhir, jumlahPeriode - 1)

  // SATU pemuatan untuk seluruh jendela tren, bukan satu per titik. Jendelanya
  // = periode terlama yang dinilai, mundur lagi sebanyak RIWAYAT_PERIODE
  // karena titik terlama pun perlu riwayat di belakangnya untuk dinilai.
  //
  // Tren juga TIDAK butuh tunggakan: yang dihitung cuma jumlah per kategori.
  // Memanggil daftarAnomali di sini berarti ikut menarik tagihan untuk ribuan
  // pelanggan, enam kali, tanpa satu pun angkanya dipakai.
  const perPelanggan = await muatRiwayat(
    mundurPeriode(paling1, RIWAYAT_PERIODE),
    akhir,
  )

  // Kunjungan & laporan seluruh jendela ditarik sekali lalu dikelompokkan per
  // periode — alasan yang sama.
  const [semuaKunjungan, semuaLaporan] = await Promise.all([
    prisma.kunjunganAnomali.findMany({
      where: { periode: { gte: paling1, lte: akhir } },
      select: { pelangganId: true, periode: true },
    }),
    prisma.laporanHarianPetugas.findMany({
      where: {
        periode: { gte: paling1, lte: akhir },
        pelangganId: { not: null },
      },
      select: { pelangganId: true, periode: true, kondisi: true },
    }),
  ])

  const titik: TitikTren[] = []
  for (let i = jumlahPeriode - 1; i >= 0; i--) {
    const periode = mundurPeriode(akhir, i)

    // Kategori per pelanggan, dihitung dari riwayat yang SUDAH di memori.
    const kategoriPer = new Map<string, KategoriAnomali>()
    for (const [id, semua] of perPelanggan) {
      const riwayat = semua
        .filter((r) => r.periode <= periode)
        .slice(0, RIWAYAT_PERIODE)
      if (riwayat.length === 0) continue
      const hasil = deteksiAnomali(riwayat, ambangBulan)
      if (hasil.kategori) kategoriPer.set(id, hasil.kategori)
    }

    // Satu sambungan dihitung SEKALI walau didatangi lewat dua jalur.
    const didatangi = new Set<string>()
    for (const k of semuaKunjungan) {
      if (k.periode === periode && kategoriPer.has(k.pelangganId))
        didatangi.add(k.pelangganId)
    }
    for (const l of semuaLaporan) {
      if (l.periode !== periode || l.pelangganId == null) continue
      if (!kategoriPer.has(l.pelangganId)) continue
      if (KONDISI_TIDAK_TERUKUR.includes(l.kondisi)) continue
      didatangi.add(l.pelangganId)
    }

    const hitung = (k: KategoriAnomali) =>
      [...kategoriPer.values()].filter((v) => v === k).length

    titik.push({
      periode,
      TERKUNCI: hitung("TERKUNCI"),
      DIDUGA_KOSONG: hitung("DIDUGA_KOSONG"),
      METER_RUSAK: hitung("METER_RUSAK"),
      total: kategoriPer.size,
      dikunjungi: didatangi.size,
      cukupData: jarakPeriode(awal, periode) + 1 >= ambangBulan,
      berjalan: periode > periodeTutup,
    })
  }
  return titik
}

/// Selisih bulan antara dua periode thbl.
function jarakPeriode(dari: number, ke: number): number {
  return (
    (Math.floor(ke / 100) - Math.floor(dari / 100)) * 12 +
    ((ke % 100) - (dari % 100))
  )
}

/// Riwayat kondisi satu sambungan — dipakai layar detail supaya petugas tahu
/// apa yang ditemui rekannya bulan-bulan sebelumnya sebelum berangkat.
export async function riwayatSambungan(pelangganId: string) {
  const [pelanggan, pembacaan, kunjungan, laporanLapangan] = await Promise.all([
    prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: {
        id: true,
        nomorLangganan: true,
        nama: true,
        alamat: true,
        rt: true,
        rw: true,
        status: true,
        rute: { select: { kode: true } },
        kelurahan: { select: { nama: true } },
      },
    }),
    prisma.pembacaanMeter.findMany({
      where: { meter: { pelangganId } },
      select: {
        periode: true,
        kondisi: true,
        standLalu: true,
        standAkhir: true,
        pemakaianM3: true,
        pemakaianRiil: true,
        alasanTaksir: true,
        pencatat: { select: { namaLapangan: true } },
      },
      orderBy: { periode: "desc" },
      take: RIWAYAT_PERIODE,
    }),
    prisma.kunjunganAnomali.findMany({
      where: { pelangganId },
      select: {
        id: true,
        periode: true,
        kategori: true,
        hasil: true,
        standDitemukan: true,
        catatan: true,
        dikunjungiAt: true,
        /// KETIGA foto ikut, bukan `fotoUrl` saja. Seluruh gunanya tabel ini
        /// adalah supaya klaim petugas ("meternya rusak", "rumahnya kosong")
        /// bisa DIPERIKSA dari kantor tanpa mendatangi ulang — lihat catatan
        /// pada model KunjunganAnomali. Mengirim satu foto membuat pemeriksaan
        /// itu mustahil justru pada dua kasus yang paling perlu dibuktikan.
        fotoUrl: true,
        fotoSegelUrl: true,
        fotoRumahUrl: true,
        isSegel: true,
        /// Snapshot alasan sambungan ini masuk daftar SAAT dikunjungi —
        /// tanpanya pembaca menilai kunjungan lama dengan keadaan hari ini.
        bulanBerturut: true,
        m3TanpaDasar: true,
        pencatat: { select: { namaLapangan: true } },
      },
      orderBy: { periode: "desc" },
    }),
    /// LAPORAN LAPANGAN DARI JALUR PENCATATAN RUTIN.
    ///
    /// Sambungan tidak terukur kerap justru terpecahkan lewat kunjungan rutin
    /// rute, bukan lewat kunjungan anomali khusus: petugas kebetulan bertemu
    /// penghuni, meternya terbaca, dan angkanya dikirim dari layar catat
    /// lapangan. Jalur itu TIDAK melahirkan KunjunganAnomali, sehingga tanpa
    /// bagian ini panel akan menyatakan "belum pernah didatangi" untuk rumah
    /// yang fotonya sudah ada di server — dan penyelia berikutnya berangkat ke
    /// alamat yang sama tanpa perlu.
    prisma.laporanHarianPetugas.findMany({
      where: { pelangganId },
      select: {
        id: true,
        periode: true,
        kondisi: true,
        kategori: true,
        standAwal: true,
        standAkhir: true,
        pemakaian: true,
        fotoStandUrl: true,
        fotoSegelUrl: true,
        fotoRumahUrl: true,
        isSegel: true,
        latCatat: true,
        longCatat: true,
        tanggalCatat: true,
        tanggalUpload: true,
        isVerified: true,
        verifiedAt: true,
        pembacaanId: true,
        pencatat: { select: { namaLapangan: true } },
      },
      orderBy: { periode: "desc" },
      take: RIWAYAT_PERIODE,
    }),
  ])
  if (!pelanggan) return null

  /// Koordinat lewat raw SQL: kolom PostGIS tidak bisa di-`select` query
  /// builder Prisma (alasan yang sama seperti saat menulisnya di
  /// anomali.router.ts). Ini bukti bahwa petugas benar-benar datang, jadi
  /// tanpanya kolom "kunjungan terakhir" hanya klaim tanpa penyangga.
  const titik = await prisma.$queryRaw<
    { id: string; lat: number | null; lon: number | null }[]
  >`
    SELECT id, ST_Y(koordinat) AS lat, ST_X(koordinat) AS lon
    FROM kunjungan_anomali
    WHERE "pelangganId" = ${pelangganId} AND koordinat IS NOT NULL`
  const titikPerId = new Map(titik.map((t) => [t.id, t]))

  const tunggakan = await prisma.tagihan.findFirst({
    where: { pelangganId },
    select: { jumlahRekTunggak: true, nominalTunggak: true, periode: true },
    orderBy: { periode: "desc" },
  })

  return {
    pelanggan,
    tunggakan: {
      jumlahRekening: tunggakan?.jumlahRekTunggak ?? 0,
      nominal: tunggakan?.nominalTunggak ? Number(tunggakan.nominalTunggak) : 0,
    },
    pembacaan: pembacaan.map((p) => ({
      ...p,
      periode: dateToPeriode(p.periode),
    })),
    kunjungan: kunjungan.map((k) => ({
      ...k,
      latitude: titikPerId.get(k.id)?.lat ?? null,
      longitude: titikPerId.get(k.id)?.lon ?? null,
    })),
    laporanLapangan,
  }
}

export const KONDISI_DIPANTAU = KONDISI_TIDAK_TERUKUR
