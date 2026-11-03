// src/lib/server/modules/laporan/LaporanHarian.schema.ts — skema validasi Zod
// dan tipe input untuk seluruh endpoint modul LaporanHarian.
import { z } from "zod"
import { JenisInputLaporanHarian, KondisiCatat, KategoriPembacaan } from "@db"
import { paginationQuerySchema, sortQuery } from "../../../lib/Pagination"

/// Status verifikasi TURUNAN (tidak ada kolomnya sendiri): MENUNGGU =
/// belum pernah disentuh verifikator (verifiedAt null); DIVERIFIKASI =
/// isVerified true; DITOLAK = isVerified false TAPI verifiedAt terisi
/// (reject mengisi verifiedAt tanpa menaikkan isVerified). Filter
/// isVerified saja tidak bisa membedakan MENUNGGU dari DITOLAK.
export const STATUS_VERIF = [
  "SEMUA_MENUNGGU",
  "MENUNGGU",
  "MENUNGGU_V1",
  "V1",
  "MENUNGGU_V2",
  "V2",
  "MENUNGGU_V3",
  "DIVERIFIKASI",
  "DITOLAK",
] as const
export type StatusVerif = (typeof STATUS_VERIF)[number]

export const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery([
    "tanggalCatat",
    "periode",
    "standAwal",
    "standAkhir",
    "pemakaian",
    "kondisi",
    "nomorLangganan",
    "namaPelanggan",
    "isVerified",
    "persentase",
    "createdAt",
  ]),
  q: z.string().trim().min(1).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  isVerified: z.coerce.boolean().optional(),
  statusVerif: z.enum(STATUS_VERIF).optional(),
  jenisInput: z.enum(JenisInputLaporanHarian).optional(),
  pencatatId: z.string().optional(),
  pelangganId: z.string().optional(),
  /// Rute baca meter pelanggannya. Verifikasi dikerjakan PER RUTE — satu
  /// penyelia memegang beberapa rute dan memeriksa setoran rute demi rute,
  /// bukan 22 ribu baris bercampur. Menyaring lewat pencatat tidak menjawab
  /// itu: seorang pencatat bisa memegang beberapa rute, dan satu rute bisa
  /// berpindah tangan di tengah bulan.
  ruteId: z.string().optional(),
  wilayahDistId: z.string().optional(),
  zonaId: z.string().optional(),
  ruteLanjutanId: z.string().optional(),
  pencatatLanjutanId: z.string().optional(),
  kondisiLanjutan: z.enum(KondisiCatat).optional(),
  tarifGolonganId: z.string().optional(),
  kecamatanId: z.string().optional(),
  kelurahanId: z.string().optional(),
  alamat: z.string().trim().min(1).optional(),
  noPel: z.string().trim().min(1).optional(),
  nama: z.string().trim().min(1).optional(),
  standKoreksi: z.enum(["ya", "tidak"]).optional(),
  statusSpt: z.enum(["ya", "tidak"]).optional(),
  statusBaca: z.enum(["ya", "tidak"]).optional(),
  tanggalBacaDari: z.string().trim().optional(),
  tanggalBacaSampai: z.string().trim().optional(),
  kategori: z.enum(["ONSITE", "OFFSITE"]).optional(),
  pemakaianRangeDari: z.coerce.number().int().optional(),
  pemakaianRangeSampai: z.coerce.number().int().optional(),
  pemakaianOperator: z.enum(["=", ">", ">=", "<", "<="]).optional(),
  pemakaian: z.coerce.number().int().optional(),
  persentaseOperator: z.enum(["=", ">", ">=", "<", "<="]).optional(),
  persentase: z.coerce.number().int().optional(),
  verifWil: z.enum(["ya", "tidak"]).optional(),
  verifKasie: z.enum(["ya", "tidak"]).optional(),
  verifPusat: z.enum(["ya", "tidak"]).optional(),
  /// Kondisi catat lapangan (NORMAL, RUMAH_KOSONG, METER_RUSAK, …). Kolomnya
  /// sudah tampil di tabel /dashboard/laporan-harian sejak lama, tapi tanpa
  /// penyaring ini pertanyaan pengawasan yang wajar — "berapa meter rusak
  /// yang disetor bulan ini" — hanya bisa dijawab dengan menggulir 22 ribu
  /// baris. Sama persis dengan penyaring `kondisi` di /pembacaan.
  kondisi: z.enum(KondisiCatat).optional(),
  /// Rentang TANGGAL CATAT (bukan periode). Dipakai layar verifikasi untuk
  /// memantau setoran harian: "apa yang masuk hari ini", "pekan ini".
  /// Keduanya inklusif; boleh dipakai sendiri-sendiri.
  tanggalDari: z.string().trim().optional(),
  tanggalSampai: z.string().trim().optional(),
  /// true = hanya baris anomali (di luar ±ambang). Ambangnya dibaca dari
  /// Konfigurasi, sama dengan yang dipakai kartu ringkasan.
  hanyaAnomali: z.coerce.boolean().optional(),
  /// true = hanya baris yang membawa usulan perubahan data dari lapangan
  /// (bill_perubahan Aurora). Tanpa penyaring ini usulan petugas terkubur di
  /// antara 22.500 baris biasa dan praktis tidak pernah terbaca siapa pun —
  /// yang selama ini memang terjadi: kolomnya terisi, tidak ada yang membuka.
  adaUsulan: z.coerce.boolean().optional(),
  /// true = kirim HANYA kolom yang dipakai tabel. Baris penuh berisi 50
  /// field + 7 relasi (~1,9 KB); yang ditampilkan cuma 18. Pada 2.000 baris
  /// selisihnya 3,7 MB vs ~0,9 MB — dan itu terasa sebagai "halaman berat"
  /// jauh sebelum servernya sendiri melambat. Panel detail tetap mengambil
  /// baris penuh lewat GET /:id saat sebuah baris dipilih.
  ringkas: z.coerce.boolean().optional(),
})

/// Ringkasan untuk halaman verifikasi: hitungan per status + daftar periode
/// yang benar-benar punya data (untuk dropdown filter). Terdaftar SEBELUM
/// /:id supaya "stats" tidak tertelan param id.
export const statsQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

export const progresQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912),
})

export const belumDibacaQuerySchema = paginationQuerySchema.extend({
  periode: z.coerce.number().int().min(190001).max(999912),
  pencatatId: z.string().optional(),
  ruteId: z.string().optional(),
  q: z.string().trim().min(1).optional(),
})

export const ruteSayaQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

export const susunUrutSchema = z.object({
  ruteId: z.string().min(1),
  /// Seluruh pelanggan rute itu, dalam urutan kunjungan yang dikehendaki.
  /// Dikirim UTUH, bukan sepasang "pindahkan A ke posisi 5": daftar penuh
  /// membuat hasilnya tidak bergantung pada urutan sampainya permintaan
  /// kalau petugas menggeser beberapa baris sekaligus di perjalanan.
  pelangganIds: z.array(z.string().min(1)).min(1).max(2000),
})

export const JENIS_FOTO = ["stand", "segel", "rumah", "video"] as const

export const unggahFotoSchema = z.object({
  nomorLangganan: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "Nomor langganan harus 11 digit angka"),
  periode: z.coerce.number().int().min(190001).max(999912),
  jenis: z.enum(JENIS_FOTO),
})

export const urlFotoSchema = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (v) =>
      v.startsWith("https://") || v.startsWith("http://") || v.startsWith("/"),
    {
      message: "URL foto harus absolut (http/https) atau path relatif server",
    }
  )

export const createSchema = z.object({
  nomorLangganan: z.string().trim().min(1).max(20),
  pelangganId: z.string().min(1).nullable().optional(),
  namaPelanggan: z.string().trim().max(200).nullable().optional(),
  alamatPelanggan: z.string().trim().max(500).nullable().optional(),
  periode: z.coerce.number().int().min(190001).max(999912),
  standAwal: z.coerce.number().int().min(0),
  standAkhir: z.coerce.number().int().min(0),
  pemakaianLalu: z.coerce.number().int().min(0).nullable().optional(),
  persentase: z.coerce.number().int().nullable().optional(),
  kondisi: z.enum(KondisiCatat).optional(),
  kategori: z.enum(KategoriPembacaan).optional(),
  nomorMeter: z.string().trim().max(50).nullable().optional(),
  pencatatId: z.string().min(1).nullable().optional(),
  tanggalCatat: z.coerce.date().nullable().optional(),
  /// Tiga foto bukti dari aplikasi petugas: stand meter, segel, rumah.
  /// Diterima juga path relatif ("/api/public/berkas/…") — bentuk URL yang
  /// dikembalikan simpanBerkas() pada fallback disk lokal saat development;
  /// z.string().url() murni akan menolaknya dan mematikan alur foto di dev.
  fotoStandUrl: urlFotoSchema.nullable().optional(),
  fotoSegelUrl: urlFotoSchema.nullable().optional(),
  fotoRumahUrl: urlFotoSchema.nullable().optional(),
  /// Video pembacaan (opsional) — unggah dulu lewat POST /foto jenis=video.
  videoUrl: urlFotoSchema.nullable().optional(),
  /// Posisi GPS petugas saat menyimpan catatan (pola bill_longlatcatat
  /// Aurora). jarakMeter TIDAK diterima dari client — dihitung server dari
  /// pasangan ini terhadap koordinat pelanggan.
  latCatat: z.coerce.number().min(-90).max(90).nullable().optional(),
  longCatat: z.coerce.number().min(-180).max(180).nullable().optional(),
  /// Kondisi segel yang ditemukan di lapangan (bill_issegel Aurora).
  isSegel: z.boolean().nullable().optional(),
  /// Usulan koreksi data pelanggan dari lapangan (bill_perubahan Aurora).
  usulanPerubahan: z.string().trim().max(1000).nullable().optional(),
  /// Usulan nomor urut kunjungan baru (bill_reqnourutbaru Aurora) — admin
  /// menerapkannya ke Pelanggan.noUrutRute saat closing.
  usulanNoUrut: z.coerce.number().int().min(1).nullable().optional(),
  /// Pembaruan No. HP pelanggan dari lapangan (bill_nohp Aurora) —
  /// diterapkan langsung ke Pelanggan.notelp bila laporan tertaut
  /// pelanggan; string kosong/null diabaikan (bukan perintah menghapus).
  notelpBaru: z.string().trim().max(30).nullable().optional(),
})

export const batchSchema = z.object({
  laporan: z.array(createSchema).min(1).max(300),
})

export const TIPE_FOTO = ["stand", "segel", "rumah", "video"] as const
export type JenisFoto = (typeof TIPE_FOTO)[number]
export type TipeImpor = JenisFoto | "catatan"

/// Periode WAJIB dan eksplisit di kedua pintu impor cadangan.
export const periodeImpor = z.coerce.number().int().min(190001).max(999912)

export const imporFotoSchema = z.object({
  periode: periodeImpor,
  jenis: z.enum(TIPE_FOTO),
})

export const imporCatatanSchema = z.object({ periode: periodeImpor })

export const verif1Schema = z.object({
  /// Meter tujuan pembacaan resmi, dipilih di V1 (paling dekat ke lapangan).
  /// Wajib eksplisit: `nomorMeter` di laporan bisa duplikat/orphan (681
  /// duplikat di data lapangan), jadi penentuan meter yang benar adalah
  /// keputusan verifikator, bukan tebakan sistem.
  meterId: z.string().min(1),
  blokTarif: z.coerce.number().int().min(1).max(4),
  catatanVerif: z.string().trim().max(500).nullable().optional(),
  /// "ST akhir revisi": koreksi stand akhir bila petugas salah input.
  /// TIDAK menimpa standAkhir (angka catat) — keduanya tampil berdampingan;
  /// V3 memakai revisi (bila ada) sebagai stand pembacaan resmi.
  standAkhirRevisi: z.coerce.number().int().min(0).nullable().optional(),
  /// Stand angkat hanya dipakai untuk kondisi MB. standAwal laporan adalah
  /// stand meter lama pada awal periode; pembacaan meter baru dicatat
  /// terpisah agar pemakaian gabungan dapat dihitung.
  standAngkatLama: z.coerce.number().int().min(0).nullable().optional(),
  standMeterBaru: z.coerce.number().int().min(0).nullable().optional(),
  /// Koreksi keterangan/kondisi catat (DK, BMK/BMB, dst.) — stand revisi
  /// kumulatif kerap menuntut kondisi ikut dibenarkan. Ikut mengalir ke
  /// PembacaanMeter resmi saat V3 (V3 membaca laporan.kondisi).
  kondisi: z.enum(KondisiCatat).optional(),
  /// Dipertahankan pada schema bersama agar V3 dapat menetapkan nilai final.
  /// Handler V1 dan V2 menolak field ini secara eksplisit.
  pemakaianTagih: z.coerce.number().int().min(0).nullable().optional(),
})

/// V2 & V3 BOLEH MENGOREKSI, bukan sekadar menandatangani.
///
/// Versi pertama hanya menerima catatan di kedua ring ini, dan akibatnya
/// janggal: kalau supervisor salah memasukkan angka di V1, manager dan
/// senior manager cuma punya dua pilihan — meloloskan yang salah, atau
/// menolak seluruh laporan sehingga PETUGAS yang disuruh mengulang padahal
/// kesalahannya bukan di dia. Wewenang yang lebih tinggi tapi kemampuan
/// yang lebih rendah tidak masuk akal.
///
/// Semua kolom koreksi bersifat OPSIONAL: mengirim body kosong = "saya
/// setuju apa adanya", persis perilaku lama. Yang dikirim akan menimpa
/// nilai V1, dan siapa yang terakhir mengubah tetap terbaca dari ring yang
/// mengisinya.
export const catatanSchema = z.object({
  catatanVerif: z.string().trim().max(500).nullable().optional(),
  /// Koreksi yang sama persis yang tersedia di V1.
  meterId: z.string().min(1).optional(),
  blokTarif: z.coerce.number().int().min(1).max(4).optional(),
  standAkhirRevisi: z.coerce.number().int().min(0).nullable().optional(),
  standAngkatLama: z.coerce.number().int().min(0).nullable().optional(),
  standMeterBaru: z.coerce.number().int().min(0).nullable().optional(),
  pemakaianTagih: z.coerce.number().int().min(0).nullable().optional(),
  kondisi: z.enum(KondisiCatat).optional(),
})

export const koreksiLaporanSchema = z.object({
  standAwalRevisi: z.coerce.number().int().min(0).nullable().optional(),
  standAkhirRevisi: z.coerce.number().int().min(0).nullable().optional(),
  pemakaianTagihVerif: z.coerce.number().int().min(0).nullable().optional(),
  kondisiRevisi: z.enum(KondisiCatat).nullable().optional(),
  standAngkatLama: z.coerce.number().int().min(0).nullable().optional(),
  standMeterBaru: z.coerce.number().int().min(0).nullable().optional(),
  meterVerifId: z.string().nullable().optional(),
})

export const penilaianFotoSchema = z
  .object({
    sesuai: z.boolean(),
    keterangan: z.string().trim().max(500).default(""),
  })
  .refine(
    (nilai) => nilai.sesuai || nilai.keterangan.length >= 5,
    "Keterangan minimal 5 karakter wajib diisi jika kondisi foto tidak sesuai."
  )

export const verifMassalSchema = z.object({
  ring: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  ids: z.array(z.string().min(1)).min(1).max(500),
  /// Bawaannya false: baris anomali dilewati & dilaporkan, tidak diloloskan
  /// diam-diam. Pemanggil harus menyatakan niatnya secara eksplisit.
  sertakanAnomali: z.boolean().optional(),
})

export const rejectSchema = z.object({
  catatanVerif: z.string().trim().min(1).max(500),
})

export type ListLaporanQuery = z.infer<typeof listQuerySchema>
export type StatsLaporanQuery = z.infer<typeof statsQuerySchema>
export type ProgresLaporanQuery = z.infer<typeof progresQuerySchema>
export type BelumDibacaQuery = z.infer<typeof belumDibacaQuerySchema>
export type RuteSayaQuery = z.infer<typeof ruteSayaQuerySchema>
export type SusunUrutInput = z.infer<typeof susunUrutSchema>
export type UnggahFotoInput = z.infer<typeof unggahFotoSchema>
export type CreateLaporanInput = z.infer<typeof createSchema>
export type BatchLaporanInput = z.infer<typeof batchSchema>
export type ImporFotoInput = z.infer<typeof imporFotoSchema>
export type ImporCatatanInput = z.infer<typeof imporCatatanSchema>
export type Verif1Input = z.infer<typeof verif1Schema>
export type CatatanVerifInput = z.infer<typeof catatanSchema>
export type KoreksiLaporanInput = z.infer<typeof koreksiLaporanSchema>
export type PenilaianFotoInput = z.infer<typeof penilaianFotoSchema>
export type VerifMassalInput = z.infer<typeof verifMassalSchema>
export type RejectLaporanInput = z.infer<typeof rejectSchema>

export interface AuditMeta {
  ipAddress: string | null
  userAgent: string | null
}
