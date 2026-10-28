// prisma/seed/steps/06-meter.ts — METER SAJA, dari ProgresCater.
//
// Step ini TIDAK membuat PembacaanMeter maupun Tagihan, dan itu disengaja.
// Pembacaan lahir dari impor pencatatan (/dashboard/impor), tagihan dari
// closing (/dashboard/closing) — keduanya jalur aplikasi. Seed hanya
// menyiapkan data induk supaya siklus bulanan punya pijakan.
//
// HISTORI PENGGANTIAN METER: `Meter.pelangganId` sudah diubah dari @unique
// jadi relasi 1:banyak (lihat tagihan.prisma) supaya baris histori meter
// lama tidak tertimpa. Logikanya di bawah: cari meter AKTIF pelanggan ini
// (isAktif=true) — kalau nomorMeter-nya SAMA, itu meter fisik yang sama,
// cukup update baris itu. Kalau nomorMeter BEDA, meter fisik sudah
// diganti: baris lama ditandai isAktif=false (disimpan sebagai histori,
// TIDAK dihapus/ditimpa), baris BARU dibuat dengan isAktif=true.
//
// KINERJA: baris diproses dalam kelompok paralel (KONKURENSI), bukan satu
// per satu, dan semua lookup di-preload sekali di awal jadi Map di memori.
// Aman karena `nolg` unik di dalam satu periode ProgresCater — dua baris
// untuk pelanggan yang sama berasal dari bulan berbeda dan berjarak ~22.500
// posisi, jadi tidak pernah satu kelompok dan tidak ada balapan pada logika
// penggantian meter. try/catch PER BARIS dipertahankan.

import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readProgresCater } from "../lib/csv"
import {
  normalizeNolg,
  normalizeMerk,
  normalizeUkuranMeter,
  parseIsoDate,
  parseIntOrNull,
  trimOrNull,
} from "../lib/normalize"

const STEP = "06-meter"

/// Berapa baris diproses bersamaan. Cukup besar untuk menutupi latensi
/// jaringan ke Postgres terkelola, cukup kecil supaya tidak menghabiskan
/// pool koneksi (@prisma/adapter-pg default 10-ish) atau meledakkan memori.
const KONKURENSI = 16

export async function seedMeter(
  prisma: PrismaClientLike,
  report: SeedReport
): Promise<void> {
  const rows = readProgresCater()

  // --- Preload semua lookup sekali (lihat catatan KINERJA di atas file) ---
  const [pelangganRows, meterRows] = await Promise.all([
    prisma.pelanggan.findMany({ select: { id: true, nomorLangganan: true } }),
    prisma.meter.findMany({
      where: { isAktif: true },
      select: { id: true, pelangganId: true, nomorMeter: true },
    }),
  ])
  const pelangganCache = new Map(pelangganRows.map((p) => [p.nomorLangganan, p.id]))
  // Satu meter AKTIF per pelanggan ditegakkan di step ini (bukan di DB),
  // jadi Map pelangganId -> meter aktif sudah mewakili.
  const meterAktifCache = new Map(meterRows.map((m) => [m.pelangganId, m]))

  async function prosesBaris(row: (typeof rows)[number], i: number): Promise<void> {
    const nomorLangganan = normalizeNolg(row.nolg)
    if (!nomorLangganan) return // sudah di-log sebagai warning di step 05

    const pelangganId = pelangganCache.get(nomorLangganan)
    if (!pelangganId) {
      report.warn(STEP, `Pelanggan ${nomorLangganan} tidak ditemukan (step 05 mestinya sudah buat), baris dilewati`, {
        row: i,
        key: nomorLangganan,
      })
      report.skipped(STEP)
      return
    }

    const nomorMeter = trimOrNull(row.nometer)
    const ukuran = normalizeUkuranMeter(row.ukmeter)
    if (!nomorMeter || !ukuran) {
      report.warn(STEP, `nometer/ukmeter tidak valid untuk ${nomorLangganan}, Meter+Tagihan dilewati`, {
        key: nomorLangganan,
      })
      report.skipped(STEP)
      return
    }

    // --- Meter (histori penggantian, lihat catatan atas file) ---
    // Tipe plain object (bukan Prisma.MeterUncheckedUpdateInput) supaya
    // bisa dipakai untuk create MAUPUN update tanpa konflik tipe —
    // UpdateInput mengizinkan wrapper operasi (mis. { set: ... }) yang
    // tidak valid untuk CreateInput.
    const meterFields: {
      nomorSegel?: string
      merkKode?: string
      tanggalPasang?: Date
      umurTahun?: number
      umurBulan?: number
      umurHari?: number
    } = {}
    const nomorSegel = trimOrNull(row.nosegelmeter)
    if (nomorSegel) meterFields.nomorSegel = nomorSegel
    const merkKode = normalizeMerk(row.kd_merkmeter)
    if (merkKode) meterFields.merkKode = merkKode
    const tanggalPasang = parseIsoDate(row.tglpasangmeter)
    if (tanggalPasang) meterFields.tanggalPasang = tanggalPasang
    const umurTahun = parseIntOrNull(row.umurmeterthn)
    if (umurTahun !== null) meterFields.umurTahun = umurTahun
    const umurBulan = parseIntOrNull(row.umurmeterbln)
    if (umurBulan !== null) meterFields.umurBulan = umurBulan
    const umurHari = parseIntOrNull(row.umurmeterhari)
    if (umurHari !== null) meterFields.umurHari = umurHari

    let meterId: string
    try {
      const meterAktif = meterAktifCache.get(pelangganId)

      if (!meterAktif) {
        const created = await prisma.meter.create({
          data: { pelangganId, nomorMeter, ukuran, isAktif: true, ...meterFields },
        })
        meterId = created.id
        meterAktifCache.set(pelangganId, { id: created.id, pelangganId, nomorMeter })
        report.created(`${STEP}:meter`)
      } else if (meterAktif.nomorMeter === nomorMeter) {
        const updated = await prisma.meter.update({
          where: { id: meterAktif.id },
          data: { ukuran, ...meterFields },
        })
        meterId = updated.id
        report.updated(`${STEP}:meter`)
      } else {
        // Meter fisik berganti: nonaktifkan baris lama (histori tetap
        // ada), buat baris baru sebagai meter aktif.
        await prisma.meter.update({
          where: { id: meterAktif.id },
          data: { isAktif: false },
        })
        report.warn(
          STEP,
          `Meter pelanggan ${nomorLangganan} berganti (${meterAktif.nomorMeter} -> ${nomorMeter}) — baris lama disimpan sebagai histori (isAktif=false), baris baru dibuat`,
          { key: nomorLangganan }
        )
        const created = await prisma.meter.create({
          data: { pelangganId, nomorMeter, ukuran, isAktif: true, ...meterFields },
        })
        meterId = created.id
        meterAktifCache.set(pelangganId, { id: created.id, pelangganId, nomorMeter })
        report.created(`${STEP}:meter`)
      }
    } catch (err) {
      report.error(STEP, `Gagal proses Meter ${nomorLangganan}: ${(err as Error).message}`, {
        key: nomorLangganan,
      })
      return
    }

  }

  // Proses berkelompok secara paralel. try/catch ada di dalam prosesBaris
  // (per baris), jadi satu baris gagal tidak menjatuhkan kelompoknya.
  for (let mulai = 0; mulai < rows.length; mulai += KONKURENSI) {
    const kelompok = rows.slice(mulai, mulai + KONKURENSI)
    await Promise.all(kelompok.map((row, n) => prosesBaris(row, mulai + n)))
  }
}
