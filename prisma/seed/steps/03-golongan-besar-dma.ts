// prisma/seed/steps/03-golongan-besar-dma.ts — GolonganBesar (gbid/gbnama)
// dan Dma (dmakode), keduanya dari ProgresCater. gbid->gbnama sudah
// diverifikasi 1:1 konsisten di seluruh data (41 entri: bank, hotel,
// instansi pemerintah, militer). dmakode SANGAT jarang terisi (~8 baris
// nyata) — Dma dibuat seadanya dari yang ada, bukan berarti datanya
// lengkap.

import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readProgresCater } from "../lib/csv"

const STEP = "03-golongan-besar-dma"

export async function seedGolonganBesarDma(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const rows = readProgresCater()

  const golonganBesarMap = new Map<string, string>()
  const dmaKodes = new Set<string>()

  for (const row of rows) {
    const gbid = row.gbid.trim()
    if (gbid && !golonganBesarMap.has(gbid)) {
      golonganBesarMap.set(gbid, row.gbnama.trim())
    }
    const dmakode = row.dmakode.trim()
    if (dmakode && dmakode !== "-") dmaKodes.add(dmakode)
  }

  for (const [kode, nama] of golonganBesarMap) {
    const existing = await prisma.golonganBesar.findUnique({ where: { kode } })
    await prisma.golonganBesar.upsert({
      where: { kode },
      create: { kode, nama },
      update: { nama },
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  for (const kode of dmaKodes) {
    const existing = await prisma.dma.findUnique({ where: { kode } })
    await prisma.dma.upsert({
      where: { kode },
      create: { kode },
      update: {},
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }
}
