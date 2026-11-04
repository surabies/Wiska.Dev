// prisma/seed/steps/04-pencatat.ts — jembatan nama petugas lapangan.
// Sumber: ProgresCater.pencatat, satu-satunya berkas yang boleh dibaca seed.
//
// Dulu daftarnya di-UNION dengan lapdatameter.kd_petugas. Itu tidak
// menambahkan apa pun — nama-namanya SAMA (9 nama unik di kedua berkas),
// selain placeholder "-" yang memang sengaja tidak pernah dibuatkan baris
// Pencatat supaya pencatatId tetap null seperti desain skema. Petugas baru
// yang belum pernah muncul di ProgresCater sekarang lahir lewat layar
// Organisasi & petugas, bukan lewat berkas.

import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readProgresCater } from "../lib/csv"
import { normalizeMerk } from "../lib/normalize"

const STEP = "04-pencatat"

export async function seedPencatat(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const names = new Set<string>()

  for (const row of readProgresCater()) {
    const n = normalizeMerk(row.pencatat) // UPPER+TRIM, sama seperti normalisasi merk
    if (n) names.add(n)
  }
  for (const namaLapangan of names) {
    const existing = await prisma.pencatat.findUnique({ where: { namaLapangan } })
    await prisma.pencatat.upsert({
      where: { namaLapangan },
      create: { namaLapangan },
      update: {},
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  await seedPenugasanRute(prisma, report)
}

/// PenugasanRute: rute mana dipegang pencatat mana.
///
/// KENAPA INI HARUS ADA DI SEED. Sebelumnya TIDAK ADA satu pun step yang
/// mengisi tabel ini — isinya cuma 29 baris entah dari mana, untuk 123 rute.
/// Akibatnya baru terlihat saat fitur "buka bulan baru" dibangun: daftar
/// kerja bulan depan kehilangan penugasan 17.578 sambungan sekaligus, karena
/// penugasan resminya memang tidak pernah dibuat.
///
/// Datanya sebenarnya ada dan tidak ambigu: ProgresCater 202605 punya 125
/// pasangan (rute_kode, pencatat) unik untuk 125 rute — SATU pencatat per
/// rute, tanpa satu pun rute berpetugas ganda. Jadi tabel ini bukan
/// menebak apa pun, ia hanya memindahkan fakta yang sudah tertulis.
async function seedPenugasanRute(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const pasangan = new Map<string, string>() // rute_kode -> nama pencatat
  const ganda = new Map<string, Set<string>>()
  for (const row of readProgresCater()) {
    const rute = row.rute_kode.trim()
    const nama = normalizeMerk(row.pencatat)
    if (!rute || rute === "-" || !nama || nama === "-") continue
    const sudah = pasangan.get(rute)
    if (sudah && sudah !== nama) {
      let s = ganda.get(rute)
      if (!s) {
        s = new Set([sudah])
        ganda.set(rute, s)
      }
      s.add(nama)
      continue // pertahankan yang pertama; kasusnya dilaporkan di bawah
    }
    if (!sudah) pasangan.set(rute, nama)
  }
  for (const [rute, nama] of ganda) {
    report.warn(STEP, `Rute ${rute} punya lebih dari satu pencatat di sumber (${[...nama].join(", ")}) — dipakai yang pertama`, {
      key: rute,
    })
  }

  const [ruteRows, pencatatRows] = await Promise.all([
    prisma.rute.findMany({ select: { id: true, kode: true } }),
    prisma.pencatat.findMany({ select: { id: true, namaLapangan: true } }),
  ])
  const ruteId = new Map(ruteRows.map((r) => [r.kode, r.id]))
  const pencatatId = new Map(pencatatRows.map((p) => [p.namaLapangan, p.id]))

  for (const [kodeRute, namaPencatat] of pasangan) {
    const rId = ruteId.get(kodeRute)
    const pId = pencatatId.get(namaPencatat)
    if (!rId || !pId) {
      report.warn(
        STEP,
        `Penugasan ${kodeRute} -> ${namaPencatat} dilewati (${!rId ? "rute" : "pencatat"} belum ada di database)`,
        { key: kodeRute }
      )
      report.skipped(STEP)
      continue
    }
    const existing = await prisma.penugasanRute.findUnique({
      where: { pencatatId_ruteId: { pencatatId: pId, ruteId: rId } },
    })
    await prisma.penugasanRute.upsert({
      where: { pencatatId_ruteId: { pencatatId: pId, ruteId: rId } },
      create: { pencatatId: pId, ruteId: rId },
      update: {},
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }
}
