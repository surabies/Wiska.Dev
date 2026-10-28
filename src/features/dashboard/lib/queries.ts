import "server-only"

// features/dashboard/lib/queries.ts — pengambilan data untuk halaman
// dashboard (server component).
//
// KENAPA MEMANGGIL SERVICE/PRISMA LANGSUNG, BUKAN fetch KE /api/v1/dashboard:
// halaman ini dirender di server yang SAMA dengan API-nya. Memanggil API
// sendiri lewat HTTP berarti: satu perjalanan jaringan sia-sia, harus
// meneruskan cookie sesi secara manual, dan butuh URL absolut (yang berbeda
// antara dev/produksi) — semuanya tanpa manfaat. Endpoint /api/v1/dashboard/*
// tetap ada dan berguna untuk pemanggil LUAR (aplikasi mobile, widget client
// yang perlu refresh tanpa reload).
//
// Bandingkan dengan features/publik: di sana komponen memang client dan
// memanggil /api/public lewat fetch — karena rate limit-nya berbasis IP
// pemakai, bukan IP server.
import { prisma } from "@db"
import { dateToPeriode } from "@/lib/domain/periode"
// Impor STATIS, bukan `await import()` di dalam fungsi: impor dinamis membuat
// resolusinya baru diuji saat halaman dijalankan, sehingga kesalahan resolusi
// lolos dari typecheck DAN build lalu baru meledak di layar operator.
import { periksaKesehatan } from "@/lib/server/modules/kesehatan/kesehatan.service"
import { daftarAnomali, trenAnomali } from "@server/modules/anomali"
import {
  AMBANG_BULAN_DEFAULT,
  SEMUA_KATEGORI,
} from "@/lib/domain/anomali"

async function periodeTerakhir(): Promise<Date | null> {
  const baris = await prisma.tagihan.findFirst({ orderBy: { periode: "desc" }, select: { periode: true } })
  return baris?.periode ?? null
}

/// Semua lewat agregasi database — tabel pelanggan & tagihan >22.000 baris,
/// menariknya ke JS lalu menghitung di sana akan menyeret puluhan ribu baris
/// setiap halaman dibuka.
export async function ambilRingkasan() {
  const periode = await periodeTerakhir()

  const [pelangganAktif, pelangganNonAktif, tagihanPeriode, tunggakan, pengaduanBelumSelesai, pengaduanDarurat, laporanMenunggu] =
    await Promise.all([
      prisma.pelanggan.count({ where: { deletedAt: null, status: "AKTIF" } }),
      prisma.pelanggan.count({ where: { deletedAt: null, status: { not: "AKTIF" } } }),
      periode
        ? prisma.tagihan.aggregate({ where: { periode }, _count: true, _sum: { totalTagihan: true, pemakaianM3: true } })
        : null,
      prisma.tagihan.aggregate({
        where: { status: { in: ["BELUM_BAYAR", "JATUH_TEMPO"] } },
        _count: true,
        _sum: { totalTagihan: true },
      }),
      prisma.pengaduan.count({ where: { status: { in: ["BARU", "DITUGASKAN", "DIPROSES"] } } }),
      prisma.pengaduan.count({ where: { status: { notIn: ["SELESAI", "DITOLAK"] }, prioritas: "DARURAT" } }),
      prisma.laporanMandiri.count({ where: { status: "MENUNGGU" } }),
    ])

  return {
    periode: periode ? dateToPeriode(periode) : null,
    pelanggan: { aktif: pelangganAktif, nonAktif: pelangganNonAktif },
    tagihanPeriode: {
      jumlah: tagihanPeriode?._count ?? 0,
      nilai: tagihanPeriode?._sum.totalTagihan ?? 0,
      pemakaianM3: tagihanPeriode?._sum.pemakaianM3 ?? 0,
    },
    tunggakan: { jumlah: tunggakan._count, nilai: tunggakan._sum.totalTagihan ?? 0 },
    pengaduan: { belumSelesai: pengaduanBelumSelesai, darurat: pengaduanDarurat },
    laporanMandiriMenunggu: laporanMenunggu,
  }
}

export async function ambilTren() {
  const terakhir = await periodeTerakhir()
  if (!terakhir) return []
  const mulai = new Date(Date.UTC(terakhir.getUTCFullYear(), terakhir.getUTCMonth() - 5, 1))

  const baris = await prisma.tagihan.groupBy({
    by: ["periode"],
    where: { periode: { gte: mulai, lte: terakhir } },
    _sum: { totalTagihan: true, pemakaianM3: true },
    _count: true,
    orderBy: { periode: "asc" },
  })

  return baris.map((b) => ({
    periode: dateToPeriode(b.periode),
    jumlahTagihan: b._count,
    nilai: b._sum.totalTagihan ?? 0,
    pemakaianM3: b._sum.pemakaianM3 ?? 0,
  }))
}

export async function ambilPerluTindakan() {
  const [pengaduan, laporanMandiri] = await Promise.all([
    prisma.pengaduan.findMany({
      where: { status: { in: ["BARU", "DITUGASKAN", "DIPROSES"] } },
      orderBy: [{ prioritas: "desc" }, { createdAt: "asc" }],
      take: 5,
      select: { id: true, nomorTiket: true, jenis: true, judul: true, status: true, prioritas: true, createdAt: true },
    }),
    prisma.laporanMandiri.findMany({
      where: { status: "MENUNGGU" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        nomorLangganan: true,
        periode: true,
        standDilaporkan: true,
        createdAt: true,
        pelanggan: { select: { nama: true } },
      },
    }),
  ])
  return { pengaduan, laporanMandiri }
}

/// Riwayat periode penagihan untuk layar closing. Dibaca DI SERVER (bukan
/// lewat effect di client) mengikuti alasan di kepala berkas ini: halaman
/// dirender di server yang sama dengan API-nya, jadi render awal tidak perlu
/// perjalanan HTTP ke diri sendiri. Layar closing tetap memuat ulang daftar
/// ini lewat /api/v1/closing SETELAH menutup/membuka periode — di situ
/// memang butuh refresh tanpa reload halaman.
export async function ambilRiwayatPeriode() {
  const rows = await prisma.periodePenagihan.findMany({
    orderBy: { periode: "desc" },
    take: 36,
    include: {
      ditutupBy: { select: { id: true, name: true } },
      dibukaBy: { select: { id: true, name: true } },
    },
  })
  // Bentuknya disamakan PERSIS dengan respons GET /api/v1/closing (tanggal
  // sebagai string ISO, BigInt sebagai string) supaya komponen client bisa
  // memakai satu tipe untuk data awal DAN data hasil refresh.
  return rows.map((r) => ({
    id: r.id,
    periode: r.periode,
    status: r.status,
    tanggalJatuhTempo: r.tanggalJatuhTempo?.toISOString() ?? null,
    ditutupAt: r.ditutupAt?.toISOString() ?? null,
    dibukaAt: r.dibukaAt?.toISOString() ?? null,
    alasanBuka: r.alasanBuka,
    jumlahSL: r.jumlahSL,
    totalM3: r.totalM3,
    totalTagihan: r.totalTagihan?.toString() ?? null,
    ditutupBy: r.ditutupBy,
    dibukaBy: r.dibukaBy,
  }))
}

/// Laporan kesehatan data untuk render awal halaman — dibaca di server
/// (alasan sama seperti di kepala berkas ini). Halaman tetap bisa memuat
/// ulang lewat /api/v1/kesehatan setelah perbaikan dijalankan.
export async function ambilLaporanKesehatan() {
  return periksaKesehatan()
}

/// Sambungan yang perlu dipetakan ke rute — dibaca di server untuk render
/// awal, sama seperti query lain di berkas ini. Bentuknya disamakan dengan
/// GET /api/v1/pelanggan/perlu-rute supaya komponen client bisa memakai satu
/// tipe untuk data awal DAN hasil muat ulang.
/// `periode` opsional: render awal halaman belum tahu periode kerjanya, dan
/// klien memuat ulang sendiri begitu tahu. Tanpa periode, daftar ini hanya
/// memuat sambungan tanpa rute — perilaku lama, dan itu memang benar sebagai
/// tampilan pertama.
export async function ambilSambunganPerluRute(periode?: number) {
  const [tanpaRute, ruteTanpaPencatat, rute] = await Promise.all([
    prisma.pelanggan.findMany({
      where: { deletedAt: null, status: "AKTIF", ruteId: null },
      select: {
        id: true, nomorLangganan: true, nama: true, alamat: true,
        rt: true, rw: true, ruteId: true, noUrutRute: true,
        kelurahan: { select: { nama: true } },
        rute: { select: { kode: true } },
        // Sudah punya laporan periode ini? Itu penanda "pekerjaannya selesai"
        // — barisnya tetap ditampilkan supaya rutenya masih bisa dikoreksi,
        // tapi tidak lagi dihitung sebagai pekerjaan yang menunggu.
        laporanHarian: periode
          ? { where: { periode }, select: { id: true }, take: 1 }
          : { where: { id: "-" }, select: { id: true }, take: 1 },
      },
      orderBy: { nomorLangganan: "asc" },
      take: 500,
    }),
    prisma.pelanggan.findMany({
      where: { deletedAt: null, status: "AKTIF", ruteId: { not: null }, rute: { penugasanRute: { none: {} } } },
      select: {
        id: true, nomorLangganan: true, nama: true, alamat: true,
        rt: true, rw: true, ruteId: true, noUrutRute: true,
        kelurahan: { select: { nama: true } },
        rute: { select: { kode: true } },
      },
      orderBy: { nomorLangganan: "asc" },
      take: 500,
    }),
    prisma.rute.findMany({
      select: { id: true, kode: true, penugasanRute: { select: { pencatat: { select: { namaLapangan: true } } }, take: 1 } },
      orderBy: { kode: "asc" },
    }),
  ])
  return {
    // `kelurahan` diratakan jadi teks — layar hanya menampilkannya, dan
    // objek bersarang untuk satu nama cuma menambah kedalaman yang harus
    // dibongkar lagi di sisi klien.
    // kodeRute DIAMBIL dari relasinya, bukan dipaksa null. Dulu daftar ini
    // hanya berisi sambungan tanpa rute sehingga null selalu benar; sejak ia
    // juga memuat seluruh PBPK periode berjalan, memaksa null menyembunyikan
    // rute yang SUDAH terisi — persis yang perlu dilihat operator untuk tahu
    // apakah rutenya keliru.
    tanpaRute: tanpaRute.map(({ kelurahan, rute, laporanHarian, ...p }) => ({
      ...p,
      kelurahan: kelurahan?.nama ?? null,
      kodeRute: rute?.kode ?? null,
      sudahDicatat: laporanHarian.length > 0,
    })),
    ruteTanpaPencatat: ruteTanpaPencatat.map(({ rute, kelurahan, ...p }) => ({
      ...p,
      kelurahan: kelurahan?.nama ?? null,
      kodeRute: rute?.kode ?? null,
      sudahDicatat: false,
    })),
    rute: rute.map((r) => ({ id: r.id, kode: r.kode, pencatat: r.penugasanRute[0]?.pencatat.namaLapangan ?? null })),
  }
}

/// Daftar sambungan tidak terukur + trennya, dibaca di server untuk render
/// awal. Pola sama seperti `ambilLaporanKesehatan`: halaman ini dirender di
/// server yang sama dengan API-nya, jadi memanggil servicenya langsung lebih
/// murah daripada perjalanan HTTP ke diri sendiri.
export async function ambilAnomali(opsi?: { ambangBulan?: number }) {
  const [baris, tren] = await Promise.all([
    daftarAnomali({ ambangBulan: opsi?.ambangBulan }),
    trenAnomali(6, opsi?.ambangBulan),
  ])
  return {
    ambangBulan: opsi?.ambangBulan ?? AMBANG_BULAN_DEFAULT,
    total: baris.length,
    prioritas: baris.filter((b) => b.prioritas).length,
    perKategori: Object.fromEntries(
      SEMUA_KATEGORI.map((k) => [k, baris.filter((b) => b.kategori === k).length])
    ) as Record<(typeof SEMUA_KATEGORI)[number], number>,
    // Dipotong: halaman menampilkan yang teratas, dan mengirim 4.500 baris ke
    // browser sebagai payload RSC membuat muat awal berat tanpa ada yang
    // membacanya. Begitu penyaring disentuh, klien mengambil ulang lewat
    // cariAnomaliAction — yang menyaring di SERVER, jadi hasilnya tidak
    // terkurung pada potongan ini.
    baris: baris.slice(0, 300),
    // Pilihan kelurahan diturunkan dari daftar penuh, bukan dari potongan di
    // atas — kalau dari potongan, wilayah yang anomalinya sedikit tidak akan
    // pernah muncul sebagai pilihan dan jadi mustahil dicari.
    kelurahanTersedia: [...new Set(baris.map((b) => b.kelurahan).filter((k): k is string => k != null))].sort(
      (a, b) => a.localeCompare(b, "id")
    ),
    tren,
  }
}
