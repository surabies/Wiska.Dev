// scripts/perbaiki-jenis-pemutusan.ts — mengisi Pemutusan.jenis untuk baris
// warisan yang tersimpan sebagai LAINNYA, dengan membacanya dari ProgresCater.
//
// Jalankan: pnpm server:perbaiki-jenis-pemutusan          (pratinjau, tidak menulis)
//           pnpm server:perbaiki-jenis-pemutusan --terapkan
//
// KENAPA PERLU. Baris ber-sumberData PROGRESCATER_HILANG lahir dari deteksi
// "ada di DRD bulan lalu, hilang bulan ini" — deteksi itu tahu SEBUAH
// sambungan putus, tapi tidak tahu TSM atau SPT, jadi jenisnya ditulis
// LAINNYA. Label itu jujur pada saat dibuat, tetapi ternyata KELIRU sebagai
// kesimpulan akhir: jawabannya ada di berkas yang sama-sama sudah kita punya.
//
// ProgresCater punya kolom `mutasinama` yang berisi "tupsm" (tutup sementara)
// atau "tupsp" (tutup SPT) pada periode terakhir sambungan itu muncul.
// PERHATIAN: untuk baris tutup, `mutasikode`-nya KOSONG — hanya `mutasinama`
// yang terisi. Karena itu peta STATUS_DARI_MUTASI di master-sti.service.ts
// (yang membaca kode 4/5) tidak bisa dipakai di sini.
//
// PEMETAANNYA DIUJI, BUKAN DIASUMSIKAN. Terhadap seluruh berkas r-nomor yang
// ada (feb, mar, apr, mei, juni) — dokumen resmi pemutusan — pemetaan
// tupsm->TSM dan tupsp->SPT cocok pada 98 dari 98 baris, tanpa satu pun
// meleset. Skrip ini menjalankan ulang uji itu sebelum menulis apa pun dan
// BERHENTI kalau ada yang meleset: kalau pemetaannya ternyata tidak lagi
// berlaku pada data baru, yang benar adalah berhenti, bukan menimpa 99 baris
// dengan tebakan.
//
// YANG TIDAK KETAHUAN DIBIARKAN. Sambungan yang penampakan terakhirnya di
// ProgresCater masih "PELANGGAN AKTIF" lalu hilang begitu saja tidak punya
// jejak tutup sama sekali. Barisnya dilewati dan dilaporkan — tetap LAINNYA.
import { DATA_DIR } from "./env"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { prisma } from "@db"
import type { JenisPemutusan } from "@db"

/// Folder berkas sumber -> thbl. Urutan menentukan mana yang dianggap
/// "penampakan terakhir".
const PERIODE_BERKAS: Record<string, number> = {
  jan: 202601,
  feb: 202602,
  mar: 202603,
  apr: 202604,
  mei: 202605,
  juni: 202606,
  juli: 202607,
}

function bacaKolom(path: string, kolom: string[]): Record<string, string>[] {
  const teks = readFileSync(path, "utf8").replace(/^﻿/, "")
  const garis = teks.split(/\r?\n/).filter((g) => g.trim() !== "")
  const header = garis[0]!.split(";").map((h) => h.trim())
  const idx = kolom.map((k) => header.indexOf(k))
  return garis.slice(1).map((g) => {
    const sel = g.split(";")
    return Object.fromEntries(
      kolom.map((k, i) => [k, (sel[idx[i]!] ?? "").trim()]),
    )
  })
}

const nolg = (v: string) => v.trim().padStart(11, "0")

/// mutasinama -> jenis. Hanya dua yang diterjemahkan; sisanya (termasuk
/// "PELANGGAN AKTIF" dan "Pembukaan Kembali PS") sengaja tidak.
function jenisDariMutasi(mutasi: string | undefined): JenisPemutusan | null {
  if (mutasi === "tupsm") return "TSM"
  if (mutasi === "tupsp") return "SPT"
  return null
}

async function main(): Promise<void> {
  const terapkan = process.argv.includes("--terapkan")

  // Penampakan TERAKHIR tiap nomor di ProgresCater, beserta mutasinama-nya.
  const mutasiTerakhir = new Map<string, string>()
  for (const [dir] of Object.entries(PERIODE_BERKAS).sort(
    (a, b) => a[1] - b[1],
  )) {
    const path = resolve(DATA_DIR, dir, "ProgresCater-PW5.csv")
    if (!existsSync(path)) continue
    for (const r of bacaKolom(path, ["nolg", "mutasinama"])) {
      if (r.nolg) mutasiTerakhir.set(nolg(r.nolg!), r.mutasinama!)
    }
  }
  console.log(`ProgresCater: ${mutasiTerakhir.size} nomor terbaca`)

  // ── Uji pemetaan terhadap r-nomor (dokumen resmi) sebelum menulis ──
  let cocok = 0
  const meleset: string[] = []
  for (const dir of Object.keys(PERIODE_BERKAS)) {
    const path = resolve(DATA_DIR, dir, "r-nomor.csv")
    if (!existsSync(path)) continue
    for (const r of bacaKolom(path, ["nomor_pelanggan", "jenis_pemutusan"])) {
      if (!r.nomor_pelanggan) continue
      const harap = jenisDariMutasi(
        mutasiTerakhir.get(nolg(r.nomor_pelanggan!)),
      )
      const asli = r.jenis_pemutusan!.toUpperCase()
      if (harap === asli) cocok++
      else
        meleset.push(
          `${nolg(r.nomor_pelanggan!)}: r-nomor=${asli} tapi ProgresCater=${harap ?? "-"}`,
        )
    }
  }
  console.log(
    `Uji pemetaan terhadap r-nomor: ${cocok} cocok, ${meleset.length} meleset`,
  )
  if (meleset.length > 0) {
    console.error(
      "BERHENTI — pemetaan tupsm/tupsp tidak lagi cocok dengan r-nomor:",
    )
    for (const m of meleset.slice(0, 20)) console.error(`  ${m}`)
    process.exitCode = 1
    return
  }

  const rows = await prisma.pemutusan.findMany({
    where: { jenis: "LAINNYA" },
    select: { id: true, periode: true, nomorLangganan: true, sumberData: true },
    orderBy: [{ periode: "asc" }, { nomorLangganan: "asc" }],
  })
  console.log(`Baris Pemutusan berjenis LAINNYA: ${rows.length}`)

  const rencana: {
    id: string
    jenis: JenisPemutusan
    nomorLangganan: string
  }[] = []
  const dilewati: string[] = []
  for (const r of rows) {
    const jenis = r.nomorLangganan
      ? jenisDariMutasi(mutasiTerakhir.get(r.nomorLangganan))
      : null
    if (!jenis) {
      dilewati.push(
        `${r.nomorLangganan ?? "(tanpa nomor)"} periode ${r.periode} — mutasi terakhir "${(r.nomorLangganan && mutasiTerakhir.get(r.nomorLangganan)) ?? "tidak ada di ProgresCater"}"`,
      )
      continue
    }
    rencana.push({ id: r.id, jenis, nomorLangganan: r.nomorLangganan! })
  }

  const perJenis = rencana.reduce<Record<string, number>>(
    (a, r) => ({ ...a, [r.jenis]: (a[r.jenis] ?? 0) + 1 }),
    {},
  )
  console.log(`Bisa ditentukan: ${rencana.length}`, perJenis)
  console.log(`Dibiarkan LAINNYA: ${dilewati.length}`)
  for (const d of dilewati) console.log(`  ${d}`)

  if (!terapkan) {
    console.log(
      "\n(PRATINJAU — tidak ada yang ditulis. Tambahkan --terapkan untuk menjalankan.)",
    )
    await prisma.$disconnect()
    return
  }

  let diubah = 0
  for (const r of rencana) {
    await prisma.pemutusan.update({
      where: { id: r.id },
      data: { jenis: r.jenis },
    })
    diubah++
  }
  console.log(`\nDiperbarui: ${diubah} baris`)
  console.log(
    `Sisa berjenis LAINNYA: ${await prisma.pemutusan.count({ where: { jenis: "LAINNYA" } })}`,
  )
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exitCode = 1
})
