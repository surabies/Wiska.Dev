// Shared domain rules for detecting unmeasured customer connections.
//
// MASALAH YANG DIJAWAB. Meter yang tidak terbaca tidak diukur — ia ditebak.
// Pada data nyata jan-juni 2026, 44-47% dari SELURUH pembacaan tiap bulan
// adalah taksiran, bukan angka yang benar-benar dibaca petugas. Untuk
// sambungan yang tidak terbaca tiga bulan berturut-turut, 118.053 m3 ditagih
// sementara hanya 43 m3 yang benar-benar terukur.
//
// Itu bukan kesalahan pencatatan yang bisa diperbaiki di meja. Satu-satunya
// jalan keluarnya adalah orang mendatangi rumahnya. Modul ini menentukan
// RUMAH MANA yang didatangi lebih dulu.
//
// TIGA KATEGORI, KARENA RISIKONYA BERBEDA ARAH — dan itu yang menentukan
// tindakan, bukan sekadar label:
//
//   TERKUNCI      Rumah berpenghuni, meternya tidak bisa dijangkau.
//                 Risikonya KURANG TAGIH: keluarga memakai 30 m3, ditagih
//                 10 m3 taksiran. Tindakannya datang di jam lain, janji
//                 temu, atau memindahkan meter ke luar pagar.
//
//   DIDUGA_KOSONG Rumah diduga benar-benar tidak berpenghuni.
//                 Risikonya LEBIH TAGIH: rumah kosong ditagih minimum
//                 bertahun-tahun, menumpuk jadi piutang yang tidak akan
//                 pernah tertagih. Tindakannya memverifikasi lalu menutup
//                 sementara bila benar kosong.
//
//   METER_RUSAK   Meternya ada tapi angkanya tidak bisa dipercaya.
//                 Tindakannya penggantian meter, bukan negosiasi dengan
//                 penghuni.
//
// Menyatukan ketiganya jadi satu daftar "anomali" akan membuat petugas
// menerima 3.840 alamat tanpa tahu harus berbuat apa di masing-masing.

/// Kondisi catat yang berarti ANGKA METER TIDAK TERBACA, dikelompokkan
/// menurut tindakan yang dibutuhkan.
///
/// Nilai-nilainya sengaja `string` biasa, bukan enum Prisma: modul ini
/// can be used by the server, browser, and React Native without loading Prisma.
export const KONDISI_ANOMALI = {
  TERKUNCI: ["DK", "TERHALANG", "ADA_ANJING"],
  DIDUGA_KOSONG: ["RUMAH_KOSONG", "TIDAK_DIPAKAI"],
  METER_RUSAK: [
    "METER_RUSAK",
    "METER_MATI_ADA_AIR",
    "METER_MUNDUR",
    "METER_TERBALIK",
    "METER_DALAM_AIR",
    "LOS_METER",
    "BMK_BMB",
    "TTB",
    "MTA",
    "MB",
  ],
} as const

export type KategoriAnomali = keyof typeof KONDISI_ANOMALI

export const SEMUA_KATEGORI = Object.keys(KONDISI_ANOMALI) as KategoriAnomali[]

/// Seluruh kondisi yang dianggap "tidak terukur", tanpa memandang kategori.
export const KONDISI_TIDAK_TERUKUR: readonly string[] = SEMUA_KATEGORI.flatMap(
  (k) => KONDISI_ANOMALI[k] as readonly string[],
)

export function kategoriDariKondisi(kondisi: string): KategoriAnomali | null {
  for (const k of SEMUA_KATEGORI) {
    if ((KONDISI_ANOMALI[k] as readonly string[]).includes(kondisi)) return k
  }
  return null
}

/// Istilah kondisi catat PERSIS seperti dipakai perusahaan, diambil dari
/// kolom `Nm_Kel` berkas sumber — BUKAN terjemahan baru. Petugas dan
/// pimpinan sudah memakai singkatan ini setiap hari; memperkenalkan istilah
/// sendiri hanya memaksa mereka menerjemahkan balik.
export const LABEL_KONDISI: Record<string, string> = {
  DK: "DK",
  TERHALANG: "TERHALANG",
  ADA_ANJING: "ADA ANJING",
  TIDAK_DIPAKAI: "TIDAK DIPAKAI",
  RUMAH_KOSONG: "RMH/TANAH KSG",
  MTA: "MTA",
  MB: "MB",
  TTB: "TTB",
  BMK_BMB: "BMK/BMB",
  METER_MATI_ADA_AIR: "METER MATI AIR ADA",
  METER_RUSAK: "METER RUSAK",
  LOS_METER: "LOS METER",
  METER_MUNDUR: "METER MUNDUR",
  METER_TERBALIK: "METER TERBALIK",
  METER_DALAM_AIR: "METER DALAM AIR",
}

/// LABEL WAJIB MENYEBUT SELURUH ISI KATEGORINYA.
///
/// Versi sebelumnya menulis TERKUNCI sebagai "Rumah Dikunci (DK)" — dan itu
/// berbohong: kategorinya juga memuat TERHALANG dan ADA ANJING. Orang yang
/// menyaring dengan label itu wajar menyimpulkan hasilnya berisi DK saja,
/// lalu melihat baris TERHALANG di dalamnya dan menyimpulkan saringannya
/// rusak — padahal yang salah kalimatnya, bukan penyaringnya. Untuk memilih
/// SATU kondisi saja tersedia saringan kondisi terpisah (OpsiDaftar.kondisi).
export const LABEL_KATEGORI: Record<KategoriAnomali, string> = {
  TERKUNCI: "Terkunci / tak terjangkau",
  DIDUGA_KOSONG: "Diduga kosong",
  METER_RUSAK: "Meter tak terbaca",
}

/// Label kategori + isi kondisinya, untuk tempat yang punya ruang menjelaskan
/// (dropdown saringan). "Terkunci / tak terjangkau (DK, TERHALANG, ADA ANJING)".
export function labelKategoriLengkap(k: KategoriAnomali): string {
  const isi = (KONDISI_ANOMALI[k] as readonly string[])
    .map((kode) => LABEL_KONDISI[kode] ?? kode)
    .join(", ")
  return `${LABEL_KATEGORI[k]} (${isi})`
}

/// Hasil kunjungan dalam bahasa manusia. Cerminan enum
/// `HasilKunjunganAnomali` di prisma/schema/operasional.prisma — bila salah satunya
/// berubah, yang lain WAJIB ikut.
///
/// Ada di sini, bukan di layar yang menampilkannya, karena teks yang sama
/// muncul di dua tempat yang harus sepakat: petugas MEMILIH hasilnya di
/// aplikasi, staf kantor MEMBACA hasil itu di dasbor. Kalau keduanya menyimpan
/// kata-katanya sendiri, keduanya akan menyimpang tanpa ada yang sadar.
export const LABEL_HASIL: Record<string, string> = {
  BERTEMU_TERBACA: "Bertemu & meter terbaca",
  BERTEMU_TIDAK_TERBACA: "Bertemu, meter tak terbaca",
  TETAP_TERKUNCI: "Tetap terkunci",
  KOSONG_TERKONFIRMASI: "Terkonfirmasi kosong",
  METER_DIPINDAH: "Meter dipindah",
  PERLU_GANTI_METER: "Perlu ganti meter",
  USUL_TUTUP_SEMENTARA: "Usul tutup sementara",
  ALAMAT_TIDAK_DITEMUKAN: "Alamat tidak ditemukan",
}

export const RISIKO_KATEGORI: Record<KategoriAnomali, string> = {
  TERKUNCI:
    "Berisiko KURANG tagih — pemakaian nyata bisa jauh di atas taksiran",
  DIDUGA_KOSONG: "Berisiko LEBIH tagih — menumpuk piutang yang sulit tertagih",
  METER_RUSAK: "Angka meter tidak bisa dipercaya — perlu penggantian",
}

/// Penjelasan lengkap tiap kategori, ditulis untuk DIBACAKAN saat presentasi
/// ke pimpinan — bukan sebagai keterangan teknis. Tiap bagian menjawab satu
/// pertanyaan yang pasti muncul di ruang rapat.
export interface PenjelasanKategori {
  /// Apa yang sebenarnya terjadi di lapangan.
  apa: string
  /// Kenapa ini merugikan perusahaan — dalam bahasa uang, bukan teknis.
  kenapaPenting: string
  /// Apa yang dilakukan petugas saat mendatanginya.
  tindakan: string
  /// Kode kondisi catat yang termasuk kategori ini, dengan istilah perusahaan.
  kondisi: readonly string[]
}

export const PENJELASAN_KATEGORI: Record<KategoriAnomali, PenjelasanKategori> =
  {
    TERKUNCI: {
      apa: "Petugas datang, tetapi rumahnya terkunci atau meternya tidak bisa dijangkau — terhalang bangunan, tertutup, atau dijaga anjing. Rumahnya BERPENGHUNI; yang tidak bisa dilakukan hanyalah membaca angkanya.",
      kenapaPenting:
        "Karena angkanya tidak terbaca, tagihannya dihitung dari perkiraan. Keluarga yang memakai 30 m³ bisa tertagih 10 m³ selama berbulan-bulan — selisihnya adalah pendapatan yang tidak pernah masuk. Saat meternya akhirnya terbaca, seluruh selisih itu muncul sekaligus sebagai satu tagihan besar yang sulit dijelaskan dan kerap berujung keberatan pelanggan.",
      tindakan:
        "Datangi di jam berbeda (sore/akhir pekan), buat janji dengan penghuni, atau usulkan pemindahan meter ke luar pagar supaya bulan-bulan berikutnya terbaca sendiri.",
      kondisi: ["DK", "TERHALANG", "ADA ANJING"],
    },
    DIDUGA_KOSONG: {
      apa: "Petugas mencatat rumahnya tidak berpenghuni atau sambungannya tidak dipakai. Berbeda dari DK: di sini memang tidak ada orang, bukan tidak bisa masuk.",
      kenapaPenting:
        "Sambungan seperti ini tetap menerima tagihan minimum tiap bulan. Karena tidak ada yang membayar, tagihannya menumpuk jadi piutang yang kemungkinan besar tidak akan pernah tertagih — memperbesar angka tunggakan di laporan tanpa ada uang yang benar-benar bisa ditagih. Sebagian bahkan sudah lama ditinggalkan pemiliknya.",
      tindakan:
        "Verifikasi apakah benar kosong. Bila ya, usulkan tutup sementara supaya berhenti menerbitkan tagihan yang tidak akan tertagih; bila ternyata berpenghuni, kembalikan ke pencatatan normal.",
      kondisi: ["TIDAK DIPAKAI", "RMH/TANAH KSG"],
    },
    METER_RUSAK: {
      apa: "Meternya ada dan rumahnya terjangkau, tetapi angkanya tidak bisa dipercaya — meter mati sementara air mengalir, kaca buram, angka tidak bergerak, meter terbalik, atau terendam air.",
      kenapaPenting:
        "Ini kerugian dua arah yang tidak terlihat di laporan mana pun. Meter mati sementara air tetap mengalir berarti air terpakai tanpa tercatat sama sekali. Sebaliknya, meter rusak yang tetap ditagih taksiran bisa menagih pelanggan atas air yang tidak dipakainya. Keduanya baru ketahuan saat ada yang mengadu.",
      tindakan:
        "Periksa fisik meternya, lalu ajukan penggantian. Ini satu-satunya kategori yang penyelesaiannya bukan negosiasi dengan penghuni melainkan pekerjaan teknis.",
      kondisi: [
        "MTA",
        "MB",
        "TTB",
        "BMK/BMB",
        "METER MATI AIR ADA",
        "METER RUSAK",
        "LOS METER",
        "METER MUNDUR",
        "METER TERBALIK",
        "METER DALAM AIR",
      ],
    },
  }

/// Berapa bulan berturut-turut tidak terbaca sebelum sebuah sambungan masuk
/// daftar. Tiga dipilih dari data: dengan ambang 3 bulan, kategori TERKUNCI
/// menghasilkan 223 sambungan (162 di antaranya tanpa tunggakan) — beban
/// kerja yang bisa dituntaskan. Ambang 6 bulan hanya memangkasnya jadi 166,
/// jadi menaikkan ambang tidak banyak menolong sementara menurunkannya ke 2
/// akan menyapu sambungan yang cuma kebetulan terlewat sekali.
export const AMBANG_BULAN_DEFAULT = 3

export interface BarisRiwayat {
  /// thbl, mis. 202606. Diurutkan menurun oleh pemanggil (terbaru dulu).
  periode: number
  kondisi: string
  /// Pemakaian yang DITAGIHKAN periode itu.
  pemakaianM3: number
  /// Pemakaian yang benar-benar terbaca dari selisih stand. null = tidak
  /// tercatat (baris warisan sebelum kolom ini ada).
  pemakaianRiil: number | null
}

export interface HasilDeteksi {
  /// Kategori anomalinya, atau null bila sambungan ini TIDAK anomali.
  kategori: KategoriAnomali | null
  /// Berapa periode berturut-turut (dari yang terbaru) tidak terbaca.
  bulanBerturut: number
  /// Total m3 yang ditagih selama periode buta itu — inilah "paparan":
  /// jumlah air yang ditagihkan tanpa satu pun angka meter di belakangnya.
  m3TanpaDasar: number
  /// Skor pengurutan. Makin besar makin mendesak.
  skor: number
}

/// Menentukan apakah sebuah sambungan anomali, dari riwayat pembacaannya.
///
/// `riwayat` HARUS urut dari periode TERBARU ke terlama. Fungsi ini hanya
/// melihat deretan teratas yang tidak terputus — sambungan yang bulan lalu
/// akhirnya terbaca BUKAN anomali lagi, sekalipun setahun sebelumnya buta.
/// Itu disengaja: daftar ini adalah daftar kerja hari ini, bukan arsip.
///
/// Kategorinya diambil dari kondisi TERBARU, bukan yang terbanyak. Kalau
/// sebuah rumah dua bulan tercatat RUMAH_KOSONG lalu bulan ini DK, yang
/// relevan adalah temuan terakhir petugas di lapangan.
export function deteksiAnomali(
  riwayat: readonly BarisRiwayat[],
  ambangBulan: number = AMBANG_BULAN_DEFAULT,
): HasilDeteksi {
  let bulanBerturut = 0
  let m3TanpaDasar = 0
  for (const b of riwayat) {
    if (!KONDISI_TIDAK_TERUKUR.includes(b.kondisi)) break
    bulanBerturut++
    m3TanpaDasar += b.pemakaianM3
  }

  if (bulanBerturut < ambangBulan || riwayat.length === 0) {
    return { kategori: null, bulanBerturut, m3TanpaDasar, skor: 0 }
  }

  const kategori = kategoriDariKondisi(riwayat[0]!.kondisi)
  return {
    kategori,
    bulanBerturut,
    m3TanpaDasar,
    // PAPARAN, bukan sekadar lama. Sambungan yang buta 6 bulan dengan 40 m3
    // taksiran per bulan jauh lebih mendesak daripada yang buta 3 bulan
    // dengan 5 m3 — mengurutkan hanya dengan lama membuat yang kedua naik
    // ke atas hanya karena lebih lama diabaikan.
    skor: bulanBerturut * m3TanpaDasar,
  }
}

/// Apakah sambungan ini layak jadi PRIORITAS kunjungan.
///
/// Tanpa tunggakan = pelanggan membayar rutin, jadi tidak akan tersentuh
/// jalur penagihan maupun pemutusan. Ia tak terlihat oleh proses mana pun,
/// dan justru itu yang membuatnya perlu didatangi: satu-satunya cara ia
/// diperiksa adalah lewat daftar ini.
///
/// Yang PUNYA tunggakan sengaja diturunkan prioritasnya — bukan diabaikan.
/// Mereka sudah masuk radar penagihan, dan mengunjungi mereka lewat dua
/// jalur sekaligus memboroskan tenaga yang sama.
///
/// Sumber angkanya `Tagihan.jumlahRekTunggak` (kolom `jmlreknunggak` di
/// berkas sumber), BUKAN riwayat pembayaran — sistem ini belum menerima
/// umpan balik pembayaran dari PPOB, jadi seluruh tagihan selamanya
/// berstatus BELUM_BAYAR dan tidak bisa dipakai sebagai sinyal.
export function prioritasKunjungan(jumlahRekTunggak: number | null): boolean {
  return (jumlahRekTunggak ?? 0) === 0
}
