// features/dashboard/components/pengaduan/tipe.ts — bentuk data /api/v1/pengaduan
// yang dipakai papan penanganan (subset kolom yang benar-benar dibaca UI,
// bukan salinan penuh model Prisma — backend boleh mengirim lebih).

import type { StatusPengaduan } from "@/features/public/lib/format"

/// SATU definisi union status, dipakai bersama halaman publik — didefinisikan
/// di features/public/lib/format.ts karena di sanalah kedua peta labelnya
/// (warga & staf) dikunci lengkap. Di-reekspor di sini supaya modul pengaduan
/// dashboard tetap punya satu pintu impor tipe.
export type { StatusPengaduan }

export type PrioritasPengaduan = "RENDAH" | "NORMAL" | "TINGGI" | "DARURAT"

/// Cerminan `ringkasSla()` di server/modules/pengaduan/sla.ts. Dihitung
/// server, TIDAK dihitung ulang di sini: aturan "terlambat" adalah kebijakan
/// layanan, dan menyalinnya ke browser berarti dua sumber kebenaran yang
/// pasti menyimpang.
export interface SlaTiket {
  targetResponsAt: string | null
  targetSelesaiAt: string | null
  sisaMenit: number | null
  melanggar: boolean
  responsTerlambat: boolean
  terjeda: boolean
}

export interface EntriRiwayat {
  id: string
  aksi: string
  statusDari: StatusPengaduan | null
  statusKe: StatusPengaduan | null
  catatan: string | null
  fotoUrl: string | null
  /** false = catatan internal; tidak pernah dikirim ke halaman publik. */
  isPublik: boolean
  olehNama: string
  createdAt: string
  oleh: { id: string; name: string | null; role: string } | null
}

export interface PengaduanBaris {
  id: string
  nomorTiket: string
  judul: string
  jenis: string
  status: StatusPengaduan
  prioritas: PrioritasPengaduan
  pelapor: string
  createdAt: string
  sla?: SlaTiket
  ditugaskanKe?: { id: string; name: string | null } | null
}

export interface PengaduanDetail extends PengaduanBaris {
  deskripsi: string
  alamatKejadian: string | null
  nomorLangganan: string | null
  kontakPelapor: string | null
  fotoUrl: string | null
  /** Klip video bukti dari pelapor (opsional). */
  videoUrl: string | null
  ditanganiMulai: string | null
  selesaiAt: string | null
  catatanPenyelesaian: string | null
  eskalasiAt: string | null
  alasanEskalasi: string | null
  ratingKepuasan: number | null
  komentarKepuasan: string | null
  jumlahDibukaKembali: number
  jedaTotalMenit: number
  /** Foto bukti hasil pekerjaan — diisi saat transisi SELESAI (wajib). */
  fotoPenyelesaianUrl: string | null
  /** Batas konfirmasi pelapor; lewat ini tiket ditutup otomatis. */
  konfirmasiBatasAt: string | null
  verifikasiAt: string | null
  sla: SlaTiket
  eskalasiKe: { id: string; name: string | null; role: string } | null
  pelanggan: { id: string; nomorLangganan: string; nama: string } | null
  /** Wilayah kejadian hasil auto-tag ST_Contains dari koordinat. */
  kelurahan: { id: string; nama: string } | null
  kecamatan: { id: string; nama: string } | null
  riwayat: EntriRiwayat[]
  /** Transisi status yang sah dari status saat ini — diputuskan server
   *  (matriks TRANSISI di alur.ts), supaya UI tidak menawarkan tombol yang
   *  pasti ditolak. */
  transisiTersedia: StatusPengaduan[]
}

export interface StatistikPengaduan {
  perStatus: Partial<Record<StatusPengaduan, number>>
  perPrioritasTerbuka: Partial<Record<PrioritasPengaduan, number>>
  melanggarSla: number
  belumDitugaskan: number
  rataRating: number | null
  jumlahDinilai: number
}

export interface PetugasRingkas {
  id: string
  name: string | null
  role: string
}
