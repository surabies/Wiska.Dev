// server/modules/anomali/Anomali.schema.ts — skema validasi Zod & tipe kontrak
// untuk modul sambungan tidak terukur (anomali).

import { z } from "zod"
import { KONDISI_TIDAK_TERUKUR, SEMUA_KATEGORI } from "@/lib/domain/Anomali"

export const daftarQuerySchema = z.object({
  ambangBulan: z.coerce.number().int().min(1).max(24).optional(),
  kategori: z.enum(SEMUA_KATEGORI as [string, ...string[]]).optional(),
  /// Satu kondisi catat saja (mis. "DK") — lebih sempit dari kategori, yang
  /// mengelompokkan beberapa kondisi bertindakan sama.
  kondisi: z.enum(KONDISI_TIDAK_TERUKUR as [string, ...string[]]).optional(),
  hanyaPrioritas: z.coerce.boolean().optional(),
  sembunyikanSudahDikunjungi: z.coerce.boolean().optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

export const kunjunganSchema = z.object({
  pelangganId: z.string().min(1),
  periode: z.coerce.number().int().min(190001).max(999912),
  kategori: z.enum(SEMUA_KATEGORI as [string, ...string[]]),
  bulanBerturut: z.coerce.number().int().min(1),
  m3TanpaDasar: z.coerce.number().int().min(0),
  hasil: z.enum([
    "BERTEMU_TERBACA",
    "BERTEMU_TIDAK_TERBACA",
    "TETAP_TERKUNCI",
    "KOSONG_TERKONFIRMASI",
    "METER_DIPINDAH",
    "PERLU_GANTI_METER",
    "USUL_TUTUP_SEMENTARA",
    "ALAMAT_TIDAK_DITEMUKAN",
  ]),
  standDitemukan: z.coerce.number().int().min(0).max(9_999_999).optional(),
  /// Tiga foto bukti, sama seperti pencatatan rutin. `fotoUrl` = foto STAND.
  /// Diunggah lebih dulu lewat POST /laporan-harian/foto, yang mengembalikan
  /// URL-nya; di sini yang datang hanya URL, bukan berkasnya.
  fotoUrl: z.string().optional(),
  fotoPublicId: z.string().optional(),
  fotoSegelUrl: z.string().optional(),
  fotoRumahUrl: z.string().optional(),
  /// z.boolean(), BUKAN z.coerce.boolean(): coerce mengubah string "false"
  /// menjadi true. Badannya JSON, jadi boolean-nya sudah boolean.
  isSegel: z.boolean().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  catatan: z.string().trim().max(1000).optional(),
})

export type DaftarAnomaliQuery = z.infer<typeof daftarQuerySchema>
export type KunjunganAnomaliInput = z.infer<typeof kunjunganSchema>
