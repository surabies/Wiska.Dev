// server/modules/tagihan/Tagihan.schema.ts — skema validasi input untuk
// endpoint tagihan air periodik & laporan DRD.
import { z } from "zod"
import { StatusTagihan } from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listTagihanQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "periode",
    "pemakaianM3",
    "totalTagihan",
    "denda",
    "status",
    "tanggalJatuhTempo",
    "tanggalBayar",
  ]),
  pelangganId: z.string().optional(),
  status: z.enum(StatusTagihan).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

export type ListTagihanQuery = z.infer<typeof listTagihanQuerySchema>

export const drdQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "periode",
    "pemakaianM3",
    "jmlHargaAir",
    "totalTagihan",
    "denda",
    "status",
    "tanggalJatuhTempo",
    "tanggalBayar",
  ]),
  q: z.string().trim().min(1).optional(),
  status: z.enum(StatusTagihan).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

export type DrdQuery = z.infer<typeof drdQuerySchema>

/// Rekap DRD: agregat per status + total keseluruhan + daftar periode yang
/// punya data (untuk dropdown). Agregasi di DB — tabel tagihan >22 ribu
/// baris per periode.
export const drdRekapQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

export type DrdRekapQuery = z.infer<typeof drdRekapQuerySchema>

export const generateTagihanSchema = z.object({
  pembacaanId: z.string().min(1),
  beaBeban: z.coerce.number().int().min(0).optional(),
  beaAdmin: z.coerce.number().int().min(0).optional(),
  airKotor: z.coerce.number().int().min(0).optional(),
  lainLain: z.coerce.number().int().min(0).optional(),
  denda: z.coerce.number().int().min(0).optional(),
  tanggalJatuhTempo: z.coerce.date(),
})

export type GenerateTagihanSchemaInput = z.infer<typeof generateTagihanSchema>

/// Simulasi tagihan tanpa menyimpan — untuk preview di UI sebelum closing.
export const simulasiTagihanSchema = z.object({
  tarifGolonganId: z.string().min(1),
  pemakaianM3: z.coerce.number().int().min(0),
  periode: z.coerce.number().int().min(190001).max(999912),
})

export type SimulasiTagihanInput = z.infer<typeof simulasiTagihanSchema>

/// Perubahan status manual. SUDAH_BAYAR sengaja TIDAK diizinkan di sini —
/// pelunasan hanya boleh lewat konfirmasi RiwayatPembayaran (modul
/// pembayaran) supaya setiap rupiah yang tercatat lunas selalu punya baris
/// ledger pendampingnya, tidak bisa "dilunaskan" tanpa jejak transaksi.
export const patchTagihanStatusSchema = z.object({
  status: z.enum(["DIHAPUSKAN", "JATUH_TEMPO", "BELUM_BAYAR"]),
  catatanValidasi: z.string().trim().min(1).max(500),
})

export type PatchTagihanStatusInput = z.infer<typeof patchTagihanStatusSchema>
