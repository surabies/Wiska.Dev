// src/lib/server/modules/laporan/harian/LaporanHarianPantau.service.ts —
// pemantauan progres harian per pencatat dan daftar pelanggan yang belum
// dibaca pada periode berjalan.
import type { Prisma } from "@db"
import { prisma } from "@db"
import { buildSkipTake, buildMeta } from "../../../lib/Pagination"
import type {
  ProgresLaporanQuery,
  BelumDibacaQuery,
} from "./LaporanHarian.schema"

// ── PROGRES HARIAN PER PENCATAT ──────────────────────────────────────────
//
// Menjawab pertanyaan penyelia yang tidak bisa dijawab tabel laporan maupun
// /stats: "hari ini siapa yang sudah menyetor, siapa yang diam, dan siapa
// yang belum mulai sama sekali". Tabel laporan menampilkan setoran yang
// MASUK; yang dicari di sini justru yang TIDAK masuk, per orang per hari.
//
// DUA SUMBER, DAN KEDUANYA WAJIB:
//   • DaftarCatat  = pembaginya. Satu baris per pelanggan per periode dengan
//     pencatat yang di-snapshot saat daftar dibekukan (lihat komentarnya di
//     operasional.prisma) — inilah "berapa yang HARUS dicatat orang ini".
//     Tanpa itu, 40 setoran sehari tidak bisa dibedakan antara hampir
//     selesai dan baru seperempat jalan.
//   • LaporanHarianPetugas = pembilangnya, dikelompokkan per TANGGAL.
//
// TANGGALNYA HARI WIB, bukan hari UTC. Setoran pukul 06.00 WIB masih
// tanggal kemarin menurut UTC, dan petugas yang berangkat subuh akan
// tercatat menyetor di hari yang salah — persis kekeliruan yang sudah
// diperbaiki pada saringan rentang tanggal di berkas ini.

/// Ambang "diam": setoran terakhir lebih lama dari ini (dalam hari, relatif
/// tanggal acuan) sementara pekerjaannya belum selesai. Tiga hari dipilih
/// supaya akhir pekan tidak langsung membunyikan alarm; angkanya ikut
/// dikirim ke layar supaya yang membaca tahu ambang apa yang dipakainya,
/// bukan menebak-nebak arti lencana merah.
export const AMBANG_DIAM_HARI = 3

/// JENIS HARI — dasar pewarnaan kolom tanggal di layar progres.
///
///   kerja       Senin–Jumat biasa.
///   akhirpekan  Sabtu/Minggu.
///   libur       Tanggal merah nasional (lihat KUNCI_LIBUR di bawah).
///   lembur      Hari libur/akhir pekan yang TERNYATA ADA SETORANNYA.
///
/// "lembur" DITURUNKAN, bukan dicatat: sistem ini tidak punya tabel lembur,
/// dan yang bisa dibuktikan datanya hanyalah "ada orang bekerja di hari
/// yang seharusnya libur". Kalau kelak lembur mulai diajukan & disetujui
/// lewat aplikasi, sumbernya tinggal diganti di sini — layar tidak perlu
/// tahu bedanya.
export type JenisHari = "kerja" | "akhirpekan" | "libur" | "lembur"

/// Tanggal merah nasional disimpan sebagai Konfigurasi, BUKAN tabel baru dan
/// bukan daftar tertanam di kode. Alasannya: daftarnya berubah tiap tahun,
/// ditetapkan SKB menteri, dan yang tahu tanggalnya bagian kepegawaian —
/// bukan orang yang bisa mengubah kode. Menanamkannya di kode juga berarti
/// tanggal yang salah menyamarkan hari kerja yang benar-benar bolong.
///
/// Format nilainya: tanggal ISO dipisah koma/spasi/baris baru, mis.
/// "2026-08-17, 2026-12-25". Kosong (atau kuncinya belum ada) = tidak ada
/// tanggal merah — layar tetap benar, hanya tanpa kolom oranye. Pola
/// "baca-kalau-ada, kalau tidak pakai bawaan" sama dengan
/// AMBANG_ANOMALI_PERSEN di berkas ini.
///
/// CARA MENGISINYA HARI INI: `PATCH /api/v1/konfigurasi/LIBUR_NASIONAL`
/// (role ADMIN). Halaman Administrasi → Konfigurasi masih HANYA-BACA — ia
/// menampilkan daftar kunci tanpa penyunting, jadi kunci ini belum bisa
/// diubah dari layar. Kalau kelak halaman itu diberi dialog sunting, kunci
/// ini ikut terlayani tanpa perubahan di sini.
export const KUNCI_LIBUR = "LIBUR_NASIONAL"

/// Hari WIB "hari ini". Dipakai membatasi kolom tanggal periode berjalan:
/// tanpa batas ini, sisa bulan yang BELUM TERJADI ikut tergambar sebagai
/// hari kerja tanpa setoran — dan seluruh petugas terlihat menunggak untuk
/// hari yang belum datang.
export function hariIniWib(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/// Seluruh tanggal periode (thbl) sampai batas, sebagai "YYYY-MM-DD".
export function tanggalPeriode(periode: number, sampai: string): string[] {
  const tahun = Math.floor(periode / 100)
  const bulan = periode % 100
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini.
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const hasil: string[] = []
  for (let h = 1; h <= hariTerakhir; h++) {
    const t = `${tahun}-${String(bulan).padStart(2, "0")}-${String(h).padStart(2, "0")}`
    if (t > sampai) break
    hasil.push(t)
  }
  return hasil
}

export async function progresPencatatLaporanHarian(query: ProgresLaporanQuery) {
  const { periode } = query

  const [
    perTanggal,
    targetPerPencatat,
    setorPerPencatat,
    pencatats,
    konfLibur,
  ] = await Promise.all([
    // Setoran per pencatat per TANGGAL WIB. Lewat raw SQL karena groupBy
    // Prisma tidak bisa mengelompokkan pada hasil konversi zona waktu.
    prisma.$queryRaw<
      Array<{ pencatatId: string | null; tanggal: string; jumlah: bigint }>
    >`
        SELECT "pencatatId",
               to_char(("tanggalCatat" AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD') AS tanggal,
               COUNT(*) AS jumlah
          FROM laporan_harian_petugas
         WHERE periode = ${periode} AND "tanggalCatat" IS NOT NULL
         GROUP BY 1, 2
         ORDER BY 2 ASC`,
    prisma.daftarCatat.groupBy({
      by: ["pencatatId"],
      where: { periode },
      _count: { _all: true },
    }),
    prisma.laporanHarianPetugas.groupBy({
      by: ["pencatatId"],
      where: { periode },
      _count: { _all: true },
    }),
    prisma.pencatat.findMany({
      where: { isAktif: true },
      select: { id: true, namaLapangan: true },
      orderBy: { namaLapangan: "asc" },
    }),
    prisma.konfigurasi.findUnique({ where: { kunci: KUNCI_LIBUR } }),
  ])

  const target = new Map(
    targetPerPencatat.map((t) => [t.pencatatId ?? "", t._count._all])
  )
  const setor = new Map(
    setorPerPencatat.map((t) => [t.pencatatId ?? "", t._count._all])
  )

  const harian = new Map<string, Map<string, number>>()
  const adaSetoran = new Set<string>()
  for (const b of perTanggal) {
    adaSetoran.add(b.tanggal)
    const kunci = b.pencatatId ?? ""
    let baris = harian.get(kunci)
    if (!baris) {
      baris = new Map()
      harian.set(kunci, baris)
    }
    baris.set(b.tanggal, Number(b.jumlah))
  }

  // SELURUH TANGGAL PERIODE, bukan hanya yang ada setorannya. Versi
  // pertama memakai tanggal-yang-punya-data, dan pada bulan yang setorannya
  // baru masuk sekali, grafik & tabelnya berisi SATU kolom — terbaca
  // seperti layar rusak, padahal justru itu kabarnya: 30 hari lain kosong.
  // Hari yang belum terjadi tetap dipotong (lihat hariIniWib).
  const batas = [hariIniWib(), ...adaSetoran].sort().at(-1)!
  const tanggal = tanggalPeriode(periode, batas)

  const liburNasional = new Set(
    (konfLibur?.nilai ?? "")
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t))
  )

  const jenisHari = (t: string): JenisHari => {
    // getUTCDay pada tengah malam UTC dari tanggal WIB yang sama:
    // penamaan harinya identik karena keduanya menyebut tanggal kalender
    // yang sama, bukan satu momen waktu.
    const hari = new Date(`${t}T00:00:00Z`).getUTCDay()
    const dasar: JenisHari = liburNasional.has(t)
      ? "libur"
      : hari === 0 || hari === 6
        ? "akhirpekan"
        : "kerja"
    // Ada yang bekerja di hari libur → hari itu jadi hari lembur.
    return dasar !== "kerja" && adaSetoran.has(t) ? "lembur" : dasar
  }

  // Tanggal acuan = hari WIB terakhir yang PUNYA setoran, bukan hari
  // kalender. Periode yang sudah lewat tetap bisa ditinjau tanpa seluruh
  // petugasnya dicap "diam" hanya karena bulannya sudah berganti.
  const acuan = [...adaSetoran].sort().at(-1) ?? null
  const selisihHari = (a: string, b: string) =>
    Math.round(
      (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000
    )

  // Pencatat yang punya target ATAU punya setoran — termasuk yang sudah
  // non-aktif tapi masih menyetor bulan ini (kalau tidak, setorannya
  // hilang dari total tanpa penjelasan).
  const idTerlibat = new Set<string>([
    ...pencatats.map((p) => p.id),
    ...[...target.keys()].filter(Boolean),
    ...[...setor.keys()].filter(Boolean),
  ])
  const namaPencatat = new Map(pencatats.map((p) => [p.id, p.namaLapangan]))
  const namaTambahan = await prisma.pencatat.findMany({
    where: {
      id: { in: [...idTerlibat].filter((id) => !namaPencatat.has(id)) },
    },
    select: { id: true, namaLapangan: true },
  })
  for (const p of namaTambahan) namaPencatat.set(p.id, p.namaLapangan)

  const baris = [...idTerlibat]
    .map((id) => {
      const perHari = harian.get(id) ?? new Map<string, number>()
      const tanggalSetor = [...perHari.keys()].sort()
      const terakhir = tanggalSetor.at(-1) ?? null
      const jumlahTarget = target.get(id) ?? 0
      const jumlahSetor = setor.get(id) ?? 0
      const hariDiam = terakhir && acuan ? selisihHari(terakhir, acuan) : null

      /// Status DITURUNKAN di server supaya tiga layar tidak menghitungnya
      /// dengan tiga aturan berbeda.
      const status: "selesai" | "jalan" | "diam" | "belum" =
        jumlahTarget > 0 && jumlahSetor >= jumlahTarget
          ? "selesai"
          : jumlahSetor === 0
            ? "belum"
            : (hariDiam ?? 0) >= AMBANG_DIAM_HARI
              ? "diam"
              : "jalan"

      return {
        id,
        nama: namaPencatat.get(id) ?? "(pencatat terhapus)",
        target: jumlahTarget,
        tersetor: jumlahSetor,
        terakhirSetor: terakhir,
        hariDiam,
        status,
        perTanggal: Object.fromEntries(perHari),
      }
    })
    // Yang paling perlu ditindak di atas: belum mulai → diam → jalan →
    // selesai; di dalam tiap kelompok, sisa pekerjaan terbanyak dulu.
    .filter((b) => b.target > 0 || b.tersetor > 0)
    .sort((a, b) => {
      const urut = { belum: 0, diam: 1, jalan: 2, selesai: 3 } as const
      return (
        urut[a.status] - urut[b.status] ||
        b.target - b.tersetor - (a.target - a.tersetor)
      )
    })

  const totalPerTanggal = tanggal.map((t) => ({
    tanggal: t,
    jumlah: baris.reduce((n, b) => n + (b.perTanggal[t] ?? 0), 0),
  }))

  return {
    periode,
    tanggalAcuan: acuan,
    ambangDiamHari: AMBANG_DIAM_HARI,
    /// Tanggal + jenis harinya sekaligus: layar mewarnai kolom dari sini,
    /// jadi aturan "Sabtu itu akhir pekan" tidak perlu ditulis dua kali.
    hari: tanggal.map((t) => ({ tanggal: t, jenis: jenisHari(t) })),
    tanggal,
    totalPerTanggal,
    pencatat: baris,
  }
}

// ── BELUM DIBACA — pemantauan beban kerja petugas ────────────────────────
//
// Menjawab pertanyaan yang tidak bisa dijawab tabel laporan: siapa yang
// SEHARUSNYA dicatat bulan ini tapi belum ada setorannya. Sumbernya daftar
// catat (DPM) periode itu, dikurangi nomor yang sudah punya laporan.
//
// Ini kebalikan dari daftar laporan — dan justru inilah yang dipakai
// supervisor untuk menagih pekerjaan ke petugas, bukan menghitung yang
// sudah masuk.
export async function daftarBelumDibaca(query: BelumDibacaQuery) {
  const { skip, take } = buildSkipTake(query)

  const where: Prisma.DaftarCatatWhereInput = {
    periode: query.periode,
    pelanggan: {
      laporanHarian: { none: { periode: query.periode } },
      ...(query.q
        ? {
            OR: [
              { nomorLangganan: { contains: query.q } },
              { nama: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    ...(query.pencatatId ? { pencatatId: query.pencatatId } : {}),
    ...(query.ruteId ? { ruteId: query.ruteId } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.daftarCatat.findMany({
      where,
      skip,
      take,
      orderBy: [{ urutan: "asc" }],
      include: {
        pelanggan: {
          select: {
            id: true,
            nomorLangganan: true,
            nama: true,
            alamat: true,
            status: true,
            rute: { select: { kode: true } },
          },
        },
        pencatat: { select: { id: true, namaLapangan: true } },
        rute: { select: { id: true, kode: true } },
      },
    }),
    prisma.daftarCatat.count({ where }),
  ])
  return { data, meta: buildMeta(total, query) }
}
