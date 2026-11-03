// server/modules/tarif/Tarif.schema.ts — skema validasi input untuk
// TarifGolongan dan TarifBlok (tarif progresif per blok konsumsi).
import { z } from "zod"
import { GolonganTarif } from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listTarifQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["kode", "kodeAsli", "nama", "kategori", "isActive"]),
  q: z.string().trim().min(1).optional(),
  // hanyaAktif=true: hanya blok tarif yang BERLAKU saat ini (berlakuMulai
  // <= now && (berlakuSampai null || > now)). Dipakai aplikasi mobile untuk
  // estimasi progresif — tanpa ini, golongan yang pernah ganti tarif membawa
  // blok generasi lama (nomor blok ganda) dan estimasi salah hitung. Dashboard
  // web tetap default menerima seluruh histori (audit/penagihan ulang).
  hanyaAktif: z.coerce.boolean().optional(),
})

export type ListTarifQuery = z.infer<typeof listTarifQuerySchema>

export const createTarifGolonganSchema = z.object({
  kode: z.enum(GolonganTarif),
  kodeAsli: z.string().trim().min(1).max(30),
  nama: z.string().trim().min(1).max(150),
  kategori: z.string().trim().min(1).max(100),
  isActive: z.boolean().optional(),
})

export type CreateTarifGolonganInput = z.infer<typeof createTarifGolonganSchema>

// kode/kodeAsli sengaja tidak bisa diubah lewat PATCH — keduanya kunci
// identitas golongan tarif yang dirujuk banyak Pelanggan/Tagihan.
export const updateTarifGolonganSchema = z.object({
  nama: z.string().trim().min(1).max(150).optional(),
  kategori: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
})

export type UpdateTarifGolonganInput = z.infer<typeof updateTarifGolonganSchema>

export const createTarifBlokSchema = z
  .object({
    blok: z.coerce.number().int().min(1),
    batasAwalM3: z.coerce.number().int().min(0),
    batasAkhirM3: z.coerce.number().int().min(0).nullable().optional(),
    hargaPerM3: z.coerce.number().int().min(0),
    berlakuMulai: z.coerce.date(),
  })
  .refine(
    (data) =>
      data.batasAkhirM3 == null || data.batasAkhirM3 >= data.batasAwalM3,
    {
      message: "batasAkhirM3 harus >= batasAwalM3",
      path: ["batasAkhirM3"],
    }
  )

export type CreateTarifBlokInput = z.infer<typeof createTarifBlokSchema>

// Blok lama TIDAK PERNAH diedit field lain (histori tarif harus terjaga
// untuk audit & penagihan ulang, lihat komentar model TarifBlok) — satu-
// satunya perubahan yang diizinkan adalah menutup masa berlakunya.
export const closeTarifBlokSchema = z.object({
  berlakuSampai: z.coerce.date(),
})

export type CloseTarifBlokInput = z.infer<typeof closeTarifBlokSchema>
