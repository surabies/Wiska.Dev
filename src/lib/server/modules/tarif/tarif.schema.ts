import { z } from "zod"
import { GolonganTarif } from "@db"

export const createTarifGolonganSchema = z.object({
  kode: z.enum(GolonganTarif),
  kodeAsli: z.string().trim().min(1).max(30),
  nama: z.string().trim().min(1).max(150),
  kategori: z.string().trim().min(1).max(100),
  isActive: z.boolean().optional(),
})

// kode/kodeAsli sengaja tidak bisa diubah lewat PATCH — keduanya kunci
// identitas golongan tarif yang dirujuk banyak Pelanggan/Tagihan.
export const updateTarifGolonganSchema = z.object({
  nama: z.string().trim().min(1).max(150).optional(),
  kategori: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
})

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
    },
  )

// Blok lama TIDAK PERNAH diedit field lain (histori tarif harus terjaga
// untuk audit & penagihan ulang, lihat komentar model TarifBlok) — satu-
// satunya perubahan yang diizinkan adalah menutup masa berlakunya.
export const closeTarifBlokSchema = z.object({
  berlakuSampai: z.coerce.date(),
})
