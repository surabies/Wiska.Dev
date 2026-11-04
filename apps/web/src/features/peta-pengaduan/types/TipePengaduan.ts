export type StatusPengaduan = "baru" | "terverifikasi" | "diproses" | "selesai"

/**
 * 12 Kategori Pengaduan resmi sesuai enum `JenisPengaduan` di basis data PostgreSQL/Prisma.
 * Dilengkapi alias backward-compatible untuk data lokal terdahulu.
 */
export type KategoriPengaduan =
  | "BOCOR_PIPA_DINAS"
  | "AIR_KERUH_BAU_BERWARNA"
  | "TIDAK_ADA_AIR"
  | "LONJAKAN_PEMAKAIAN_AIR"
  | "GANTI_STOP_KRAN"
  | "LAPOR_STAND_METER"
  | "PENCATATAN_METER_TIDAK_SESUAI"
  | "PINDAH_JARINGAN"
  | "PASANGAN_LIAR"
  | "MUTASI_GOLONGAN_TARIF"
  | "TIDAK_MAMPU_BAYAR"
  | "LAINNYA"
  // Alias lama untuk kompatibilitas
  | "pipa-bocor"
  | "air-keruh"
  | "air-mati"
  | "tekanan-rendah"
  | "meter-rusak"
  | "lainnya"

export interface RiwayatStatus {
  id?: string
  status: StatusPengaduan
  statusDari?: string | null
  aksi?: string
  waktu: string // ISO 8601
  catatan?: string
  olehNama?: string
}

export interface Pengaduan {
  id: string
  nomor: string // format resmi tiket: TW-YYMM-XXXXXX
  kategori: KategoriPengaduan
  judul?: string
  deskripsi: string
  alamat: string
  lng: number
  lat: number
  foto: string[] // URL
  status: StatusPengaduan
  prioritas?: "RENDAH" | "NORMAL" | "TINGGI" | "DARURAT"
  pelapor?: string
  kontakPelapor?: string
  petugasNama?: string | null
  targetSelesaiAt?: string | null
  riwayat: RiwayatStatus[]
  diikuti: boolean
  dibuatPada: string // ISO 8601
}

/** Titik yang diklik di peta (sebelum menjadi pengaduan). */
export interface TitikDraft {
  lng: number
  lat: number
  alamat?: string
  memuat?: boolean
}

export interface BuatPengaduanInput {
  pelapor?: string
  kategori: KategoriPengaduan
  deskripsi: string
  alamat: string
  lng: number
  lat: number
  foto: File[]
  kontak?: string
}
