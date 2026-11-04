// server/modules/pengaduan/Pengaduan.schema.ts — skema validasi Zod & tipe
// kontrak untuk sisi petugas alur pengaduan.
import { z } from "zod"
import {
  JenisPengaduan,
  KlasifikasiPengaduan,
  PrioritasPengaduan,
  StatusPengaduan,
} from "@db"
import { paginationQuerySchema, sortQuery } from "../../lib/Pagination"

export const listPengaduanQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "createdAt",
    "status",
    "prioritas",
    "jenis",
    "judul",
    "pelapor",
    "nomorTiket",
    "targetSelesaiAt",
  ]),
  q: z.string().trim().min(1).optional(),
  jenis: z.enum(JenisPengaduan).optional(),
  status: z.enum(StatusPengaduan).optional(),
  prioritas: z.enum(PrioritasPengaduan).optional(),
  pelangganId: z.string().optional(),
  ditugaskanKeId: z.string().optional(),
  /// Saring antrean per wilayah kejadian (hasil auto-tag ST_Contains saat
  /// tiket dibuat — lihat Wilayah.ts).
  kelurahanId: z.string().optional(),
  kecamatanId: z.string().optional(),
  /// "tiket terbuka yang tenggatnya sudah lewat" — antrean yang paling perlu
  /// dilihat supervisor tiap pagi.
  melanggarSla: z.coerce.boolean().optional(),
  /// Tiket yang ditugaskan ke SAYA. Dipakai petugas lapangan; lebih jujur
  /// daripada menyuruh mereka menyalin id sendiri ke ditugaskanKeId.
  milikSaya: z.coerce.boolean().optional(),
})

// Titik kebocoran terdekat — untuk dispatch petugas dari peta dashboard.
export const nearPengaduanQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50000).default(1000),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const sayaPengaduanQuerySchema = paginationQuerySchema

export const createPengaduanSchema = z
  .object({
    pelangganId: z.string().min(1).nullable().optional(),
    nomorLangganan: z.string().trim().max(20).nullable().optional(),
    /// Opsional demi kompatibilitas dengan klien lama yang belum mengenal
    /// sumbu ini — bila kosong, kolomnya memakai default DB.
    klasifikasi: z.enum(KlasifikasiPengaduan).optional(),
    jenis: z.enum(JenisPengaduan),
    judul: z.string().trim().min(1).max(200),
    deskripsi: z.string().trim().min(1),
    koordinat: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .nullable()
      .optional(),
    alamatKejadian: z.string().trim().max(500).nullable().optional(),
    prioritas: z.enum(PrioritasPengaduan).optional(),
    pelapor: z.string().trim().min(1).max(150),
    kontakPelapor: z.string().trim().max(50).nullable().optional(),
    fotoUrl: z.url().nullable().optional(),
  })
  // Aturan bisnis dari schema: BOCOR_PIPA_DINAS wajib punya titik lokasi
  // supaya bisa di-dispatch ke petugas/rute terdekat lewat query jarak PostGIS.
  .refine((d) => d.jenis !== "BOCOR_PIPA_DINAS" || !!d.koordinat, {
    message:
      "Pengaduan jenis Bocor Pipa Dinas wajib menyertakan koordinat lokasi kejadian",
    path: ["koordinat"],
  })

export const tugaskanPengaduanSchema = z.object({
  ditugaskanKeId: z.string().min(1),
  catatan: z.string().trim().max(1000).optional(),
})

/// URL foto boleh absolut (Cloudinary) atau path relatif server (fallback
/// storage dev) — pola sama seperti laporan-harian.
export const urlFotoSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/"), {
    message: "URL foto harus absolut (http/https) atau path relatif server",
  })

export const ubahStatusPengaduanSchema = z.object({
  status: z.enum(StatusPengaduan),
  catatan: z.string().trim().max(1000).optional(),
  catatanPenyelesaian: z.string().trim().max(1000).nullable().optional(),
  /// Foto bukti hasil pekerjaan — WAJIB saat status = SELESAI (dicek di
  /// service, bukan schema, supaya pesannya menyebut aturan bisnisnya).
  fotoPenyelesaianUrl: urlFotoSchema.nullable().optional(),
  fotoPenyelesaianPublicId: z.string().trim().max(300).nullable().optional(),
  /// Default true: perubahan STATUS adalah kabar yang memang ditunggu
  /// pelapor. Catatan internal punya endpoint sendiri (/catatan).
  isPublik: z.boolean().default(true),
})

export const tambahCatatanPengaduanSchema = z.object({
  catatan: z.string().trim().min(1).max(2000),
  /// Default FALSE — kebalikan dari /status. Catatan bebas paling sering
  /// dipakai koordinasi antar petugas; yang boleh dibaca warga harus
  /// dinyatakan sadar, bukan kebobolan karena lupa.
  isPublik: z.boolean().default(false),
  fotoUrl: z.url().nullable().optional(),
})

export const kirimChatPengaduanSchema = z.object({
  pesan: z.string().trim().min(1, "Pesan tidak boleh kosong").max(2000),
  fotoUrl: urlFotoSchema.nullable().optional(),
})

export const unggahFotoPengaduanSchema = z.object({
  nomorTiket: z.string().trim().min(5).max(40),
})

export const eskalasiPengaduanSchema = z.object({
  eskalasiKeId: z.string().min(1),
  alasan: z.string().trim().min(1).max(1000),
  prioritasBaru: z.enum(PrioritasPengaduan).optional(),
})

export type ListPengaduanQuery = z.infer<typeof listPengaduanQuerySchema>
export type NearPengaduanQuery = z.infer<typeof nearPengaduanQuerySchema>
export type SayaPengaduanQuery = z.infer<typeof sayaPengaduanQuerySchema>
export type CreatePengaduanInput = z.infer<typeof createPengaduanSchema>
export type TugaskanPengaduanInput = z.infer<typeof tugaskanPengaduanSchema>
export type UbahStatusPengaduanInput = z.infer<typeof ubahStatusPengaduanSchema>
export type TambahCatatanPengaduanInput = z.infer<
  typeof tambahCatatanPengaduanSchema
>
export type KirimChatPengaduanInput = z.infer<typeof kirimChatPengaduanSchema>
export type UnggahFotoPengaduanInput = z.infer<typeof unggahFotoPengaduanSchema>
export type EskalasiPengaduanInput = z.infer<typeof eskalasiPengaduanSchema>
