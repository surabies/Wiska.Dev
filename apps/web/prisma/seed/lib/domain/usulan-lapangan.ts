// domain/usulan-lapangan.ts — KOSAKATA USULAN PERUBAHAN DATA DARI LAPANGAN.
//
// MASALAH YANG DIJAWAB. `LaporanHarianPetugas.usulanPerubahan` selama ini
// teks bebas. Teks bebas dari 9 petugas yang mengetik di layar 5 inci sambil
// berdiri di depan pagar menghasilkan "cafe", "CAFE", "kafe", "warung kopi",
// "dipake usaha" — dan tidak ada satu pun rekap yang bisa dibuat darinya.
// Aplikasi lama (Aurora) tidak pernah memakai teks bebas untuk ini: isiannya
// DROPDOWN dengan pilihan tetap, dan itulah yang direproduksi di sini.
//
// KENAPA `string` BIASA, BUKAN ENUM PRISMA. Modul ini dipakai server DAN
// React Native; menariknya dari @workspace/db akan menyeret Prisma Client ke
// aplikasi petugas. Alasan yang sama persis dengan domain/anomali.ts.
// Kolomnya di database tetap `String?` — tidak ada migrasi yang dibutuhkan,
// dan baris lama bertekst bebas tetap terbaca apa adanya.
//
// YANG DILAPORKAN ADALAH PEMAKAIAN, BUKAN GOLONGAN TARIF. Petugas melihat
// rumah dipakai jadi kafe; ia TIDAK memutuskan bahwa golongannya jadi 3A.
// Penerjemahan pemakaian ke golongan punya akibat rupiah dan wewenangnya di
// admin — jadi tidak ada pemetaan otomatis di berkas ini, dan sengaja begitu.

/// Urutan sengaja mengikuti dropdown Aurora supaya petugas yang pindah dari
/// aplikasi lama menemukan pilihan di tempat yang sama.
export const JENIS_PEMAKAIAN = [
  "CAFE",
  "RESTORAN",
  "HOTEL",
  "SPA",
  "HIBURAN",
  "TOKO",
  "KOS_KOSAN",
  "WARNET",
  "BENGKEL",
  "KLINIK",
  "LAINNYA",
] as const

export type JenisPemakaian = (typeof JENIS_PEMAKAIAN)[number]

export const LABEL_JENIS_PEMAKAIAN: Record<JenisPemakaian, string> = {
  CAFE: "Cafe",
  RESTORAN: "Restoran",
  HOTEL: "Hotel",
  SPA: "Spa",
  HIBURAN: "Hiburan",
  TOKO: "Toko",
  KOS_KOSAN: "Kos-kosan",
  WARNET: "Warnet",
  BENGKEL: "Bengkel",
  KLINIK: "Klinik",
  LAINNYA: "Lainnya",
}

/// Pemisah antara kode pilihan dan keterangan bebasnya, mis.
/// `LAINNYA: dipakai gudang tekstil`. HANYA "LAINNYA" yang boleh berketerangan
/// — sisanya sudah menjelaskan dirinya sendiri, dan membolehkan tambahan teks
/// di semua pilihan akan mengembalikan persoalan teks bebas lewat pintu
/// belakang.
export const PEMISAH_KETERANGAN = ": "

/// Bentuk simpan: `"CAFE"` atau `"LAINNYA: dipakai gudang tekstil"`.
export function susunUsulan(jenis: JenisPemakaian, keterangan?: string | null): string {
  const teks = (keterangan ?? "").trim()
  if (jenis !== "LAINNYA" || teks === "") return jenis
  return `${jenis}${PEMISAH_KETERANGAN}${teks}`
}

export interface UsulanTerbaca {
  jenis: JenisPemakaian | null
  keterangan: string | null
  /// true = baris warisan bertekst bebas, sebelum dropdown ini ada. Ditandai
  /// supaya layar tinjauan bisa menampilkannya apa adanya alih-alih
  /// memaksakannya masuk salah satu pilihan.
  bebas: boolean
}

export function bacaUsulan(nilai: string | null | undefined): UsulanTerbaca | null {
  const teks = (nilai ?? "").trim()
  if (teks === "") return null

  const pisah = teks.indexOf(PEMISAH_KETERANGAN)
  const kepala = (pisah >= 0 ? teks.slice(0, pisah) : teks).trim().toUpperCase()
  const ekor = pisah >= 0 ? teks.slice(pisah + PEMISAH_KETERANGAN.length).trim() : ""

  if ((JENIS_PEMAKAIAN as readonly string[]).includes(kepala)) {
    return { jenis: kepala as JenisPemakaian, keterangan: ekor === "" ? null : ekor, bebas: false }
  }
  return { jenis: null, keterangan: teks, bebas: true }
}
