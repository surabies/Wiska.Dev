// server/modules/closing/bulan-baru.service.ts — BUKA BULAN BARU: menerbitkan
// Daftar Catat (DPM) periode berikutnya.
//
// INI PASANGAN DARI CLOSING. Closing menutup bulan; berkas ini membukanya
// lagi. Tanpa keduanya siklus bulanan tidak berputar: aplikasi bisa mengunci
// Mei tapi tidak bisa menyiapkan pekerjaan Juni, dan operator harus kembali
// ke Aurora — persis yang ingin kita hentikan.
//
// ATURAN YANG DIPAKAI:
//
//     DPM(N+1) = [ DaftarCatat(N) ∪ yang BERTAGIHAN pada N ]
//                − yang ditandai DICABUT pada DPM(N)
//
// lalu, SELAMA bulan N+1 berjalan, impor PBPK menambahkan sambungan baru ke
// DPM(N+1) — itu satu-satunya pintu masuk, dan bukan urusan berkas ini.
//
// BASISNYA PER-PERIODE, BUKAN MASTER PELANGGAN. Versi sebelumnya memakai
// SELURUH tabel `Pelanggan` dikurangi yang PERNAH dicabut. Itu keliru dua
// kali, dan keduanya terukur pada data nyata jan–juli 2026:
//
//   1. Tabel `Pelanggan` bersifat AKUMULATIF — ia menampung semua yang
//      pernah ada dan tidak pernah menyusut kecuali lewat penanda DICABUT.
//      Akibatnya DPM kelebihan 27–62 sambungan SETIAP BULAN:
//
//          periode   basis master   seharusnya   kelebihan
//          202602        22.621       22.559        +62
//          202603        22.595       22.537        +58
//          202604        22.585       22.542        +43
//          202605        22.566       22.534        +32
//          202606        22.547       22.520        +27
//
//   2. "PERNAH dicabut sampai N" juga akumulatif, jadi sambungan yang
//      dipasang kembali (mutasi "Pembukaan Kembali PS/SPT" — nyata ada di
//      PEL202604, PEL202606, dan ProgresCater April) terkunci keluar dari
//      SELURUH daftar berikutnya, diam-diam.
//
// KENAPA DULU DIKIRA HARUS MASTER, dan kenapa itu salah alamat. Alasan yang
// tertulis di versi lama: menurunkan dari daftar bulan lalu "bocor" 156
// sambungan di Maret dan 34 di April. Kebocorannya NYATA, tapi letaknya di
// berkas `lapdatameter` (daftar kerja Aurora), bukan pada aturannya.
// Diperiksa baris per baris, yang hilang itu:
//
//     Maret : 157 sambungan, terkumpul di rute TA607 (84) & KC202 (68),
//             petugas DANI & DIDIN — 156 di antaranya TETAP DITAGIH bulan
//             itu juga, dan 156 kembali ke daftar April.
//     April :  34 sambungan, SELURUHNYA rute KC302, petugas DIDIN —
//             34/34 tetap ditagih, dan semuanya kembali di Mei.
//
// Rute utuh menghilang satu bulan lalu kembali sementara pelanggannya tetap
// ditagih normal: itu celah unggah/ekspor berkas harian per rute, bukan
// populasi yang berubah. Membuang cakupan per-periode untuk menambalnya
// berarti menukar satu gejala dengan kelebihan permanen.
//
// Suku `∪ yang BERTAGIHAN pada N` menambal celah itu TANPA kehilangan
// cakupan periode: sambungan yang jatuh dari daftar kerja tapi tetap
// ditagih akan ditarik kembali dengan sendirinya, dan dilaporkan lewat kode
// DIPULIHKAN_DARI_TAGIHAN supaya pemulihannya terlihat.
//
// BUKTINYA. Siklus mei→juni→juli disimulasikan dari daftar catat Mei lalu
// dibandingkan ANGGOTA PER ANGGOTA dengan berkas Aurora asli:
//
//     periode   DPM hasil / acuan      DRD hasil / acuan
//     202605    22.553 / 22.553  ✓     22.523 / 22.523  ✓
//     202606    22.539 / 22.539  ✓     22.515 / 22.515  ✓
//     202607    22.531 / 22.531  ✓     22.511 / 22.511  ✓
//
// Enam perbandingan himpunan, semuanya nol lebih & nol kurang.
//
// KENAPA RUTE & PENCATAT DI-SNAPSHOT ULANG, BUKAN DISALIN DARI BULAN LALU:
// DaftarCatat menyimpan rute & pencatat SAAT DAFTAR DIBEKUKAN. Saat membuka
// bulan baru, penugasan yang berlaku adalah penugasan HARI INI — itulah
// sebabnya Aurora menjalankan "Update zonasi" tepat sebelum "Create Bulan
// baru". Menyalin dari bulan lalu akan membuat perubahan rute tidak pernah
// sampai ke lapangan, dan 11 PBPK yang bulan lalu berpetugas "-" akan tetap
// tak berpetugas selamanya — padahal justru bulan inilah mereka pertama kali
// masuk beban kerja.

import type { Prisma } from "@db"
import { prisma } from "@db"
import { BadRequestError, ConflictError } from "../../lib/errors"
import { recordAudit } from "../../lib/audit"
import { periodeToDate } from "../../lib/periode"
import type { HambatanClosing, JejakAudit } from "./closing.service"

/// Sama alasannya dengan UKURAN_BATCH di closing.service.ts: 22 ribu insert
/// satu per satu ke Postgres terkelola makan waktu berjam-jam.
const UKURAN_BATCH = 1000

/// Maksimal nomor langganan yang dicantumkan per hambatan — sama dengan
/// closing.service.ts supaya tampilannya seragam.
const MAKS_CONTOH = 20

/// TIDAK ADA daftar "status pelanggan yang tidak ikut", dan itu kesimpulan,
/// bukan kelalaian.
///
/// TUTUP_SEMENTARA, DISEGEL, dan TUTUP_SPT tetap ikut: pada data nyata
/// sambungan berstatus tutup TETAP dikunjungi petugas (tetap pekerjaan) dan
/// tetap terbit tagihannya, jadi mengeluarkannya justru menghilangkan
/// pekerjaan yang benar-benar ada. Yang mengeluarkan sebuah sambungan dari
/// daftar HANYALAH kejadian dicabut pada periode itu — bukan statusnya.
export function periodeBerikutnya(periode: number): number {
  const tahun = Math.floor(periode / 100)
  const bulan = periode % 100
  return bulan === 12 ? (tahun + 1) * 100 + 1 : tahun * 100 + (bulan + 1)
}

export interface PratinjauBulanBaru {
  periodeSumber: number
  periodeBaru: number
  /// Isi DPM periode sumber, per status.
  sumber: { total: number; perStatus: Record<string, number> }
  /// Sudah adakah DPM periode baru, dan sudah bergerakkah isinya.
  tujuan: { sudahAda: number; sudahBergerak: number }
  /// Perkiraan hasil bila dijalankan sekarang.
  ///
  /// PERHATIAN pemakai: `tanpaPencatat` adalah SUPERSET dari `tanpaRute` —
  /// sambungan tanpa rute otomatis juga tanpa pencatat. Jadi jangan
  /// menjumlahkan keduanya; `tanpaPencatat` sudah merupakan total "belum ada
  /// yang bertanggung jawab".
  perkiraan: { akanDibuat: number; tanpaRute: number; tanpaPencatat: number }
  hambatan: HambatanClosing[]
  bisaDibuka: boolean
}

interface BarisCalon {
  pelangganId: string
  nomorLangganan: string
  ruteId: string | null
  pencatatId: string | null
  urutan: number
}

interface HasilHitung {
  calon: BarisCalon[]
  hambatan: HambatanClosing[]
  sumberTotal: number
  sumberPerStatus: Record<string, number>
}

/// Menghitung isi DPM periode berikutnya. MURNI MEMBACA — tidak menulis
/// apa pun. Dipakai oleh pratinjau maupun eksekusi, supaya angka yang
/// ditampilkan ke operator dan angka yang benar-benar ditulis berasal dari
/// satu jalur yang sama.
///
/// DIEKSPOR untuk `scripts/cek-siklus.ts`, yang membandingkan ANGGOTA daftar
/// (bukan cuma jumlahnya) dengan berkas Aurora asli. Pratinjau hanya
/// mengembalikan angka, dan angka yang benar bisa saja tersusun dari orang
/// yang salah — justru itu yang perlu dibuktikan tidak terjadi.
export async function hitungCalon(periodeSumber: number): Promise<HasilHitung> {
  // BASIS: daftar catat periode sumber, DIGABUNG dengan siapa saja yang
  // benar-benar bertagihan pada periode itu. Cakupannya PER-PERIODE — bukan
  // seluruh tabel Pelanggan (lihat kepala berkas untuk angka kelebihannya).
  const [barisSumber, bertagihan] = await Promise.all([
    prisma.daftarCatat.findMany({
      where: { periode: periodeSumber },
      select: {
        pelangganId: true,
        status: true,
        ruteId: true,
        pencatatId: true,
        pelanggan: {
          select: {
            id: true,
            nomorLangganan: true,
            ruteId: true,
            noUrutRute: true,
            deletedAt: true,
          },
        },
      },
    }),
    // SUKU PENAMBAL. Sambungan yang jatuh dari daftar kerja tapi tetap
    // ditagih (celah unggah per rute — 156 di Maret, 34 di April pada data
    // Aurora nyata) ditarik kembali dari sini. Tanpa suku ini, sekali sebuah
    // rute gagal terunggah, seluruh pelanggannya lenyap dari daftar kerja
    // SELAMANYA meski tagihannya terus terbit.
    prisma.tagihan.findMany({
      where: { periode: periodeToDate(periodeSumber) },
      select: {
        pelanggan: {
          select: {
            id: true,
            nomorLangganan: true,
            ruteId: true,
            noUrutRute: true,
            deletedAt: true,
          },
        },
      },
    }),
  ])

  const sumberPerStatus: Record<string, number> = {}
  const dpmSumber = new Map<string, (typeof barisSumber)[number]>()
  for (const b of barisSumber) {
    sumberPerStatus[b.status] = (sumberPerStatus[b.status] ?? 0) + 1
    dpmSumber.set(b.pelangganId, b)
  }

  // DICABUT dibaca HANYA dari periode sumber, bukan dari seluruh riwayat.
  // Cakupan per-periode membuat akumulasi itu tidak perlu — yang dicabut
  // bulan lalu sudah tidak ada di DaftarCatat(N) maupun di tagihan N, jadi
  // ia tidak akan pernah masuk calon. Sekaligus ini memulihkan sambungan
  // yang DIPASANG KEMBALI: dengan aturan "pernah dicabut", mutasi
  // "Pembukaan Kembali PS/SPT" terkunci keluar selamanya.
  const dicabut = new Set<string>()
  for (const b of barisSumber)
    if (b.status === "DICABUT") dicabut.add(b.pelangganId)

  // Gabungan basis. Map supaya satu pelanggan tepat satu calon, dan supaya
  // baris daftar catat (yang punya snapshot rute/petugas) menang atas baris
  // yang hanya ditemukan lewat tagihan.
  type Induk = (typeof barisSumber)[number]["pelanggan"]
  const basis = new Map<string, { pelanggan: Induk; dariDaftar: boolean }>()
  for (const b of barisSumber)
    basis.set(b.pelangganId, { pelanggan: b.pelanggan, dariDaftar: true })
  for (const t of bertagihan) {
    if (!basis.has(t.pelanggan.id))
      basis.set(t.pelanggan.id, { pelanggan: t.pelanggan, dariDaftar: false })
  }

  // Penugasan rute -> pencatat dimuat SEKALI. Satu rute bisa punya lebih dari
  // satu pencatat (model PenugasanRute unik pada pasangan, bukan pada rute),
  // jadi pilihannya dibuat DETERMINISTIK: urutan terkecil, lalu id terkecil.
  // Rute yang berpencatat ganda dilaporkan sebagai hambatan supaya
  // pemilihannya tidak diam-diam.
  const penugasan = await prisma.penugasanRute.findMany({
    select: { ruteId: true, pencatatId: true, urutan: true },
    orderBy: [{ urutan: "asc" }, { pencatatId: "asc" }],
  })
  const pencatatPerRute = new Map<string, string>()
  const ruteGanda = new Set<string>()
  for (const p of penugasan) {
    if (pencatatPerRute.has(p.ruteId)) ruteGanda.add(p.ruteId)
    else pencatatPerRute.set(p.ruteId, p.pencatatId)
  }

  const calon: BarisCalon[] = []
  const terkena = {
    dicabut: [] as string[],
    tanpaRute: [] as string[],
    tanpaPencatat: [] as string[],
    pencatatCadangan: [] as string[],
    pulih: [] as string[],
  }
  const jumlah = {
    dicabut: 0,
    tanpaRute: 0,
    tanpaPencatat: 0,
    pencatatCadangan: 0,
    pulih: 0,
  }
  const catat = (kunci: keyof typeof terkena, nomor: string) => {
    jumlah[kunci]++
    if (terkena[kunci].length < MAKS_CONTOH) terkena[kunci].push(nomor)
  }

  for (const { pelanggan: p, dariDaftar } of basis.values()) {
    const b = dpmSumber.get(p.id)

    // Satu-satunya pintu keluar: ditandai DICABUT pada periode sumber.
    if (dicabut.has(p.id)) {
      catat("dicabut", p.nomorLangganan)
      continue
    }
    // Pelanggan yang sudah dihapus (soft delete) tidak dibawa ke bulan baru.
    // Baris daftar catat lamanya tetap ada sebagai sejarah — yang berhenti
    // hanyalah penugasan kerja berikutnya.
    if (p.deletedAt) continue
    // Bertagihan pada periode sumber tapi TIDAK ADA di daftar kerjanya —
    // inilah celah unggah per rute (156 di Maret, 34 di April pada data
    // Aurora nyata). Ditarik kembali, dan DILAPORKAN supaya pemulihannya
    // terlihat, bukan diam-diam.
    if (!dariDaftar) catat("pulih", p.nomorLangganan)

    // Penugasan pencatat, dua tingkat:
    //   1. PenugasanRute yang berlaku hari ini — sumber resminya.
    //   2. CADANGAN: pencatat dari daftar bulan lalu, TAPI hanya bila rute
    //      pelanggan tidak berubah. Ini bukan kemewahan: di database ini
    //      PenugasanRute baru mencakup sebagian kecil rute, sementara daftar
    //      bulan lalu punya petugas untuk hampir semua baris. Tanpa cadangan
    //      ini, membuka bulan baru akan MENGOSONGKAN penugasan puluhan ribu
    //      SL — memperburuk keadaan, bukan memperbaikinya. Bila rutenya
    //      berubah, cadangan TIDAK dipakai: petugas lama belum tentu
    //      memegang rute yang baru.
    let pencatatId = p.ruteId ? (pencatatPerRute.get(p.ruteId) ?? null) : null
    let dariCadangan = false
    if (!pencatatId && p.ruteId && b?.pencatatId && b.ruteId === p.ruteId) {
      pencatatId = b.pencatatId
      dariCadangan = true
    }

    if (!p.ruteId) catat("tanpaRute", p.nomorLangganan)
    else if (!pencatatId) catat("tanpaPencatat", p.nomorLangganan)
    else if (dariCadangan) catat("pencatatCadangan", p.nomorLangganan)

    calon.push({
      pelangganId: p.id,
      nomorLangganan: p.nomorLangganan,
      ruteId: p.ruteId,
      pencatatId,
      urutan: p.noUrutRute ?? 0,
    })
  }

  const hambatan: HambatanClosing[] = []
  if (jumlah.dicabut > 0) {
    hambatan.push({
      kode: "KELUAR_DICABUT",
      pesan:
        "Dicabut pada periode sumber — sesuai aturan DPM mereka TIDAK ikut ke bulan baru. Ini yang diharapkan, bukan masalah",
      jumlah: jumlah.dicabut,
      contoh: terkena.dicabut,
    })
  }
  if (jumlah.pulih > 0) {
    hambatan.push({
      kode: "DIPULIHKAN_DARI_TAGIHAN",
      pesan:
        "BERTAGIHAN pada periode sumber tetapi TIDAK ADA di daftar catatnya — ditarik kembali supaya tidak hilang dari daftar kerja. Ini menandakan daftar catat periode sumber tidak lengkap (pada data Aurora nyata satu rute utuh bisa gagal terunggah: 156 sambungan di Maret, 34 di April); periksa rute mereka",
      jumlah: jumlah.pulih,
      contoh: terkena.pulih,
    })
  }
  if (jumlah.tanpaRute > 0) {
    hambatan.push({
      kode: "TANPA_RUTE",
      pesan:
        "Belum punya rute — tetap masuk daftar, tetapi tidak akan muncul di beban kerja pencatat mana pun sampai rutenya diisi",
      jumlah: jumlah.tanpaRute,
      contoh: terkena.tanpaRute,
    })
  }
  if (jumlah.tanpaPencatat > 0) {
    hambatan.push({
      kode: "RUTE_TANPA_PENCATAT",
      pesan:
        "Rutenya belum ditugaskan ke pencatat mana pun — tetap masuk daftar, tetapi belum ada yang bertanggung jawab mengunjunginya",
      jumlah: jumlah.tanpaPencatat,
      contoh: terkena.tanpaPencatat,
    })
  }
  if (jumlah.pencatatCadangan > 0) {
    hambatan.push({
      kode: "PENCATAT_DARI_BULAN_LALU",
      pesan:
        "Rutenya belum punya PenugasanRute resmi, jadi petugasnya diwarisi dari daftar bulan lalu (rutenya tidak berubah). Daftar kerjanya benar, tetapi penugasan resmi di Data Induk sebaiknya dilengkapi supaya tidak bergantung pada warisan",
      jumlah: jumlah.pencatatCadangan,
      contoh: terkena.pencatatCadangan,
    })
  }
  if (ruteGanda.size > 0) {
    hambatan.push({
      kode: "RUTE_BERPENCATAT_GANDA",
      pesan:
        "Rute ini ditugaskan ke lebih dari satu pencatat — daftar bulan baru memilih yang urutan penugasannya terkecil. Periksa penugasan rutenya bila itu bukan yang dimaksud",
      jumlah: ruteGanda.size,
      contoh: [],
    })
  }

  return { calon, hambatan, sumberTotal: barisSumber.length, sumberPerStatus }
}

export async function pratinjauBulanBaru(
  periodeSumber: number,
): Promise<PratinjauBulanBaru> {
  const periodeBaru = periodeBerikutnya(periodeSumber)

  const [periodeRow, hasil, sudahAda, sudahBergerak] = await Promise.all([
    prisma.periodePenagihan.findUnique({ where: { periode: periodeSumber } }),
    hitungCalon(periodeSumber),
    prisma.daftarCatat.count({ where: { periode: periodeBaru } }),
    prisma.daftarCatat.count({
      where: { periode: periodeBaru, status: { not: "BELUM_DICATAT" } },
    }),
  ])

  const hambatan = [...hasil.hambatan]
  let bisaDibuka = true

  if (hasil.sumberTotal === 0) {
    hambatan.push({
      kode: "SUMBER_KOSONG",
      pesan: `Periode ${periodeSumber} belum punya daftar catat sama sekali — tidak ada yang bisa diturunkan`,
      jumlah: 0,
      contoh: [],
    })
    bisaDibuka = false
  }
  if (periodeRow?.status !== "TERKUNCI") {
    hambatan.push({
      kode: "SUMBER_BELUM_DITUTUP",
      pesan: `Periode ${periodeSumber} belum ditutup. Daftar bulan baru diturunkan dengan mengeluarkan sambungan yang DICABUT pada periode sumber, dan itu baru pasti setelah periodenya dikunci — tutup ${periodeSumber} lebih dulu`,
      jumlah: 0,
      contoh: [],
    })
    bisaDibuka = false
  }
  if (sudahBergerak > 0) {
    hambatan.push({
      kode: "TUJUAN_SUDAH_BERJALAN",
      pesan: `Daftar catat ${periodeBaru} sudah dipakai bekerja (ada baris yang statusnya bukan BELUM_DICATAT) — menerbitkan ulang akan menghapus pekerjaan itu, jadi ditolak`,
      jumlah: sudahBergerak,
      contoh: [],
    })
    bisaDibuka = false
  }

  return {
    periodeSumber,
    periodeBaru,
    sumber: { total: hasil.sumberTotal, perStatus: hasil.sumberPerStatus },
    tujuan: { sudahAda, sudahBergerak },
    perkiraan: {
      akanDibuat: hasil.calon.length,
      tanpaRute: hasil.calon.filter((c) => !c.ruteId).length,
      tanpaPencatat: hasil.calon.filter((c) => !c.pencatatId).length,
    },
    hambatan,
    bisaDibuka,
  }
}

export interface BukaBulanBaruInput {
  /// Periode SUMBER (N). Yang diterbitkan adalah daftar catat N+1.
  periode: number
  olehUserId: string
  jejak?: JejakAudit
}

export interface HasilBukaBulanBaru {
  periodeSumber: number
  periodeBaru: number
  dibuat: number
  tanpaRute: number
  tanpaPencatat: number
  hambatan: HambatanClosing[]
}

export async function bukaBulanBaru(
  input: BukaBulanBaruInput,
): Promise<HasilBukaBulanBaru> {
  const periodeSumber = input.periode
  const periodeBaru = periodeBerikutnya(periodeSumber)

  // Prasyarat diperiksa DI SINI juga, bukan hanya di pratinjau. Pratinjau
  // adalah alat bantu operator; ia bisa saja dimuat beberapa menit sebelum
  // tombol ditekan, dan keadaannya bisa berubah di antara keduanya.
  const periodeRow = await prisma.periodePenagihan.findUnique({
    where: { periode: periodeSumber },
  })
  if (periodeRow?.status !== "TERKUNCI") {
    throw new ConflictError(
      `Periode ${periodeSumber} belum ditutup — tutup periodenya lebih dulu sebelum membuka ${periodeBaru}. Daftar bulan baru mengeluarkan sambungan yang dicabut pada periode sumber, dan itu baru pasti setelah periode dikunci.`,
    )
  }

  const sudahBergerak = await prisma.daftarCatat.count({
    where: { periode: periodeBaru, status: { not: "BELUM_DICATAT" } },
  })
  if (sudahBergerak > 0) {
    throw new ConflictError(
      `Daftar catat ${periodeBaru} sudah dipakai bekerja (${sudahBergerak} baris sudah berstatus selain BELUM_DICATAT) — menerbitkan ulang akan menghapus pekerjaan itu.`,
    )
  }

  const { calon, hambatan, sumberTotal } = await hitungCalon(periodeSumber)
  if (sumberTotal === 0) {
    throw new BadRequestError(
      `Periode ${periodeSumber} belum punya daftar catat sama sekali — tidak ada yang bisa diturunkan ke ${periodeBaru}.`,
    )
  }
  if (calon.length === 0) {
    throw new BadRequestError(
      `Tidak ada satu pun sambungan yang layak dibawa ke ${periodeBaru} dari ${periodeSumber}.`,
    )
  }

  // Hapus-lalu-tulis, BUKAN upsert per baris. Dua alasannya:
  //   1. Snapshot rute/pencatat harus benar-benar mencerminkan penugasan saat
  //      ini; upsert yang hanya membuat baris baru akan meninggalkan snapshot
  //      basi pada baris yang sudah ada dari percobaan sebelumnya.
  //   2. 22 ribu upsert satu per satu ke Postgres terkelola makan waktu
  //      berjam-jam (pelajaran dari skrip seed).
  // Aman karena penjagaan di atas sudah memastikan TIDAK ADA baris periode
  // baru yang sudah bergerak — yang dihapus hanyalah daftar yang belum
  // disentuh siapa pun. Karena itu pula operasi ini aman diulang.
  await prisma.daftarCatat.deleteMany({ where: { periode: periodeBaru } })

  let dibuat = 0
  for (let mulai = 0; mulai < calon.length; mulai += UKURAN_BATCH) {
    const kelompok = calon.slice(mulai, mulai + UKURAN_BATCH)
    const data: Prisma.DaftarCatatCreateManyInput[] = kelompok.map((c) => ({
      periode: periodeBaru,
      pelangganId: c.pelangganId,
      ruteId: c.ruteId,
      pencatatId: c.pencatatId,
      urutan: c.urutan,
      // Semua baris di sini berasal dari daftar periode sebelumnya — termasuk
      // PBPK, yang pada periode ini sudah "lulus" menjadi sambungan biasa.
      sumber: "CARRY_OVER",
      status: "BELUM_DICATAT",
    }))
    const res = await prisma.daftarCatat.createMany({
      data,
      skipDuplicates: true,
    })
    dibuat += res.count
  }

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      userId: input.olehUserId,
      aksi: "BUKA_BULAN_BARU",
      entitas: "DaftarCatat",
      entitasId: String(periodeBaru),
      perubahan: {
        periodeSumber,
        periodeBaru,
        dibuat,
        dariTotalSumber: sumberTotal,
        tanpaRute: calon.filter((c) => !c.ruteId).length,
        tanpaPencatat: calon.filter((c) => !c.pencatatId).length,
      },
      ipAddress: input.jejak?.ipAddress ?? null,
      userAgent: input.jejak?.userAgent ?? null,
    })
  })

  return {
    periodeSumber,
    periodeBaru,
    dibuat,
    tanpaRute: calon.filter((c) => !c.ruteId).length,
    tanpaPencatat: calon.filter((c) => !c.pencatatId).length,
    hambatan,
  }
}
