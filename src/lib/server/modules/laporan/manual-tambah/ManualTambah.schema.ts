import { z } from "zod"

export const PERIODE_SCHEMA = z.coerce
  .number()
  .int()
  .min(190001)
  .max(999912)
  .refine((value) => value % 100 >= 1 && value % 100 <= 12, {
    message: "Periode harus menggunakan format tahun-bulan yang valid.",
  })

export const queryPelangganSchema = z.object({
  nomor: z
    .string()
    .trim()
    .regex(/^\d{11}$/, {
      message: "Nomor pelanggan harus terdiri dari 11 digit.",
    }),
  periode: PERIODE_SCHEMA,
})

export const queryOpsiSchema = z.object({
  periode: PERIODE_SCHEMA.optional(),
  pencatatId: z.string().trim().min(1).optional(),
  ruteId: z.string().trim().min(1).optional(),
})

export const filterSchema = z.object({
  periode: PERIODE_SCHEMA,
  ruteId: z.string().trim().min(1),
  pencatatId: z.string().trim().min(1),
})

const alasanSchema = z.string().trim().min(5).max(500)
const tanggalCatatSchema = z.iso.date()
const tanggalSesuaiPeriode = (tanggal: string | undefined, periode: number) =>
  tanggal === undefined ||
  Number(tanggal.slice(0, 4)) * 100 + Number(tanggal.slice(5, 7)) === periode

export const inputSatuanSchema = z
  .object({
    pelangganId: z.string().trim().min(1),
    periode: PERIODE_SCHEMA,
    tanggalCatat: tanggalCatatSchema.optional(),
    standAwal: z.coerce.number().int().min(0).max(2_147_483_647),
    standAkhir: z.coerce.number().int().min(0).max(2_147_483_647),
    pemakaian: z.coerce
      .number()
      .int()
      .min(-2_147_483_648)
      .max(2_147_483_647)
      .optional(),
    alasanManual: alasanSchema,
  })
  .refine(
    ({ tanggalCatat, periode }) => tanggalSesuaiPeriode(tanggalCatat, periode),
    {
      path: ["tanggalCatat"],
      message: "Tanggal pencatatan harus berada dalam periode laporan.",
    }
  )

export const inputMassalSchema = filterSchema
  .extend({
    tanggalCatat: tanggalCatatSchema.optional(),
    daftarCatatIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Pilihan pelanggan tidak boleh duplikat.",
      }),
    alasanManual: alasanSchema,
  })
  .refine(
    ({ tanggalCatat, periode }) => tanggalSesuaiPeriode(tanggalCatat, periode),
    {
      path: ["tanggalCatat"],
      message: "Tanggal pencatatan harus berada dalam periode laporan.",
    }
  )

export type QueryPelangganManualInput = z.infer<typeof queryPelangganSchema>
export type QueryOpsiManualInput = z.infer<typeof queryOpsiSchema>
export type FilterManualTambahInput = z.infer<typeof filterSchema>
export type InputSatuanManualInput = z.infer<typeof inputSatuanSchema>
export type InputMassalManualInput = z.infer<typeof inputMassalSchema>
