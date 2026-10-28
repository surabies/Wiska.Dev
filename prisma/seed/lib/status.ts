// prisma/seed/lib/status.ts — SATU-SATUNYA tempat yang boleh memutuskan
// Pelanggan.status berubah atau tidak. Sengaja dipisah dari steps/*.ts
// dan dibuat sangat konservatif: satu baris CSV yang ambigu TIDAK BOLEH
// membalik status pelanggan tanpa sinyal yang pasti.
//
// SATU KAMUS UNTUK SEMUA DIALEK. Kedua berkas sumber menamai dua konsep
// yang SAMA dengan kata yang berbeda, dan dulu masing-masing diterjemahkan
// di tempat terpisah — akibatnya "tupsp" dan "SPT" berujung status berbeda
// padahal artinya satu. Seluruh penerjemahan sekarang di sini:
//
//   konsep            ProgresCater.mutasinama   r-nomor.jenis_pemutusan
//   aktif             "PELANGGAN AKTIF"         —
//   tutup sementara   "tupsm"                   "TSM"
//   tutup SPT         "tupsp"                   "SPT"
//
// ARTI BISNISNYA (ditetapkan pemilik data):
// - TUTUP_SPT = penutupan karena TUNGGAKAN. Sambungan hanya bisa aktif
//   kembali setelah pelanggan melunasi seluruh tunggakannya — keputusan
//   loket, bukan sesuatu yang boleh disimpulkan dari berkas closing.
// - TUTUP_SEMENTARA = penutupan atas permintaan pelanggan sendiri, dan
//   lazimnya tanpa tunggakan. Karena itu ia BOLEH hidup kembali otomatis
//   begitu nomornya muncul lagi di ProgresCater.
//
// Aturan inti (jangan diubah tanpa alasan kuat & didiskusikan dulu):
// 1. Kosakata yang dikenali hanya yang SUDAH TERVERIFIKASI ada di data.
//    Nilai di luar itu memulangkan null — tidak ditebak.
// 2. Kalau status pelanggan yang SUDAH ADA di database berstatus terminal
//    (TUTUP_SPT), ProgresCater TIDAK BOLEH "menghidupkan
//    kembali" ke AKTIF/TUTUP_SEMENTARA hanya karena nolg itu masih
//    muncul di file closing bulan ini — itu keputusan bisnis yang perlu
//    konfirmasi manusia, bukan inferensi otomatis. Aturan ini justru yang
//    menegakkan syarat pelunasan tunggakan di atas.
// 3. Pemutusan (r-nomor) TIDAK PERNAH menulis Pelanggan.status sama
//    sekali (lihat steps/09-pemutusan.ts) — hanya mencatat baris
//    Pemutusan-nya, lalu men-flag ke SeedReport untuk ditinjau manusia.
//    Yang MENULIS status dari kosakata r-nomor adalah step 11, lewat
//    mapJenisPemutusanToStatus() di bawah.

import type { StatusPelanggan } from "@generated"

const TERMINAL_STATUSES: ReadonlySet<StatusPelanggan> = new Set(["TUTUP_SPT"])

/// Status yang tidak boleh dicabut kembali oleh inferensi otomatis.
/// TUTUP_SPT menahan sambungan sampai tunggakannya lunas — menurunkannya
/// ke TUTUP_SEMENTARA membuka jalan reaktivasi tanpa pelunasan, jadi hanya
/// bukti eksplisit (kosakata r-nomor/ProgresCater) yang boleh mengubahnya,
/// tidak pernah tebakan. Dipakai step 11 selain oleh resolvePelangganStatus.
export function statusTerminal(status: StatusPelanggan): boolean {
  return TERMINAL_STATUSES.has(status)
}

/// Dialek ProgresCater.mutasinama. Nilai di luar kosakata yang sudah
/// teraudit sengaja return null, BUKAN ditebak — caller tidak akan
/// mengubah status kalau null.
export function mapMutasiNamaToStatus(
  raw: string | null | undefined
): StatusPelanggan | null {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "pelanggan aktif") return "AKTIF"
  if (v === "tupsm") return "TUTUP_SEMENTARA"
  if (v === "tupsp") return "TUTUP_SPT"
  return null
}

/// Dialek r-nomor.jenis_pemutusan — kata beda, konsep sama dengan di atas.
/// Dipakai step 11 untuk pelanggan yang hilang dari ProgresCater. Null =
/// nomornya tidak ada di r-nomor mana pun; jenisnya TIDAK boleh ditebak,
/// pemanggil wajib menandainya untuk ditinjau petugas.
export function mapJenisPemutusanToStatus(
  raw: string | null | undefined
): StatusPelanggan | null {
  const v = (raw ?? "").trim().toUpperCase()
  if (v === "TSM") return "TUTUP_SEMENTARA"
  if (v === "SPT") return "TUTUP_SPT"
  return null
}

export interface StatusResolution {
  status: StatusPelanggan
  changed: boolean
  reason: string
}

export function resolvePelangganStatus(params: {
  /// null = pelanggan baru (belum ada row di DB).
  existingStatus: StatusPelanggan | null
  /// Hasil mapMutasiNamaToStatus() untuk baris ProgresCater saat ini.
  mutasiNamaStatus: StatusPelanggan | null
}): StatusResolution {
  const { existingStatus, mutasiNamaStatus } = params

  if (existingStatus === null) {
    const status = mutasiNamaStatus ?? "AKTIF"
    return {
      status,
      changed: true,
      reason: mutasiNamaStatus
        ? `pelanggan baru, status dari mutasinama (${mutasiNamaStatus})`
        : "pelanggan baru, mutasinama tidak dikenali -> default AKTIF",
    }
  }

  if (TERMINAL_STATUSES.has(existingStatus)) {
    return {
      status: existingStatus,
      changed: false,
      reason: `status existing (${existingStatus}) bersifat terminal — ProgresCater tidak pernah mengubah status terminal`,
    }
  }

  if (mutasiNamaStatus === null) {
    return {
      status: existingStatus,
      changed: false,
      reason: "mutasinama pada baris ini tidak dikenali, status existing dipertahankan",
    }
  }

  if (mutasiNamaStatus === existingStatus) {
    return { status: existingStatus, changed: false, reason: "tidak ada perubahan" }
  }

  return {
    status: mutasiNamaStatus,
    changed: true,
    reason: `mutasinama pada periode ini menyatakan ${mutasiNamaStatus} (sebelumnya ${existingStatus})`,
  }
}
