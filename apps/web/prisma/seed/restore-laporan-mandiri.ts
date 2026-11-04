// prisma/seed/restore-laporan-mandiri.ts — pulihkan backup laporan_mandiri
// (periode Juli/Agustus, 400 baris) ke database Neon yang baru.
//
// KENAPA SKRIP TERPISAH, BUKAN STEP SEED BIASA: baris di
// `laporan_mandiri_backup_neon.csv` menyimpan `pelangganId` dari database
// LAMA. Database baru ini dibentuk ulang dari nol (lihat RESET-DAN-SEED.md),
// jadi id Pelanggan-nya sudah pasti berbeda — satu-satunya kunci yang tetap
// valid untuk mencocokkan adalah `nomorLangganan`.
//
// DUA KOLOM FK DISENGAJA DI-NULL-KAN saat restore, TIDAK disalin apa
// adanya dari backup:
//   - verifiedById -> tabel User di database baru masih kosong (bootstrap
//     admin/pencatat belum dijalankan). Menyalin nilai lama akan melanggar
//     foreign key.
//   - pembacaanId  -> tabel PembacaanMeter sengaja TIDAK diseed di migrasi
//     ini (step 06 dilewati, lihat RESET-DAN-SEED.md alasan "efisiensi
//     biaya" — aplikasi untuk sementara hanya dipakai laporan mandiri &
//     pengaduan). Baris manapun yang pernah ber-pembacaanId di backup akan
//     kehilangan tautannya di sini; itu dicatat sebagai warning, bukan
//     galat, karena datanya sendiri (standDilaporkan, status, foto) tetap
//     dipulihkan utuh.
//
// Field lain (status, alasanDitolak, verifiedAt, timestamp) disalin APA
// ADANYA sebagai snapshot historis — termasuk `id` asli, supaya jejak
// audit dari sistem lama tetap bisa ditelusuri.
//
// Aman dijalankan berkali-kali: upsert berdasar (pelangganId, periode),
// unique constraint yang sama dipakai skema (@@unique([pelangganId, periode])).
//
// Jalankan: pnpm exec tsx prisma/seed/restore-laporan-mandiri.ts

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "csv-parse/sync"
import { prisma } from "./lib/db"
import { normalizeNolg } from "./lib/normalize"

const BERKAS = join(process.cwd(), "prisma", "laporan_mandiri_backup_neon.csv")

interface BackupRow {
  id: string
  pelangganId: string
  nomorLangganan: string
  periode: string
  standDilaporkan: string
  fotoUrl: string
  fotoPublicId: string
  nomorPelapor: string
  namaPelapor: string
  status: string
  verifiedById: string
  verifiedAt: string
  alasanDitolak: string
  pembacaanId: string
  createdAt: string
  updatedAt: string
}

async function main(): Promise<void> {
  const isi = readFileSync(BERKAS, "utf-8")
  const rows = parse(isi, { columns: true, bom: true, skip_empty_lines: true }) as BackupRow[]

  const pelangganRows = await prisma.pelanggan.findMany({ select: { id: true, nomorLangganan: true } })
  const pelangganMap = new Map(pelangganRows.map((p) => [p.nomorLangganan, p.id]))

  let dipulihkan = 0
  let dilewatiNolgTidakKetemu = 0
  let verifiedByIdDibuang = 0
  let pembacaanIdDibuang = 0
  const contohDilewati: string[] = []

  for (const row of rows) {
    const nomorLangganan = normalizeNolg(row.nomorLangganan)
    if (!nomorLangganan) continue

    const pelangganId = pelangganMap.get(nomorLangganan)
    if (!pelangganId) {
      dilewatiNolgTidakKetemu++
      if (contohDilewati.length < 10) contohDilewati.push(nomorLangganan)
      continue
    }

    if (row.verifiedById) verifiedByIdDibuang++
    if (row.pembacaanId) pembacaanIdDibuang++

    const periode = Number.parseInt(row.periode, 10)

    await prisma.laporanMandiri.upsert({
      where: { pelangganId_periode: { pelangganId, periode } },
      create: {
        id: row.id,
        pelangganId,
        nomorLangganan,
        periode,
        standDilaporkan: Number.parseInt(row.standDilaporkan, 10),
        fotoUrl: row.fotoUrl,
        fotoPublicId: row.fotoPublicId,
        nomorPelapor: row.nomorPelapor,
        namaPelapor: row.namaPelapor,
        status: row.status as never,
        verifiedById: null,
        verifiedAt: row.verifiedAt ? new Date(row.verifiedAt) : null,
        alasanDitolak: row.alasanDitolak || null,
        pembacaanId: null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
      },
      update: {},
    })
    dipulihkan++
  }

  console.log("=========== RESTORE laporan_mandiri ===========")
  console.log(`Baris di backup                 : ${rows.length}`)
  console.log(`Dipulihkan                       : ${dipulihkan}`)
  console.log(`Dilewati (nomorLangganan tidak ketemu di Pelanggan agustus): ${dilewatiNolgTidakKetemu}`)
  if (contohDilewati.length > 0) console.log(`  contoh: ${contohDilewati.join(", ")}`)
  console.log(`verifiedById dibuang (User kosong di DB baru)  : ${verifiedByIdDibuang}`)
  console.log(`pembacaanId dibuang (PembacaanMeter tidak diseed): ${pembacaanIdDibuang}`)

  const totalDb = await prisma.laporanMandiri.count()
  console.log(`Total laporan_mandiri di DB sekarang: ${totalDb}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error("Restore gagal:", err)
  await prisma.$disconnect()
  process.exitCode = 1
})
