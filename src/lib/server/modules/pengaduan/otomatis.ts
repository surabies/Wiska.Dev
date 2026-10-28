// server/modules/pengaduan/otomatis.ts — penutupan tiket OTOMATIS saat
// pelapor tidak kunjung mengonfirmasi tiket SELESAI.
//
// Tanpa infrastruktur cron: dieksekusi MALAS (lazy) — setiap kali tiket
// dibaca/disentuh lewat endpoint publik, tiket SELESAI yang batas
// konfirmasinya lewat langsung ditutup lebih dulu — plus endpoint sweep
// (POST /api/v1/pengaduan/tutup-otomatis) yang bisa dipanggil penjadwal
// eksternal (cron OS / GitHub Actions / Vercel Cron) untuk menyapu tiket
// yang tidak pernah dibuka siapa pun. Dua jalur itu memakai fungsi yang
// SAMA di sini supaya aturannya tidak bercabang.
import { prisma } from "@db"
import { transisiPengaduan, SISTEM } from "./alur"

/// Kunci Konfigurasi untuk lama tunggu konfirmasi pelapor (jam).
export const KUNCI_BATAS_KONFIRMASI = "pengaduan.batasKonfirmasiJam"

/// Default 72 jam (3x24) — bisa diubah lewat menu Konfigurasi dashboard
/// tanpa deploy ulang.
const DEFAULT_BATAS_JAM = 72

export async function ambilBatasKonfirmasiJam(): Promise<number> {
  const row = await prisma.konfigurasi.findUnique({
    where: { kunci: KUNCI_BATAS_KONFIRMASI },
    select: { nilai: true },
  })
  const jam = row ? Number.parseInt(row.nilai, 10) : NaN
  // Nilai konfigurasi rusak/nol/negatif jatuh ke default, bukan mematikan
  // auto-close diam-diam.
  return Number.isFinite(jam) && jam > 0 ? jam : DEFAULT_BATAS_JAM
}

export function hitungKonfirmasiBatasAt(
  sekarang: Date,
  batasJam: number,
): Date {
  return new Date(sekarang.getTime() + batasJam * 60 * 60 * 1000)
}

/// Tutup satu tiket SELESAI yang kedaluwarsa. Idempoten terhadap balapan:
/// transisiPengaduan menolak bila status sudah bukan SELESAI.
async function tutupSatu(id: string, batasAt: Date) {
  await prisma.$transaction((tx) =>
    transisiPengaduan(tx, {
      pengaduanId: id,
      ke: "DITUTUP",
      aksi: "DITUTUP_OTOMATIS",
      oleh: SISTEM,
      catatan:
        `Tiket ditutup otomatis: pelapor tidak memberi konfirmasi sampai batas waktu ` +
        `${batasAt.toISOString()}. Bila masalah masih ada, silakan buat pengaduan baru.`,
      isPublik: true,
    }),
  )
}

/// Jalur MALAS: dipanggil endpoint publik sebelum menyajikan/menyentuh satu
/// tiket. Mengembalikan true bila tiket barusan ditutup (pemanggil harus
/// membaca ulang barisnya).
export async function tutupOtomatisBilaKedaluwarsa(tiket: {
  id: string
  status: string
  konfirmasiBatasAt: Date | null
}): Promise<boolean> {
  if (tiket.status !== "SELESAI" || !tiket.konfirmasiBatasAt) return false
  if (tiket.konfirmasiBatasAt.getTime() > Date.now()) return false
  await tutupSatu(tiket.id, tiket.konfirmasiBatasAt)
  return true
}

/// Jalur SWEEP: tutup semua tiket kedaluwarsa sekaligus. Loop per tiket
/// (bukan updateMany) karena setiap penutupan wajib lewat transisiPengaduan
/// agar linimasa tercatat — updateMany massal justru pelanggaran aturan
/// alur.ts. Volumenya kecil (hanya SELESAI kedaluwarsa), bukan hot path.
export async function sapuTutupOtomatis(): Promise<number> {
  const kedaluwarsa = await prisma.pengaduan.findMany({
    where: { status: "SELESAI", konfirmasiBatasAt: { lt: new Date() } },
    select: { id: true, konfirmasiBatasAt: true },
    take: 500,
  })
  let jumlah = 0
  for (const t of kedaluwarsa) {
    try {
      await tutupSatu(t.id, t.konfirmasiBatasAt!)
      jumlah++
    } catch {
      // Balapan dengan konfirmasi pelapor yang datang bersamaan — biarkan;
      // tiket itu sudah berpindah status lewat jalur sah lain.
    }
  }
  return jumlah
}
