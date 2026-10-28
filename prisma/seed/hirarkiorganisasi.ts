// prisma/seed-subbagian.ts
// Tambalan: insert SubBagian yang belum ter-seed.
// AMAN dijalankan tanpa hapus data existing (pakai upsert).
// Jalankan: bun prisma/seed/hirarkiorganisasi.ts

import { prisma } from "./lib/db"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const SUB_BAGIAN_PELAYANAN = [
  { suffix: "CATER", nama: "PENCATATAN METER" },
  { suffix: "ZONA", nama: "SUB ZONA" },
  { suffix: "LANG", nama: "LANGGANAN" },
  { suffix: "NRW", nama: "NRW" },
] as const

const SUB_BAGIAN_TEHNIK: Record<string, { suffix: string; nama: string }[]> = {
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
}

const SUB_BAGIAN_UMUM: Record<string, { suffix: string; nama: string }[]> = {
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
}

const SUB_BAGIAN_UTAMA: Record<string, { suffix: string; nama: string }[]> = {
  "BAGIAN-SEKDIR": [
    { suffix: "ADM", nama: "ADMINISTRASI & KORESPONDENSI" },
    { suffix: "PROTO", nama: "PROTOKOL & KEARSIPAN" },
  ],
  "BAGIAN-SPI": [
    { suffix: "AUDIT", nama: "AUDIT INTERNAL" },
    { suffix: "EVAL", nama: "EVALUASI & PELAPORAN" },
  ],
}

async function main() {
  console.log("📄  Seed SubBagian (tambalan — data lain tidak tersentuh)...\n")

  // Ambil semua Bagian yang sudah ada di DB berdasarkan kode
  const semuaBagian = await prisma.bagian.findMany({
    select: { id: true, kode: true, nama: true },
  })

  if (semuaBagian.length === 0) {
    console.error("❌  Tidak ada Bagian di database. Jalankan seed utama dulu.")
    process.exit(1)
  }

  // Buat map kode → id dari data DB yang sudah ada
  const bagianMap: Record<string, string> = {}
  for (const b of semuaBagian) {
    bagianMap[b.kode] = b.id
  }

  console.log(`✓  Ditemukan ${semuaBagian.length} Bagian di DB:\n`)
  semuaBagian.forEach((b) => console.log(`   - [${b.kode}] ${b.nama}`))
  console.log()

  let total = 0

  // ── PELAYANAN Wilayah 1–5 ──────────────────────────────────
  for (let w = 1; w <= 5; w++) {
    const bagianKode = `BAGIAN-PW${w}`
    if (!bagianMap[bagianKode]) {
      console.warn(
        `   ⚠️  Bagian ${bagianKode} tidak ditemukan di DB, dilewati.`
      )
      continue
    }
    for (const sub of SUB_BAGIAN_PELAYANAN) {
      const kode = `SUB-PW${w}-${sub.suffix}`
      await prisma.subBagian.upsert({
        where: { kode },
        update: { nama: sub.nama },
        create: { kode, nama: sub.nama, bagianId: bagianMap[bagianKode] },
      })
      console.log(`   ✓ [PW${w}] ${sub.nama}`)
      total++
    }
  }

  // ── TEHNIK ─────────────────────────────────────────────────
  for (const [bagianKode, subs] of Object.entries(SUB_BAGIAN_TEHNIK)) {
    if (!bagianMap[bagianKode]) {
      console.warn(
        `   ⚠️  Bagian ${bagianKode} tidak ditemukan di DB, dilewati.`
      )
      continue
    }
    for (const sub of subs) {
      const kode = `SUB-${bagianKode.replace("BAGIAN-", "")}-${sub.suffix}`
      await prisma.subBagian.upsert({
        where: { kode },
        update: { nama: sub.nama },
        create: { kode, nama: sub.nama, bagianId: bagianMap[bagianKode] },
      })
      console.log(`   ✓ [${bagianKode}] ${sub.nama}`)
      total++
    }
  }

  // ── UMUM ───────────────────────────────────────────────────
  for (const [bagianKode, subs] of Object.entries(SUB_BAGIAN_UMUM)) {
    if (!bagianMap[bagianKode]) {
      console.warn(
        `   ⚠️  Bagian ${bagianKode} tidak ditemukan di DB, dilewati.`
      )
      continue
    }
    for (const sub of subs) {
      const kode = `SUB-${bagianKode.replace("BAGIAN-", "")}-${sub.suffix}`
      await prisma.subBagian.upsert({
        where: { kode },
        update: { nama: sub.nama },
        create: { kode, nama: sub.nama, bagianId: bagianMap[bagianKode] },
      })
      console.log(`   ✓ [${bagianKode}] ${sub.nama}`)
      total++
    }
  }

  // ── UTAMA ──────────────────────────────────────────────────
  for (const [bagianKode, subs] of Object.entries(SUB_BAGIAN_UTAMA)) {
    if (!bagianMap[bagianKode]) {
      console.warn(
        `   ⚠️  Bagian ${bagianKode} tidak ditemukan di DB, dilewati.`
      )
      continue
    }
    for (const sub of subs) {
      const kode = `SUB-${bagianKode.replace("BAGIAN-", "")}-${sub.suffix}`
      await prisma.subBagian.upsert({
        where: { kode },
        update: { nama: sub.nama },
        create: { kode, nama: sub.nama, bagianId: bagianMap[bagianKode] },
      })
      console.log(`   ✓ [${bagianKode}] ${sub.nama}`)
      total++
    }
  }

  // ── Perbaikan nama Divisi (DIVISI → DIREKTORAT) ────────────
  console.log("\n🔧  Perbaikan nama Direktorat...")
  const perbaikanNama = [
    { kode: "PELAYANAN", nama: "DIREKTORAT PELAYANAN" },
    { kode: "TEHNIK", nama: "DIREKTORAT TEHNIK" },
    { kode: "UMUM", nama: "DIREKTORAT UMUM" },
  ] as const
  for (const d of perbaikanNama) {
    await prisma.divisi.update({
      where: { kode: d.kode },
      data: { nama: d.nama },
    })
    console.log(`   ✓ ${d.nama}`)
  }

  console.log(`\n✅  Selesai! ${total} SubBagian berhasil di-upsert.\n`)
}

// Export untuk dipanggil dari seed/index.ts
export async function seedSubBagian() {
  await main()
}

// Hanya jalan kalau file ini dieksekusi langsung
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main()
    .catch((e) => {
      console.error("❌  Gagal:", e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
