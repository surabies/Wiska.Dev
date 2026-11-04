// prisma/seed/steps/01-referensi.ts — data referensi yang statis/closed-set,
// tidak berubah tiap import bulanan. Dua sumber:
// 1. Divisi: 4 nilai KodeDivisi (enum tetap) — aman diseed statis.
// 2. TarifGolongan: diturunkan dari ProgresCater (trp/namatrp), BUKAN
//    diketik manual — namatrp TERVERIFIKASI 1:1 konsisten per kode trp di
//    seluruh 22.523 baris, aman dijadikan sumber kebenaran.
//
// SENGAJA TIDAK men-seed Bagian/SubBagian — itu struktur HR internal yang
// TIDAK ADA di keempat CSV data pelanggan/meter. Mengarang kode/nama
// Bagian tanpa sumber data nyata melanggar prinsip "pemetaan data akurat
// & presisi". Bagian/SubBagian diisi lewat admin UI saat data HR-nya ada.
//
// 3. TarifBlok + BiayaTetap: DITURUNKAN dari ProgresCater lewat
//    lib/tarif.ts. Catatan lama di file ini menyatakan tarif per-blok
//    "perlu SK tarif resmi karena CSV cuma punya jmlhargaair total" — itu
//    ternyata KELIRU. `jmlhargaair` terbukti fungsi murni dari (golongan,
//    pemakaian): 629 kombinasi, nol konflik. Dari situ harga tiap blok
//    bisa dipecahkan secara aljabar, dan hasilnya mereproduksi seluruh
//    22.523 tagihan periode 202605 tanpa selisih sepeser pun (buktikan
//    ulang dengan `pnpm db:verifikasi-tarif`).
//
//    SK tarif resmi tetap dibutuhkan — untuk MENGONFIRMASI angka ini dan
//    untuk mengisi blok golongan bervolume kecil yang observasinya terlalu
//    jarang (dilaporkan sebagai warning, TIDAK diekstrapolasi).

import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readProgresCater, readProgresCaterSemuaPeriodeUntukTarif } from "../lib/csv"
import { normalizeGolonganTarif, normalizeUkuranMeter, parseIntOrNull } from "../lib/normalize"
import {
  turunkanTarifBlok,
  turunkanBiayaTetap,
  type ObservasiTarif,
  type ObservasiBiayaTetap,
} from "../lib/tarif"

const STEP = "01-referensi"

/// Tanggal berlaku tarif, DITETAPKAN PEMILIK DATA: 1 Januari 2026.
///
/// Nilai sebelumnya 2026-05-01 bukan tanggal SK, melainkan sisa asumsi
/// lama — periode paling awal yang datanya kebetulan kita punya waktu itu
/// (202605). Akibatnya closing Januari-April terbit Rp 0 karena tidak ada
/// blok tarif yang berlaku.
///
/// Diuji sebelum diubah: menghitung ulang harga air SELURUH baris
/// ProgresCater Januari dengan blok tarif ini mereproduksi 22.542 dari
/// 22.549 angka di berkas secara persis (satu-satunya selisih adalah
/// 00008001503, anomali `pakai_drd` yang sudah lama terdaftar). Jadi tarif
/// ini memang yang berlaku di Januari — bukan sekadar diasumsikan.
///
/// Kalau kelak ada SK dengan tarif BERBEDA, tambahkan baris baru dengan
/// berlakuMulai-nya sendiri; jangan ubah nilai ini, karena yang lama bukan
/// salah tanggal lagi melainkan tarif yang benar-benar berbeda.
const BERLAKU_MULAI = new Date(Date.UTC(2026, 0, 1))

const DIVISI_LIST = [
  { kode: "PELAYANAN", nama: "DIREKTORAT PELAYANAN" },
  { kode: "TEHNIK", nama: "DIREKTORAT TEHNIK" },
  { kode: "UMUM", nama: "DIREKTORAT UMUM" },
  { kode: "UTAMA", nama: "DIREKTORAT UTAMA" },
] as const

/// ── HIERARKI ORGANISASI: Direktorat > Bagian > SubBagian ─────────────────
///
/// Selama ini hanya keempat Direktorat yang pernah dibuat; tabel `bagian` dan
/// `sub_bagian` KOSONG, sehingga 9 Pencatat kita mengambang tanpa induk.
/// Isinya dipulihkan dari prisma/seed/hirarkiorganisasi.ts — berkas tambalan
/// lama yang TIDAK PERNAH BISA JALAN di repo ini (ia mengimpor "../seed/client"
/// yang tidak ada, memakai `import.meta.main` milik Bun sedangkan seed
/// dijalankan dengan tsx, dan hanya menambal SubBagian dari Bagian yang tidak
/// pernah dibuat siapa pun — dijalankan pun ia berhenti di "Tidak ada Bagian
/// di database").
///
/// KELIMA WILAYAH DIBUAT, meski data operasional kita hanya PW5. Struktur
/// organisasi adalah kenyataan perusahaan, bukan cerminan data yang kebetulan
/// kita punya; membuat PW5 saja akan membuat penempatan pegawai wilayah lain
/// mustahil tanpa migrasi susulan.
///
/// levelKepala: SENIOR_MANAGER di PELAYANAN, MANAGER di TEHNIK/UMUM
/// (lihat catatan kolomnya di organisasi.prisma).
const BAGIAN_LIST = [
  ...[1, 2, 3, 4, 5].map((w) => ({
    kode: `BAGIAN-PW${w}`,
    nama: `PELAYANAN WILAYAH ${w}`,
    divisi: "PELAYANAN" as const,
    levelKepala: "SENIOR_MANAGER" as const,
  })),
  { kode: "BAGIAN-PROD1", nama: "PRODUKSI 1", divisi: "TEHNIK" as const, levelKepala: "MANAGER" as const },
  { kode: "BAGIAN-PROD2", nama: "PRODUKSI 2", divisi: "TEHNIK" as const, levelKepala: "MANAGER" as const },
  { kode: "BAGIAN-KEU", nama: "KEUANGAN", divisi: "UMUM" as const, levelKepala: "MANAGER" as const },
  { kode: "BAGIAN-SDM", nama: "SUMBER DAYA MANUSIA", divisi: "UMUM" as const, levelKepala: "MANAGER" as const },
  { kode: "BAGIAN-HUMAS", nama: "HUKUM & HUMAS", divisi: "UMUM" as const, levelKepala: "MANAGER" as const },
  { kode: "BAGIAN-IT", nama: "TEKNOLOGI INFORMASI", divisi: "UMUM" as const, levelKepala: "MANAGER" as const },
  { kode: "BAGIAN-SEKDIR", nama: "SEKRETARIAT DIREKSI", divisi: "UTAMA" as const, levelKepala: "MANAGER" as const },
  { kode: "BAGIAN-SPI", nama: "SATUAN PENGAWAS INTERN", divisi: "UTAMA" as const, levelKepala: "MANAGER" as const },
] as const

/// SubBagian per Bagian. Untuk PELAYANAN keempatnya sama di tiap wilayah —
/// CATER (Pencatatan Meter) inilah induk para Pencatat.
const SUB_BAGIAN: Record<string, { suffix: string; nama: string }[]> = {
  ...Object.fromEntries(
    [1, 2, 3, 4, 5].map((w) => [
      `BAGIAN-PW${w}`,
      [
        { suffix: "CATER", nama: "PENCATATAN METER" },
        { suffix: "ZONA", nama: "SUB ZONA" },
        { suffix: "LANG", nama: "LANGGANAN" },
        { suffix: "NRW", nama: "NRW" },
      ],
    ])
  ),
  "BAGIAN-PROD1": [
    { suffix: "INTAKE", nama: "OPERATOR PENGOLAHAN & INTAKE" },
    { suffix: "MEKANIK", nama: "MEKANIKAL ENGINEERING" },
    { suffix: "PERPI", nama: "BAGIAN PERPIPAAN" },
  ],
  "BAGIAN-PROD2": [
    { suffix: "INTAKE", nama: "OPERATOR PENGOLAHAN & INTAKE" },
    { suffix: "SUMURBOR", nama: "SUMUR BOR" },
    { suffix: "MATAAIR", nama: "MATA AIR" },
  ],
  "BAGIAN-KEU": [
    { suffix: "ANGG", nama: "ANGGARAN & AKUNTANSI" },
    { suffix: "KAS", nama: "KAS & PENAGIHAN" },
  ],
  "BAGIAN-SDM": [
    { suffix: "REKRUT", nama: "REKRUTMEN & PENGEMBANGAN" },
    { suffix: "PENGG", nama: "PENGGAJIAN & KESEJAHTERAAN" },
  ],
  "BAGIAN-HUMAS": [
    { suffix: "HUKUM", nama: "HUKUM & KEPATUHAN" },
    { suffix: "PR", nama: "HUBUNGAN MASYARAKAT" },
  ],
  "BAGIAN-IT": [
    { suffix: "SIS", nama: "SISTEM INFORMASI" },
    { suffix: "ASET", nama: "MANAJEMEN ASET" },
  ],
  "BAGIAN-SEKDIR": [
    { suffix: "ADM", nama: "ADMINISTRASI & KORESPONDENSI" },
    { suffix: "PROTO", nama: "PROTOKOL & KEARSIPAN" },
  ],
  "BAGIAN-SPI": [
    { suffix: "AUDIT", nama: "AUDIT INTERNAL" },
    { suffix: "EVAL", nama: "EVALUASI & PELAPORAN" },
  ],
}

function deriveKategori(kodeAsli: string): string {
  const tier = kodeAsli.trim()[0]
  switch (tier) {
    case "1":
      return "SOSIAL"
    case "2":
      return "RUMAH_TANGGA"
    case "3":
      return "NIAGA"
    case "4":
      return "INDUSTRI"
    default:
      return "LAINNYA"
  }
}

export async function seedReferensi(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const divisiId = new Map<string, string>()
  for (const d of DIVISI_LIST) {
    const existing = await prisma.divisi.findUnique({ where: { kode: d.kode } })
    const row = await prisma.divisi.upsert({
      where: { kode: d.kode },
      create: { kode: d.kode, nama: d.nama },
      update: { nama: d.nama },
    })
    divisiId.set(d.kode, row.id)
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  // Bagian, lalu SubBagian di bawahnya. Upsert by `kode` -> idempoten, dan
  // menjalankan ulang seed tidak pernah menggandakan struktur.
  for (const b of BAGIAN_LIST) {
    const idDivisi = divisiId.get(b.divisi)
    if (!idDivisi) {
      report.error(STEP, `Divisi ${b.divisi} tidak ada — Bagian ${b.kode} dilewati`, { key: b.kode })
      continue
    }
    const adaBagian = await prisma.bagian.findUnique({ where: { kode: b.kode } })
    const bagian = await prisma.bagian.upsert({
      where: { kode: b.kode },
      create: { kode: b.kode, nama: b.nama, divisiId: idDivisi, levelKepala: b.levelKepala },
      update: { nama: b.nama, divisiId: idDivisi, levelKepala: b.levelKepala },
    })
    adaBagian ? report.unchanged(`${STEP}:bagian`) : report.created(`${STEP}:bagian`)

    for (const sub of SUB_BAGIAN[b.kode] ?? []) {
      const kode = `SUB-${b.kode.replace("BAGIAN-", "")}-${sub.suffix}`
      const adaSub = await prisma.subBagian.findUnique({ where: { kode } })
      await prisma.subBagian.upsert({
        where: { kode },
        create: { kode, nama: sub.nama, bagianId: bagian.id },
        update: { nama: sub.nama, bagianId: bagian.id },
      })
      adaSub ? report.unchanged(`${STEP}:sub-bagian`) : report.created(`${STEP}:sub-bagian`)
    }
  }

  // Kumpulkan pasangan (trp, namatrp) unik dari ProgresCater — sudah
  // diverifikasi 1:1 konsisten, jadi cukup ambil kemunculan pertama.
  const rows = readProgresCater()
  const tarifMap = new Map<string, string>()
  for (const row of rows) {
    const kodeAsli = row.trp.trim()
    if (!kodeAsli || tarifMap.has(kodeAsli)) continue
    tarifMap.set(kodeAsli, row.namatrp.trim())
  }

  for (const [kodeAsli, nama] of tarifMap) {
    const kode = normalizeGolonganTarif(kodeAsli)
    if (!kode) {
      report.warn(STEP, `Kode tarif "${kodeAsli}" tidak dikenali di enum GolonganTarif, dilewati`, {
        key: kodeAsli,
      })
      report.skipped(STEP)
      continue
    }
    const existing = await prisma.tarifGolongan.findUnique({ where: { kode } })
    await prisma.tarifGolongan.upsert({
      where: { kode },
      create: { kode, kodeAsli, nama, kategori: deriveKategori(kodeAsli) },
      update: { kodeAsli, nama, kategori: deriveKategori(kodeAsli) },
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  await seedTarifBlok(prisma, report, rows)
  await seedBiayaTetap(prisma, report, rows)
}

async function seedTarifBlok(
  prisma: PrismaClientLike,
  report: SeedReport,
  rows: ReturnType<typeof readProgresCater>
): Promise<void> {
  // Observasi tarif diambil dari SELURUH periode yang berkasnya ada, bukan
  // hanya jendela SEED_PERIODE — lihat alasannya di
  // readProgresCaterSemuaPeriodeUntukTarif().
  const barisTarif = readProgresCaterSemuaPeriodeUntukTarif()
  const observasi: ObservasiTarif[] = []
  for (const row of barisTarif) {
    const pemakaianM3 = parseIntOrNull(row.pakai_drd)
    const jmlHargaAir = parseIntOrNull(row.jmlhargaair)
    const kodeAsli = row.trp.trim()
    if (!kodeAsli || pemakaianM3 === null || jmlHargaAir === null) continue
    observasi.push({ kodeAsli, pemakaianM3, jmlHargaAir })
  }

  for (const hasil of turunkanTarifBlok(observasi)) {
    const kode = normalizeGolonganTarif(hasil.kodeAsli)
    if (!kode) continue // sudah dilaporkan saat seed TarifGolongan

    for (const p of hasil.pencilan) {
      // ANOMALI DATA, bukan kesalahan tarif: tagihan baris ini tidak sesuai
      // tarif yang disepakati ribuan baris lain. Dilaporkan satu per satu
      // supaya bisa ditelusuri — TIDAK membatalkan seed tarifnya.
      report.error(
        STEP,
        `Anomali tagihan golongan ${p.kodeAsli}: ada baris dengan pakai=${p.pemakaianM3} m3 berharga air ${p.jmlHargaAir}, padahal menurut tarif seharusnya ${p.hargaSeharusnya} (selisih ${p.jmlHargaAir - p.hargaSeharusnya}). Periksa baris ini di sumber data.`,
        { key: `${p.kodeAsli}:${p.pemakaianM3}` }
      )
    }

    if (hasil.blokTidakPasti.length > 0) {
      report.warn(
        STEP,
        `Golongan ${hasil.kodeAsli} (${hasil.jumlahObservasi} observasi): blok ${hasil.blokTidakPasti.join(", ")} tidak bisa dipastikan dari data — WAJIB diisi dari SK tarif, sengaja tidak diekstrapolasi`,
        { key: hasil.kodeAsli }
      )
    }

    const golongan = await prisma.tarifGolongan.findUnique({ where: { kode }, select: { id: true } })
    if (!golongan) continue

    for (const b of hasil.blok) {
      const existing = await prisma.tarifBlok.findUnique({
        where: {
          tarifGolonganId_blok_berlakuMulai: {
            tarifGolonganId: golongan.id,
            blok: b.blok,
            berlakuMulai: BERLAKU_MULAI,
          },
        },
        select: { id: true },
      })
      await prisma.tarifBlok.upsert({
        where: {
          tarifGolonganId_blok_berlakuMulai: {
            tarifGolonganId: golongan.id,
            blok: b.blok,
            berlakuMulai: BERLAKU_MULAI,
          },
        },
        create: {
          tarifGolonganId: golongan.id,
          blok: b.blok,
          batasAwalM3: b.batasAwalM3,
          batasAkhirM3: b.batasAkhirM3,
          hargaPerM3: b.hargaPerM3,
          berlakuMulai: BERLAKU_MULAI,
        },
        update: {
          batasAwalM3: b.batasAwalM3,
          batasAkhirM3: b.batasAkhirM3,
          hargaPerM3: b.hargaPerM3,
        },
      })
      existing ? report.updated(`${STEP}:tarif-blok`) : report.created(`${STEP}:tarif-blok`)
    }
  }
}

async function seedBiayaTetap(
  prisma: PrismaClientLike,
  report: SeedReport,
  rows: ReturnType<typeof readProgresCater>
): Promise<void> {
  const observasi: ObservasiBiayaTetap[] = []
  for (const row of rows) {
    const ukuranMeter = normalizeUkuranMeter(row.ukmeter)
    const beaBeban = parseIntOrNull(row.beabeban)
    const beaAdmin = parseIntOrNull(row.beaadmin)
    const airKotor = parseIntOrNull(row.airkotor)
    if (!ukuranMeter || beaBeban === null || beaAdmin === null || airKotor === null) continue
    observasi.push({ ukuranMeter, beaBeban, beaAdmin, airKotor })
  }

  const hasil = turunkanBiayaTetap(observasi)
  for (const k of hasil.konflik) {
    report.error(STEP, `Biaya tetap tidak konsisten di data sumber: ${k}`)
  }
  if (hasil.konflik.length > 0) {
    report.skipped(`${STEP}:biaya-tetap`)
    return
  }

  // ukuranMeter nullable -> tidak bisa dipakai di @@unique (NULL dianggap
  // berbeda oleh Postgres), jadi idempotensi ditegakkan manual di sini.
  const simpan = async (
    jenis: "BEA_BEBAN" | "BEA_ADMIN" | "AIR_KOTOR",
    ukuranMeter: "INCH_HALF" | "INCH_1" | "INCH_1_HALF" | "INCH_2" | "INCH_3" | "INCH_4" | null,
    nominal: number
  ): Promise<void> => {
    const existing = await prisma.biayaTetap.findFirst({
      where: { jenis, ukuranMeter, berlakuMulai: BERLAKU_MULAI },
      select: { id: true },
    })
    if (existing) {
      await prisma.biayaTetap.update({ where: { id: existing.id }, data: { nominal } })
      report.updated(`${STEP}:biaya-tetap`)
    } else {
      await prisma.biayaTetap.create({
        data: { jenis, ukuranMeter, nominal, berlakuMulai: BERLAKU_MULAI },
      })
      report.created(`${STEP}:biaya-tetap`)
    }
  }

  for (const [ukuran, nominal] of hasil.beaBebanPerUkuran) {
    await simpan("BEA_BEBAN", ukuran as Parameters<typeof simpan>[1], nominal)
  }
  if (hasil.beaAdmin !== null) await simpan("BEA_ADMIN", null, hasil.beaAdmin)
  if (hasil.airKotor !== null) await simpan("AIR_KOTOR", null, hasil.airKotor)
}
