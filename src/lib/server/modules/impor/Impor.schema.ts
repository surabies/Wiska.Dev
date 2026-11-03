// server/modules/impor/Impor.schema.ts — skema validasi Zod & tipe kontrak
// untuk impor berkas sumber per batch (pencatatan harian & pemutusan).
import { z } from "zod"

/// Sengaja tidak besar: satu batch harus selesai jauh di bawah batas
/// timeout proxy mana pun, dan cukup kecil supaya bilah kemajuan bergerak
/// terasa hidup. 500 baris ~ 1-2 detik pada koneksi normal.
export const MAKS_BARIS_PER_BATCH = 1000

/// DIPERBARUI dipisahkan dari TERSIMPAN dengan sengaja. Baris pemutusan
/// kerap SUDAH ADA di database dari sumber yang lebih lemah (deteksi "hilang
/// dari ProgresCater" atau kondisi catat "D" — lihat sumberData di model
/// Pemutusan), dan r-nomor datang belakangan membawa jenis & nomor suratnya.
/// Menghitungnya sebagai "tersimpan" akan menyembunyikan bahwa yang terjadi
/// adalah pelengkapan baris lama, bukan penambahan baris baru.
export type StatusBaris =
  "TERSIMPAN" | "DIPERBARUI" | "DUPLIKAT" | "DILEWATI" | "GAGAL"

export interface HasilBaris {
  /// Nomor baris di BERKAS ASLI (bukan di batch) — supaya pengguna bisa
  /// langsung membukanya di Excel.
  baris: number
  nomorLangganan: string
  status: StatusBaris
  pesan?: string
}

export interface HasilBatch {
  diproses: number
  tersimpan: number
  /// Selalu 0 untuk impor pencatatan — di sana tidak ada baris lama dari
  /// sumber lain yang perlu dilengkapi.
  diperbarui: number
  duplikat: number
  dilewati: number
  gagal: number
  /// Hanya baris bermasalah yang dikembalikan. Mengembalikan 1.000 baris
  /// "TERSIMPAN" tiap batch tidak menolong siapa pun dan membengkakkan
  /// respons sampai puluhan MB pada berkas penuh.
  masalah: HasilBaris[]
}

export const barisPencatatanSchema = z.object({
  baris: z.number().int().min(1),
  nomorLangganan: z.string().trim().min(1).max(20),
  periode: z.number().int().min(190001).max(999912),
  standAwal: z.number().int().min(0),
  standAkhir: z.number().int().min(0),
  /// PEMAKAIAN NEGATIF ITU DATA NYATA — `.min(0)` di sini adalah bug, bukan
  /// penjagaan. Meter yang MUNDUR menghasilkan stand akhir lebih kecil dari
  /// stand awal (mis. 2.382 -> 2.362), dan Aurora memang menuliskan
  /// pemakaiannya -20. Berkas 202608 punya satu baris seperti itu, dan
  /// karena Zod memeriksa seluruh array sekaligus, satu baris itu MENOLAK
  /// 250 baris sebelah-menyebelahnya — mengulang tidak menolong sama sekali
  /// karena berkasnya memang tidak berubah.
  ///
  /// Mengubahnya jadi 0 juga bukan jalan keluar: angka minus inilah gejala
  /// meter bermasalah yang harus DILIHAT verifikator (baris tadi bahkan
  /// tercatat kondisi "Normal" dengan persentase -300). LaporanHarianPetugas
  /// adalah catatan PRA-VERIFIKASI, bukan angka tagih — dan jalur tagihnya
  /// sudah tahan minus: `usulkanPemakaianTagih` menagih minimum 5 m3 untuk
  /// pemakaian di bawah 5, `hitungRincianHargaAir` mengembalikan 0 untuk <= 0.
  /// Stand sendiri TETAP `.min(0)` — stand negatif memang mustahil.
  pemakaian: z.number().int().nullable().optional(),
  pemakaianLalu: z.number().int().nullable().optional(),
  persentase: z.number().int().nullable().optional(),
  kondisi: z.string().trim().max(40).nullable().optional(),
  namaPetugas: z.string().trim().max(120).nullable().optional(),
  tanggalCatat: z.string().trim().max(40).nullable().optional(),
})

/// BARISNYA SENGAJA `unknown` DI SINI, DIPERIKSA SATU-SATU DI DALAM SERVICE.
///
/// `z.array(barisPencatatanSchema)` terlihat lebih rapi tapi diam-diam
/// membatalkan sikap #2 di kepala modul ini ("satu baris rusak tidak
/// menjatuhkan batch"): Zod memvalidasi array sebagai satu kesatuan, jadi
/// SATU baris cacat membuat 250 baris lain ditolak sebelum handler-nya
/// sempat jalan. Yang diterima operator cuma 422 "Input tidak valid" —
/// tanpa nomor baris, tanpa nama kolom, dan tanpa satu pun baris masuk.
///
/// Yang tersisa di sini hanyalah pagar amplop: bentuk luarnya benar dan
/// jumlah barisnya wajar. Isi tiap baris diadili sendiri-sendiri, dan yang
/// gagal dilaporkan sebagai baris GAGAL berikut nomor barisnya di berkas —
/// sama seperti kegagalan penulisan ke database.
export const batchPencatatanSchema = z.object({
  periode: z.number().int().min(190001).max(999912),
  baris: z.array(z.unknown()).min(1).max(MAKS_BARIS_PER_BATCH),
})

export const barisPemutusanSchema = z.object({
  baris: z.number().int().min(1),
  nomorLangganan: z.string().trim().min(1).max(20),
  periode: z.number().int().min(190001).max(999912),
  jenis: z.string().trim().min(1).max(20),
  noSurat: z.string().trim().max(100).nullable().optional(),
  tanggalTutup: z.string().trim().max(40).nullable().optional(),
  tanggalCabut: z.string().trim().max(40).nullable().optional(),
})

/// Barisnya `unknown` dengan alasan yang sama persis seperti batch
/// pencatatan di atas — lihat catatan panjang di sana.
export const batchPemutusanSchema = z.object({
  baris: z.array(z.unknown()).min(1).max(MAKS_BARIS_PER_BATCH),
})

export type BarisPencatatanInput = z.infer<typeof barisPencatatanSchema>
export type BatchPencatatanInput = z.infer<typeof batchPencatatanSchema>
export type BarisPemutusanInput = z.infer<typeof barisPemutusanSchema>
export type BatchPemutusanInput = z.infer<typeof batchPemutusanSchema>
