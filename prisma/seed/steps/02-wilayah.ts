// prisma/seed/steps/02-wilayah.ts — hierarki wilayah, diturunkan dari
// ProgresCater.
//
// TEMUAN PENTING (ditemukan saat menulis step ini, bukan asumsi): hierarki
// operasional PDAM (WilayahAdm -> WilayahDist -> SeksiCater -> Rute /
// WilayahSeksi -> Zona) TIDAK bersih 1-parent di data mentah — mis.
// WilayahDist "S/BARAT 2" muncul berpasangan dengan 4 WilayahAdm berbeda
// tergantung baris (KAREES/TEGALLEGA/CIBEUNYING/BOJONEGARA), dan 113 dari
// 125 Rute punya >1 SeksiCater induk yang berbeda-beda di baris berbeda.
// Kemungkinan penyebab: reorganisasi wilayah yang tidak konsisten
// dibersihkan di sumber data, atau makna kode-kode ini tidak benar-benar
// hierarkis 1:1 seperti diasumsikan skema semula.
//
// SIKAP: bukan tugas seed script menebak struktur organisasi "yang benar"
// — itu perlu dikonfirmasi manusia ke dokumen resmi PDAM. Jadi untuk tiap
// level, induk dipilih lewat MAYORITAS (pasangan induk-anak yang paling
// sering muncul di data), dan SETIAP kasus ambigu (anak dengan >1 induk
// berbeda) dicatat di SeedReport sebagai warning untuk ditinjau manusia —
// bukan diam-diam dipilih salah satu tanpa jejak.
//
// Kecamatan/Kelurahan TIDAK kena masalah ini (diverifikasi 100% bersih,
// 0 dari 21 Kelurahan punya >1 Kecamatan induk) — geografi pemerintahan
// resmi, beda sifat dari kode operasional PDAM di atas.

import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readProgresCater, type ProgresCaterRow } from "../lib/csv"

const STEP = "02-wilayah"

interface KodeNama {
  kode: string
  nama: string
}

function collectDistinct(
  rows: ProgresCaterRow[],
  pick: (r: ProgresCaterRow) => KodeNama
): Map<string, string> {
  const out = new Map<string, string>()
  for (const row of rows) {
    const { kode, nama } = pick(row)
    const k = kode.trim()
    if (!k || k === "-") continue
    if (!out.has(k)) out.set(k, nama.trim())
  }
  return out
}

/// Hitung "suara" induk per anak, lalu ambil yang paling sering muncul.
/// Mengembalikan juga daftar anak yang ambigu (>1 induk berbeda teramati)
/// supaya caller bisa log ke report.
function resolveMajorityParent(
  rows: ProgresCaterRow[],
  childKode: (r: ProgresCaterRow) => string,
  parentKode: (r: ProgresCaterRow) => string
): { parentOf: Map<string, string>; ambiguous: Map<string, number> } {
  const votes = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const child = childKode(row).trim()
    const parent = parentKode(row).trim()
    if (!child || child === "-" || !parent || parent === "-") continue
    let m = votes.get(child)
    if (!m) {
      m = new Map()
      votes.set(child, m)
    }
    m.set(parent, (m.get(parent) ?? 0) + 1)
  }

  const parentOf = new Map<string, string>()
  const ambiguous = new Map<string, number>()
  for (const [child, m] of votes) {
    let best: string | null = null
    let bestCount = -1
    for (const [p, c] of m) {
      if (c > bestCount) {
        best = p
        bestCount = c
      }
    }
    parentOf.set(child, best!)
    if (m.size > 1) ambiguous.set(child, m.size)
  }
  return { parentOf, ambiguous }
}

export async function seedWilayah(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const rows = readProgresCater()

  // --- Kecamatan / Kelurahan (bersih, tanpa ambiguitas) ---
  const kecamatanMap = collectDistinct(rows, (r) => ({ kode: r.kdkec, nama: r.namakec }))
  for (const [kode, nama] of kecamatanMap) {
    const existing = await prisma.kecamatan.findUnique({ where: { kode } })
    await prisma.kecamatan.upsert({ where: { kode }, create: { kode, nama }, update: { nama } })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  const kelurahanKecamatan = new Map<string, { nama: string; kecKode: string }>()
  for (const row of rows) {
    const kode = row.kdkel.trim()
    if (!kode || kode === "-" || kelurahanKecamatan.has(kode)) continue
    kelurahanKecamatan.set(kode, { nama: row.namakel.trim(), kecKode: row.kdkec.trim() })
  }
  for (const [kode, { nama, kecKode }] of kelurahanKecamatan) {
    const kecamatan = await prisma.kecamatan.findUnique({ where: { kode: kecKode } })
    if (!kecamatan) {
      report.warn(STEP, `Kelurahan ${kode} (${nama}) merujuk Kecamatan "${kecKode}" yang tidak ditemukan`, {
        key: kode,
      })
      report.skipped(STEP)
      continue
    }
    const existing = await prisma.kelurahan.findUnique({ where: { kode } })
    await prisma.kelurahan.upsert({
      where: { kode },
      create: { kode, nama, kecamatanId: kecamatan.id },
      update: { nama, kecamatanId: kecamatan.id },
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  // --- WilayahAdm (tidak punya induk) ---
  const wilayahAdmMap = collectDistinct(rows, (r) => ({ kode: r.wiladmkode, nama: r.wiladmnama }))
  for (const [kode, nama] of wilayahAdmMap) {
    const existing = await prisma.wilayahAdm.findUnique({ where: { kode } })
    await prisma.wilayahAdm.upsert({ where: { kode }, create: { kode, nama }, update: { nama } })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  // --- WilayahDist -> WilayahAdm (mayoritas + flag ambigu) ---
  const wilayahDistMap = collectDistinct(rows, (r) => ({ kode: r.wildistkode, nama: r.wildistnama }))
  const distToAdm = resolveMajorityParent(
    rows,
    (r) => r.wildistkode,
    (r) => r.wiladmkode
  )
  for (const [kode, count] of distToAdm.ambiguous) {
    report.warn(
      STEP,
      `WilayahDist "${kode}" muncul dengan ${count} WilayahAdm induk berbeda di data — dipilih yang paling sering, perlu konfirmasi manual ke struktur resmi PDAM`,
      { key: kode }
    )
  }
  for (const [kode, nama] of wilayahDistMap) {
    const admKode = distToAdm.parentOf.get(kode)
    const adm = admKode ? await prisma.wilayahAdm.findUnique({ where: { kode: admKode } }) : null
    if (!adm) {
      report.warn(STEP, `WilayahDist ${kode} (${nama}) tidak punya WilayahAdm induk yang valid, dilewati`, {
        key: kode,
      })
      report.skipped(STEP)
      continue
    }
    const existing = await prisma.wilayahDist.findUnique({ where: { kode } })
    await prisma.wilayahDist.upsert({
      where: { kode },
      create: { kode, nama, wilayahAdmId: adm.id },
      update: { nama, wilayahAdmId: adm.id },
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  // --- SeksiCater -> WilayahDist (mayoritas + flag ambigu) ---
  const seksiCaterMap = collectDistinct(rows, (r) => ({
    kode: r.caterseksikode,
    nama: r.caterseksinama,
  }))
  const seksiToDist = resolveMajorityParent(
    rows,
    (r) => r.caterseksikode,
    (r) => r.wildistkode
  )
  for (const [kode, count] of seksiToDist.ambiguous) {
    report.warn(STEP, `SeksiCater "${kode}" muncul dengan ${count} WilayahDist induk berbeda, dipilih mayoritas`, {
      key: kode,
    })
  }
  for (const [kode, nama] of seksiCaterMap) {
    const distKode = seksiToDist.parentOf.get(kode)
    const dist = distKode ? await prisma.wilayahDist.findUnique({ where: { kode: distKode } }) : null
    if (!dist) {
      report.warn(STEP, `SeksiCater ${kode} (${nama}) tidak punya WilayahDist induk yang valid, dilewati`, {
        key: kode,
      })
      report.skipped(STEP)
      continue
    }
    const existing = await prisma.seksiCater.findUnique({ where: { kode } })
    await prisma.seksiCater.upsert({
      where: { kode },
      create: { kode, nama, wilayahDistId: dist.id },
      update: { nama, wilayahDistId: dist.id },
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  // --- Rute -> SeksiCater (mayoritas + flag ambigu) ---
  const ruteKodes = new Set<string>()
  for (const row of rows) {
    const k = row.rute_kode.trim()
    if (k && k !== "-") ruteKodes.add(k)
  }
  const ruteToSeksi = resolveMajorityParent(
    rows,
    (r) => r.rute_kode,
    (r) => r.caterseksikode
  )
  for (const [kode, count] of ruteToSeksi.ambiguous) {
    report.warn(STEP, `Rute "${kode}" muncul dengan ${count} SeksiCater induk berbeda, dipilih mayoritas`, {
      key: kode,
    })
  }
  // CADANGAN untuk rute yang `caterseksikode`-nya KOSONG di sumber. Tanpa ini
  // rutenya dilewati, dan akibatnya berantai sampai jauh: pelanggan di rute
  // itu jadi tanpa `ruteId`, tidak masuk beban kerja pencatat mana pun, dan
  // di layar closing muncul sebagai "belum ada petugasnya" — padahal di
  // ProgresCater mereka ditagih tiap bulan dengan petugas yang jelas.
  // Nyatanya di data 202605: TA610 dan TC117 (petugas DANI, ditagih di Mar,
  // Apr, Mei, DAN Juni) hilang karena ini.
  //
  // Seksinya disimpulkan dari SEKSI MAYORITAS PETUGAS rute tersebut — teknik
  // yang sama dengan resolveMajorityParent di atas, hanya kuncinya petugas.
  // Dasarnya: petugas bekerja dalam satu seksi (DANI: 2.370 baris C4 vs 1
  // baris C5). Ini TETAP tebakan, jadi selalu diberi peringatan agar
  // dikoreksi manusia di Data Induk — tapi tebakan yang terlihat jauh lebih
  // baik daripada dua pelanggan yang diam-diam lenyap dari daftar kerja.
  const seksiMayoritasPetugas = resolveMajorityParent(
    rows,
    (r) => r.pencatat,
    (r) => r.caterseksikode
  )
  const petugasRute = resolveMajorityParent(
    rows,
    (r) => r.rute_kode,
    (r) => r.pencatat
  )

  for (const kode of ruteKodes) {
    let seksiKode = ruteToSeksi.parentOf.get(kode)
    if (!seksiKode) {
      const petugas = petugasRute.parentOf.get(kode)
      const tebakan = petugas ? seksiMayoritasPetugas.parentOf.get(petugas) : undefined
      if (tebakan) {
        seksiKode = tebakan
        report.warn(
          STEP,
          `Rute ${kode} tidak punya caterseksikode di sumber — seksi disimpulkan "${tebakan}" dari seksi mayoritas petugasnya (${petugas}). PERIKSA & koreksi di Data Induk.`,
          { key: kode }
        )
      }
    }
    const seksi = seksiKode ? await prisma.seksiCater.findUnique({ where: { kode: seksiKode } }) : null
    if (!seksi) {
      report.warn(STEP, `Rute ${kode} tidak punya SeksiCater induk yang valid, dilewati`, { key: kode })
      report.skipped(STEP)
      continue
    }
    const existing = await prisma.rute.findUnique({ where: { kode } })
    await prisma.rute.upsert({
      where: { kode },
      create: { kode, seksiCaterId: seksi.id },
      update: { seksiCaterId: seksi.id },
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  // --- WilayahSeksi -> WilayahDist (mayoritas + flag ambigu) ---
  const wilayahSeksiMap = collectDistinct(rows, (r) => ({
    kode: r.wilseksikode,
    nama: r.wilseksinama,
  }))
  const wilSeksiToDist = resolveMajorityParent(
    rows,
    (r) => r.wilseksikode,
    (r) => r.wildistkode
  )
  for (const [kode, count] of wilSeksiToDist.ambiguous) {
    report.warn(STEP, `WilayahSeksi "${kode}" muncul dengan ${count} WilayahDist induk berbeda, dipilih mayoritas`, {
      key: kode,
    })
  }
  for (const [kode, nama] of wilayahSeksiMap) {
    const distKode = wilSeksiToDist.parentOf.get(kode)
    const dist = distKode ? await prisma.wilayahDist.findUnique({ where: { kode: distKode } }) : null
    if (!dist) {
      report.warn(STEP, `WilayahSeksi ${kode} (${nama}) tidak punya WilayahDist induk yang valid, dilewati`, {
        key: kode,
      })
      report.skipped(STEP)
      continue
    }
    const existing = await prisma.wilayahSeksi.findUnique({ where: { kode } })
    await prisma.wilayahSeksi.upsert({
      where: { kode },
      create: { kode, nama, wilayahDistId: dist.id },
      update: { nama, wilayahDistId: dist.id },
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  // --- Zona -> WilayahSeksi (mayoritas + flag ambigu) ---
  const zonaMap = collectDistinct(rows, (r) => ({ kode: r.zonakode, nama: r.zonanama }))
  const zonaToWilSeksi = resolveMajorityParent(
    rows,
    (r) => r.zonakode,
    (r) => r.wilseksikode
  )
  for (const [kode, count] of zonaToWilSeksi.ambiguous) {
    report.warn(STEP, `Zona "${kode}" muncul dengan ${count} WilayahSeksi induk berbeda, dipilih mayoritas`, {
      key: kode,
    })
  }
  for (const [kode, nama] of zonaMap) {
    const wilSeksiKode = zonaToWilSeksi.parentOf.get(kode)
    const wilSeksi = wilSeksiKode
      ? await prisma.wilayahSeksi.findUnique({ where: { kode: wilSeksiKode } })
      : null
    if (!wilSeksi) {
      report.warn(STEP, `Zona ${kode} (${nama}) tidak punya WilayahSeksi induk yang valid, dilewati`, {
        key: kode,
      })
      report.skipped(STEP)
      continue
    }
    const existing = await prisma.zona.findUnique({ where: { kode } })
    await prisma.zona.upsert({
      where: { kode },
      create: { kode, nama, wilayahSeksiId: wilSeksi.id },
      update: { nama, wilayahSeksiId: wilSeksi.id },
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }
}
