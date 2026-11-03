// server/modules/publik/Publik.schema.ts — skema validasi Zod & tipe kontrak
// untuk endpoint warga/pelanggan tanpa login (cek tagihan, pengaduan publik,
// pelacakan tiket, dan lapor meter mandiri).
import { z } from "zod"
import { JenisPengaduan, KlasifikasiPengaduan } from "@db"

export const nomorLangganganSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/, "Nomor langganan harus 11 digit angka")

export const cekTagihanSchema = z.object({
  nomorLangganan: nomorLangganganSchema,
})

export const pengaduanSchema = z
  .object({
    /// Opsional demi kompatibilitas: klien lama (Flutter, aplikasi terpasang
    /// yang belum diperbarui) tidak mengirim field ini. Bila kosong, kolomnya
    /// memakai default DB — bukan ditolak, karena menolaknya akan mematikan
    /// kanal pengaduan bagi warga yang belum sempat memperbarui aplikasi.
    klasifikasi: z.enum(KlasifikasiPengaduan).optional(),
    jenis: z.enum(JenisPengaduan),
    judul: z.string().trim().min(5, "Judul minimal 5 karakter").max(200),
    deskripsi: z
      .string()
      .trim()
      .min(10, "Ceritakan lebih detail (minimal 10 karakter)")
      .max(2000),
    pelapor: z.string().trim().min(2, "Nama pelapor wajib diisi").max(150),
    kontakPelapor: z
      .string()
      .trim()
      .min(5, "Nomor HP/kontak wajib diisi agar petugas bisa menghubungi")
      .max(50),
    alamatKejadian: z.string().trim().max(500).optional(),
    // Opsional: pelapor bisa warga yang BUKAN pelanggan (mis. melihat pipa
    // bocor di jalan). Karena itu tidak diverifikasi — lihat catatan di
    // service.
    nomorLangganan: z
      .string()
      .trim()
      .regex(/^\d{11}$/)
      .optional(),
    koordinat: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .optional(),
    /// Kunci idempotensi (UUID v4 dari client). Longgar sengaja — klien lama
    /// yang tidak mengirimnya tetap diterima; yang mengirimnya dilindungi dari
    /// tiket kembar akibat retry/tap ganda. Lihat catatan di Publik.service.ts.
    clientRequestId: z.string().trim().uuid().optional(),
  })
  .refine((d) => d.jenis !== "BOCOR_PIPA_DINAS" || !!d.koordinat, {
    message:
      "Untuk laporan bocor pipa dinas, lokasi wajib diisi agar petugas bisa menemukannya",
    path: ["koordinat"],
  })

export const konfirmasiSchema = z.object({
  rating: z.number().int().min(1, "Beri nilai 1-5").max(5, "Beri nilai 1-5"),
  komentar: z.string().trim().max(1000).optional(),
})

export const bukaKembaliSchema = z.object({
  alasan: z
    .string()
    .trim()
    .min(10, "Ceritakan apa yang masih bermasalah (minimal 10 karakter)")
    .max(1000),
})

export const chatPelaporSchema = z.object({
  pesan: z.string().trim().min(1, "Pesan tidak boleh kosong").max(2000),
})

export const laporMeterSchema = z.object({
  nomorLangganan: nomorLangganganSchema,
  standDilaporkan: z.coerce
    .number()
    .int()
    .min(0, "Angka meter tidak valid")
    .max(9_999_999),
  nomorPelapor: z.string().trim().min(5, "Nomor HP wajib diisi").max(30),
  namaPelapor: z.string().trim().min(2, "Nama pelapor wajib diisi").max(150),
  periodeUji: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
})

export type CekTagihanInput = z.infer<typeof cekTagihanSchema>
export type PengaduanPublikInput = z.infer<typeof pengaduanSchema>
export type KonfirmasiTiketInput = z.infer<typeof konfirmasiSchema>
export type BukaKembaliTiketInput = z.infer<typeof bukaKembaliSchema>
export type ChatPelaporInput = z.infer<typeof chatPelaporSchema>
export type LaporMeterInput = z.infer<typeof laporMeterSchema>
