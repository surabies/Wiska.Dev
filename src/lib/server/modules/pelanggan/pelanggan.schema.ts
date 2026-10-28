import { z } from "zod"
import {
  GolonganTarif,
  StatusPelanggan,
  StatusPasokanAir,
  ObjekBayar,
} from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/pagination"

const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format waktu harus HH:mm")
  .nullable()
  .optional()

const koordinatSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .nullable()
  .optional()

const idRefSchema = z.string().min(1).nullable().optional()
const operatorFilterSchema = z
  .enum(["equals", "contains", "startsWith"])
  .optional()

export const createPelangganSchema = z.object({
  // 11 digit zero-padded, kunci bisnis permanen — TIDAK ada di updateSchema.
  nomorLangganan: z
    .string()
    .regex(/^\d{11}$/, "nomorLangganan harus persis 11 digit"),
  nomorPersil: z.string().trim().min(1).max(50),
  nama: z.string().trim().min(1).max(200),
  alamat: z.string().trim().min(1),
  rt: z.string().trim().max(3).nullable().optional(),
  rw: z.string().trim().max(3).nullable().optional(),
  notelp: z.string().trim().max(30).nullable().optional(),
  jumlahPenghuni: z.coerce.number().int().min(0).nullable().optional(),
  geoLat: z.coerce.number().nullable().optional(),
  geoLong: z.coerce.number().nullable().optional(),
  koordinat: koordinatSchema,
  statusPasokanAir: z.enum(StatusPasokanAir).nullable().optional(),
  jamGilirMulai: timeOfDaySchema,
  jamGilirSelesai: timeOfDaySchema,
  polaGilir: z.string().trim().max(100).nullable().optional(),
  status: z.enum(StatusPelanggan).optional(),
  isMBR: z.boolean().optional(),
  kodeMBR: z.string().trim().max(50).nullable().optional(),
  objekBayar: z.enum(ObjekBayar).nullable().optional(),
  golonganBesarId: idRefSchema,
  dmaId: idRefSchema,
  tarifGolonganId: idRefSchema,
  seksiCaterId: idRefSchema,
  ruteId: idRefSchema,
  // Urutan kunjungan dalam rute (RBM). Admin menerapkan usulan petugas
  // (LaporanHarianPetugas.usulanNoUrut) lewat sini saat closing.
  noUrutRute: z.coerce.number().int().min(1).nullable().optional(),
  zonaId: idRefSchema,
  kecamatanId: idRefSchema,
  kelurahanId: idRefSchema,
})

export const updatePelangganSchema = createPelangganSchema
  .omit({ nomorLangganan: true })
  .partial()

export const listPelangganQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["nomorLangganan", "nama", "alamat", "status", "createdAt"]),
  q: z.string().trim().min(1).optional(),
  nomorLangganan: z.string().trim().min(1).max(11).optional(),
  nomorLanggananOperator: operatorFilterSchema,
  nama: z.string().trim().min(1).max(200).optional(),
  namaOperator: operatorFilterSchema,
  alamat: z.string().trim().min(1).max(500).optional(),
  alamatOperator: operatorFilterSchema,
  kecamatan: z.string().trim().min(1).max(200).optional(),
  kecamatanOperator: operatorFilterSchema,
  kelurahan: z.string().trim().min(1).max(200).optional(),
  kelurahanOperator: operatorFilterSchema,
  rt: z.string().trim().min(1).max(3).optional(),
  rtOperator: operatorFilterSchema,
  rw: z.string().trim().min(1).max(3).optional(),
  rwOperator: operatorFilterSchema,
  golTarif: z.enum(GolonganTarif).optional(),
  status: z.enum(StatusPelanggan).optional(),
  seksiCaterId: z.string().optional(),
  ruteId: z.string().optional(),
  zonaId: z.string().optional(),
  kecamatanId: z.string().optional(),
  kelurahanId: z.string().optional(),
  tarifGolonganId: z.string().optional(),
  includeDeleted: z.coerce.boolean().optional(),
})

export const nearPelangganQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50000).default(500),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export type CreatePelangganInput = z.infer<typeof createPelangganSchema>
export type UpdatePelangganInput = z.infer<typeof updatePelangganSchema>
export type ListPelangganQuery = z.infer<typeof listPelangganQuerySchema>
