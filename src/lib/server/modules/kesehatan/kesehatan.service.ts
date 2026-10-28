// server/modules/kesehatan/kesehatan.service.ts — KESEHATAN DATA.
//
// Aplikasi yang menjadi RUJUKAN harus bisa membuktikan datanya sendiri sehat,
// bukan menunggu ketahuan saat tagihan salah sampai ke rumah warga. Berkas
// ini menjalankan pemeriksaan integritas yang selama ini hanya ada di skrip
// CLI (`db:cek`, `cek-closing`) dan membawanya ke layar operator.
//
// TIGA TINGKAT KEPARAHAN, dan bedanya menentukan tindakan:
//   GAWAT    — menghalangi penerbitan tagihan yang benar. Harus dibereskan
//              sebelum closing.
//   PERHATIAN— tidak menghalangi closing, tapi ada yang tidak beres.
//   INFO     — keadaan yang wajar tapi perlu diketahui.
//
// BATAS "MENYEMBUHKAN SENDIRI" — ini yang paling penting di berkas ini.
// Perbaikan otomatis HANYA boleh untuk hal yang jawabannya tidak mungkin
// salah: menurunkan penugasan pencatat dari PenugasanRute yang sudah ada,
// misalnya. Yang menyangkut ANGKA UANG atau STATUS PELANGGAN tidak pernah
// diperbaiki otomatis — sekalipun tebakannya kelihatan aman. Menagih warga
// dengan angka hasil tebakan mesin adalah kerusakan yang tidak bisa
// dibatalkan dengan permintaan maaf.

import { prisma } from "@db"
import { recordAudit } from "../../lib/audit"
import { periodeToDate } from "../../lib/periode"

export type Keparahan = "GAWAT" | "PERHATIAN" | "INFO"

export interface Temuan {
  kode: string
  keparahan: Keparahan
  judul: string
  /// Apa akibatnya kalau dibiarkan — ditulis dalam bahasa akibat, bukan
  /// bahasa tabel, supaya operator bisa memutuskan tanpa tahu skema.
  akibat: string
  jumlah: number
  contoh: string[]
  /// Bisa diperbaiki otomatis lewat `perbaikiOtomatis`?
  bisaOtomatis: boolean
}

const MAKS_CONTOH = 20

export interface LaporanKesehatan {
  diperiksaPada: string
  ringkas: { gawat: number; perhatian: number; info: number }
  temuan: Temuan[]
}

export async function periksaKesehatan(): Promise<LaporanKesehatan> {
  const temuan: Temuan[] = []
  const tambah = (t: Temuan) => {
    if (t.jumlah > 0) temuan.push(t)
  }

  // ── 1. Pelanggan aktif tanpa golongan tarif ──
  const tanpaGolongan = await prisma.pelanggan.findMany({
    where: { deletedAt: null, status: "AKTIF", tarifGolonganId: null },
    select: { nomorLangganan: true },
    take: MAKS_CONTOH + 1,
  })
  const nTanpaGolongan = await prisma.pelanggan.count({
    where: { deletedAt: null, status: "AKTIF", tarifGolonganId: null },
  })
  tambah({
    kode: "PELANGGAN_TANPA_GOLONGAN",
    keparahan: "GAWAT",
    judul: "Pelanggan aktif belum punya golongan tarif",
    akibat:
      "Tagihannya tidak bisa dihitung sama sekali — mereka akan dilewati saat closing.",
    jumlah: nTanpaGolongan,
    contoh: tanpaGolongan.slice(0, MAKS_CONTOH).map((p) => p.nomorLangganan),
    bisaOtomatis: false,
  })

  // ── 2. Pelanggan aktif tanpa meter aktif ──
  const tanpaMeter = await prisma.pelanggan.findMany({
    where: {
      deletedAt: null,
      status: "AKTIF",
      meter: { none: { isAktif: true } },
    },
    select: { nomorLangganan: true },
    take: MAKS_CONTOH,
  })
  const nTanpaMeter = await prisma.pelanggan.count({
    where: {
      deletedAt: null,
      status: "AKTIF",
      meter: { none: { isAktif: true } },
    },
  })
  tambah({
    kode: "PELANGGAN_TANPA_METER",
    keparahan: "GAWAT",
    judul: "Pelanggan aktif tidak punya meter aktif",
    akibat:
      "Tidak ada yang bisa dicatat petugas, sehingga tidak akan pernah menghasilkan tagihan.",
    jumlah: nTanpaMeter,
    contoh: tanpaMeter.map((p) => p.nomorLangganan),
    bisaOtomatis: false,
  })

  // ── 3. Pelanggan aktif tanpa rute ──
  const tanpaRute = await prisma.pelanggan.findMany({
    where: { deletedAt: null, status: "AKTIF", ruteId: null },
    select: { nomorLangganan: true },
    take: MAKS_CONTOH,
  })
  const nTanpaRute = await prisma.pelanggan.count({
    where: { deletedAt: null, status: "AKTIF", ruteId: null },
  })
  tambah({
    kode: "PELANGGAN_TANPA_RUTE",
    keparahan: "PERHATIAN",
    judul: "Pelanggan aktif belum punya rute",
    akibat:
      "Tidak masuk beban kerja pencatat mana pun — tidak akan dikunjungi.",
    jumlah: nTanpaRute,
    contoh: tanpaRute.map((p) => p.nomorLangganan),
    bisaOtomatis: false,
  })

  // ── 4. Rute tanpa penugasan pencatat ──
  const ruteSemua = await prisma.rute.findMany({
    select: {
      kode: true,
      _count: { select: { penugasanRute: true, pelanggan: true } },
    },
  })
  const ruteTanpaPenugasan = ruteSemua.filter(
    (r) => r._count.penugasanRute === 0 && r._count.pelanggan > 0,
  )
  tambah({
    kode: "RUTE_TANPA_PENUGASAN",
    keparahan: "PERHATIAN",
    judul: "Rute berisi pelanggan tapi belum ditugaskan ke pencatat",
    akibat:
      "Daftar kerja bulan baru untuk rute ini terpaksa mewarisi petugas bulan lalu; warisan itu putus begitu rutenya berubah.",
    jumlah: ruteTanpaPenugasan.length,
    contoh: ruteTanpaPenugasan.slice(0, MAKS_CONTOH).map((r) => r.kode),
    bisaOtomatis: false,
  })

  // ── 5. Golongan tarif terpakai tapi belum punya blok tarif berlaku ──
  const hariIni = new Date()
  const golongan = await prisma.tarifGolongan.findMany({
    select: {
      kode: true,
      _count: { select: { pelanggan: true } },
      blokTarif: {
        where: {
          berlakuMulai: { lte: hariIni },
          OR: [{ berlakuSampai: null }, { berlakuSampai: { gte: hariIni } }],
        },
        select: { id: true },
      },
    },
  })
  const golonganTanpaBlok = golongan.filter(
    (g) => g._count.pelanggan > 0 && g.blokTarif.length === 0,
  )
  tambah({
    kode: "GOLONGAN_TANPA_BLOK_TARIF",
    keparahan: "GAWAT",
    judul: "Golongan tarif dipakai pelanggan tapi blok tarifnya belum ada",
    akibat:
      "Seluruh pelanggan di golongan ini TIDAK BISA ditagih. Blok tarif hanya boleh diisi dari SK tarif resmi — aplikasi sengaja tidak menebaknya.",
    jumlah: golonganTanpaBlok.length,
    contoh: golonganTanpaBlok.map(
      (g) => `${g.kode} (${g._count.pelanggan} pelanggan)`,
    ),
    bisaOtomatis: false,
  })

  // ── 6. Tagihan yang tidak konsisten dengan pembacaannya ──
  // INILAH pemeriksaan yang menangkap anomali seperti 00008001503 (stand
  // bergerak 909 m3, tapi tagihan memakai 3.000 m3). Dikerjakan lewat SQL
  // karena membandingkan dua kolom di dua tabel pada 22 ribu baris.
  const tidakKonsisten = await prisma.$queryRaw<{ nolg: string }[]>`
    SELECT p."nomorLangganan" AS nolg
    FROM tagihan t
    JOIN pembacaan_meter pm ON pm.id = t."pembacaanId"
    JOIN pelanggan p ON p.id = t."pelangganId"
    WHERE t."pemakaianM3" <> pm."pemakaianM3"
    LIMIT 100`
  tambah({
    kode: "TAGIHAN_TIDAK_COCOK_PEMBACAAN",
    keparahan: "GAWAT",
    judul: "Tagihan memakai pemakaian yang berbeda dari pembacaan meternya",
    akibat:
      "Angka di tagihan tidak bisa dipertanggungjawabkan terhadap catatan lapangan — inilah yang ditanyakan pelanggan saat mengadu dan diperiksa auditor.",
    jumlah: tidakKonsisten.length,
    contoh: tidakKonsisten.slice(0, MAKS_CONTOH).map((r) => r.nolg),
    bisaOtomatis: false,
  })

  // ── 7. Baris daftar catat milik pelanggan yang sudah dihapus ──
  const dcYatim = await prisma.daftarCatat.count({
    where: { pelanggan: { deletedAt: { not: null } } },
  })
  tambah({
    kode: "DAFTAR_CATAT_YATIM",
    keparahan: "PERHATIAN",
    judul: "Baris daftar catat menunjuk pelanggan yang sudah dihapus",
    akibat: "Beban kerja pencatat terhitung lebih besar daripada kenyataannya.",
    jumlah: dcYatim,
    contoh: [],
    bisaOtomatis: false,
  })

  // ── 8. Daftar catat periode terbuka yang belum punya pencatat ──
  // Ini yang BOLEH diperbaiki otomatis: jawabannya sudah tertulis di
  // PenugasanRute, tinggal diturunkan. Tidak ada tebakan sama sekali.
  const dcTanpaPencatat = await prisma.daftarCatat.findMany({
    where: {
      pencatatId: null,
      ruteId: { not: null },
      rute: { penugasanRute: { some: {} } },
    },
    select: {
      id: true,
      periode: true,
      pelanggan: { select: { nomorLangganan: true } },
    },
    take: 500,
  })
  tambah({
    kode: "DAFTAR_CATAT_TANPA_PENCATAT",
    keparahan: "PERHATIAN",
    judul:
      "Baris daftar catat belum berpetugas padahal rutenya sudah punya penugasan",
    akibat:
      "Sambungan ini tidak muncul di beban kerja siapa pun, padahal penugasannya sudah jelas.",
    jumlah: dcTanpaPencatat.length,
    contoh: dcTanpaPencatat
      .slice(0, MAKS_CONTOH)
      .map((d) => `${d.pelanggan.nomorLangganan} (${d.periode})`),
    bisaOtomatis: true,
  })

  // ── 9. Periode terkunci tanpa tanggal jatuh tempo ──
  const terkunciTanpaJatuhTempo = await prisma.periodePenagihan.count({
    where: { status: "TERKUNCI", tanggalJatuhTempo: null },
  })
  tambah({
    kode: "PERIODE_TANPA_JATUH_TEMPO",
    keparahan: "PERHATIAN",
    judul: "Periode terkunci tanpa tanggal jatuh tempo",
    akibat: "Tagihannya tidak punya batas waktu yang bisa ditagihkan.",
    jumlah: terkunciTanpaJatuhTempo,
    contoh: [],
    bisaOtomatis: false,
  })

  const ringkas = {
    gawat: temuan.filter((t) => t.keparahan === "GAWAT").length,
    perhatian: temuan.filter((t) => t.keparahan === "PERHATIAN").length,
    info: temuan.filter((t) => t.keparahan === "INFO").length,
  }

  return { diperiksaPada: new Date().toISOString(), ringkas, temuan }
}

export interface HasilPerbaikan {
  kode: string
  diperbaiki: number
  keterangan: string
}

/// Perbaikan otomatis. HANYA menangani temuan yang `bisaOtomatis` — dan
/// daftar itu sengaja pendek. Setiap penambahan ke sini harus lolos satu
/// pertanyaan: "kalau tebakan ini salah, apakah ada warga yang dirugikan?"
/// Kalau jawabannya mungkin ya, tempatnya bukan di sini.
export async function perbaikiOtomatis(input: {
  olehUserId: string
  jejak?: { ipAddress?: string | null; userAgent?: string | null }
}): Promise<HasilPerbaikan[]> {
  const hasil: HasilPerbaikan[] = []

  // Menurunkan pencatat dari PenugasanRute yang SUDAH ADA. Bukan tebakan:
  // penugasannya sudah tertulis, hanya belum tersalin ke baris daftar catat.
  const penugasan = await prisma.penugasanRute.findMany({
    select: { ruteId: true, pencatatId: true, urutan: true },
    orderBy: [{ urutan: "asc" }, { pencatatId: "asc" }],
  })
  const pencatatPerRute = new Map<string, string>()
  for (const p of penugasan)
    if (!pencatatPerRute.has(p.ruteId))
      pencatatPerRute.set(p.ruteId, p.pencatatId)

  let diperbaiki = 0
  for (const [ruteId, pencatatId] of pencatatPerRute) {
    const res = await prisma.daftarCatat.updateMany({
      where: { ruteId, pencatatId: null },
      data: { pencatatId },
    })
    diperbaiki += res.count
  }
  hasil.push({
    kode: "DAFTAR_CATAT_TANPA_PENCATAT",
    diperbaiki,
    keterangan: "Petugas diturunkan dari penugasan rute yang sudah terdaftar",
  })

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      userId: input.olehUserId,
      aksi: "PERBAIKAN_OTOMATIS_DATA",
      entitas: "DaftarCatat",
      perubahan: { hasil },
      ipAddress: input.jejak?.ipAddress ?? null,
      userAgent: input.jejak?.userAgent ?? null,
    })
  })

  return hasil
}

/// Ringkasan satu periode untuk kartu di layar — dipakai halaman kesehatan
/// agar operator melihat keadaan periode berjalan tanpa membuka closing.
export async function ringkasPeriode(periodeThbl: number) {
  const periode = periodeToDate(periodeThbl)
  const [dpm, pembacaan, tagihan] = await Promise.all([
    prisma.daftarCatat.count({ where: { periode: periodeThbl } }),
    prisma.pembacaanMeter.count({ where: { periode } }),
    prisma.tagihan.count({ where: { periode } }),
  ])
  return { periode: periodeThbl, dpm, pembacaan, tagihan }
}
