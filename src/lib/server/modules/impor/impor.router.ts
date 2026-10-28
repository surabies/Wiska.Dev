// server/modules/impor/impor.router.ts — IMPOR BERKAS SUMBER PER BATCH.
//
// KENAPA PER BATCH, BUKAN SATU BERKAS SEKALI KIRIM. Berkas nyata berisi
// ~22.500 baris. Mengirimkannya sebagai satu permintaan berarti: satu
// timeout menghanguskan seluruh pekerjaan, tidak ada yang bisa ditampilkan
// ke pengguna selama menunggu, dan satu baris rusak di tengah membuat
// nasib 22.499 sisanya tidak jelas. Klien memecahnya jadi potongan kecil,
// mengirim berurutan, dan menampilkan kemajuannya.
//
// TIGA SIKAP YANG DIJAGA:
//
// 1. **Idempoten.** Setiap baris dikunci pada pasangan alami (nomor
//    langganan + periode). Mengirim ulang batch yang sama menghasilkan
//    DUPLIKAT — dilaporkan, bukan digandakan. Ini yang membuat "ulangi
//    batch yang gagal" aman dilakukan pengguna tanpa takut dobel.
//
// 2. **Satu baris rusak tidak menjatuhkan batch.** Kegagalan dicatat
//    per baris berikut nomor barisnya di berkas asli, supaya pengguna tahu
//    persis baris mana yang harus diperbaiki.
//
// 3. **Periode yang sudah DIKUNCI ditolak.** Mengimpor pencatatan ke
//    periode yang tagihannya sudah terbit akan menulis ulang dasar
//    penagihan yang sudah sah. Penjaganya di sini, bukan di klien.

import { Hono } from "hono"
import { z } from "zod"
import { prisma } from "@db"
import type { JenisPemutusan } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok } from "../../lib/response"
import { BadRequestError, isPrismaKnownError } from "../../lib/errors"
import { periodeToDate } from "../../lib/periode"

export const imporRouter = new Hono()

/// Sengaja tidak besar: satu batch harus selesai jauh di bawah batas
/// timeout proxy mana pun, dan cukup kecil supaya bilah kemajuan bergerak
/// terasa hidup. 500 baris ~ 1-2 detik pada koneksi normal.
const MAKS_BARIS_PER_BATCH = 1000

/// DIPERBARUI dipisahkan dari TERSIMPAN dengan sengaja. Baris pemutusan
/// kerap SUDAH ADA di database dari sumber yang lebih lemah (deteksi "hilang
/// dari ProgresCater" atau kondisi catat "D" — lihat sumberData di model
/// Pemutusan), dan r-nomor datang belakangan membawa jenis & nomor suratnya.
/// Menghitungnya sebagai "tersimpan" akan menyembunyikan bahwa yang terjadi
/// adalah pelengkapan baris lama, bukan penambahan baris baru.
type StatusBaris =
  "TERSIMPAN" | "DIPERBARUI" | "DUPLIKAT" | "DILEWATI" | "GAGAL"

interface HasilBaris {
  /// Nomor baris di BERKAS ASLI (bukan di batch) — supaya pengguna bisa
  /// langsung membukanya di Excel.
  baris: number
  nomorLangganan: string
  status: StatusBaris
  pesan?: string
}

interface HasilBatch {
  diproses: number
  tersimpan: number
  /// Selalu 0 untuk impor pencatatan — di sana tidak ada baris lama dari
  /// sumber lain yang perlu dilengkapi.
  diperbarui: number
  duplikat: number
  dilewati: number
  gagal: number
  /// Hanya baris bermasalah yang dikembalikan. Mengembalikan 1.000 baris
  /// "TERSIMPAN" tiap batch tidak menolong siapa pun dan membengkakkan
  /// respons sampai puluhan MB pada berkas penuh.
  masalah: HasilBaris[]
}

/// ── Penjaga periode ──────────────────────────────────────────────────────
/// Periode dianggap TERKUNCI bila sudah punya tagihan terbit. Impor
/// pencatatan ke periode seperti itu akan menggeser dasar penagihan yang
/// sudah sah, jadi ditolak dengan pesan yang menyebut jalan keluarnya.
async function pastikanPeriodeTerbuka(periode: number): Promise<void> {
  const jumlahTagihan = await prisma.tagihan.count({
    where: { periode: periodeToDate(periode) },
  })
  if (jumlahTagihan > 0) {
    throw new BadRequestError(
      `Periode ${periode} sudah punya ${jumlahTagihan.toLocaleString("id-ID")} tagihan terbit — impor pencatatan ditolak. ` +
        `Buka kembali periodenya lewat Closing bila memang perlu diperbaiki.`,
    )
  }
}

// ── 1) PENCATATAN HARIAN (lapdatameter) ──────────────────────────────────
//
// Sumber: setoran harian petugas. Selama aplikasi mobile belum menggantikan
// setoran berkas, inilah pintunya. Baris masuk sebagai LaporanHarianPetugas
// (pra-verifikasi) — BUKAN langsung PembacaanMeter. Kenaikan jadi angka
// resmi hanya terjadi di V3, sama seperti kiriman aplikasi petugas.
const barisPencatatanSchema = z.object({
  baris: z.number().int().min(1),
  nomorLangganan: z.string().trim().min(1).max(20),
  periode: z.number().int().min(190001).max(999912),
  standAwal: z.number().int().min(0),
  standAkhir: z.number().int().min(0),
  /// PEMAKAIAN NEGATIF ITU DATA NYATA — `.min(0)` di sini adalah bug, bukan
  /// penjagaan. Meter yang MUNDUR menghasilkan stand akhir lebih kecil dari
  /// stand awal (mis. 2.382 -> 2.362), dan Aurora memang menuliskan
  /// pemakaiannya -20. Berkas 202608 punya satu baris seperti itu, dan
  /// karena Zod memeriksa seluruh array sekaligus, satu baris itu MENOLAK
  /// 250 baris sebelah-menyebelahnya — mengulang tidak menolong sama sekali
  /// karena berkasnya memang tidak berubah.
  ///
  /// Mengubahnya jadi 0 juga bukan jalan keluar: angka minus inilah gejala
  /// meter bermasalah yang harus DILIHAT verifikator (baris tadi bahkan
  /// tercatat kondisi "Normal" dengan persentase -300). LaporanHarianPetugas
  /// adalah catatan PRA-VERIFIKASI, bukan angka tagih — dan jalur tagihnya
  /// sudah tahan minus: `usulkanPemakaianTagih` menagih minimum 5 m3 untuk
  /// pemakaian di bawah 5, `hitungRincianHargaAir` mengembalikan 0 untuk <= 0.
  /// Stand sendiri TETAP `.min(0)` — stand negatif memang mustahil.
  pemakaian: z.number().int().nullable().optional(),
  pemakaianLalu: z.number().int().nullable().optional(),
  persentase: z.number().int().nullable().optional(),
  kondisi: z.string().trim().max(40).nullable().optional(),
  namaPetugas: z.string().trim().max(120).nullable().optional(),
  tanggalCatat: z.string().trim().max(40).nullable().optional(),
})

/// BARISNYA SENGAJA `unknown` DI SINI, DIPERIKSA SATU-SATU DI DALAM HANDLER.
///
/// `z.array(barisPencatatanSchema)` terlihat lebih rapi tapi diam-diam
/// membatalkan sikap #2 di kepala berkas ini ("satu baris rusak tidak
/// menjatuhkan batch"): Zod memvalidasi array sebagai satu kesatuan, jadi
/// SATU baris cacat membuat 250 baris lain ditolak sebelum handler-nya
/// sempat jalan. Yang diterima operator cuma 422 "Input tidak valid" —
/// tanpa nomor baris, tanpa nama kolom, dan tanpa satu pun baris masuk.
///
/// Yang tersisa di sini hanyalah pagar amplop: bentuk luarnya benar dan
/// jumlah barisnya wajar. Isi tiap baris diadili sendiri-sendiri, dan yang
/// gagal dilaporkan sebagai baris GAGAL berikut nomor barisnya di berkas —
/// sama seperti kegagalan penulisan ke database.
const batchPencatatanSchema = z.object({
  periode: z.number().int().min(190001).max(999912),
  baris: z.array(z.unknown()).min(1).max(MAKS_BARIS_PER_BATCH),
})

/// Memeriksa baris satu per satu. Yang lolos dikembalikan siap pakai; yang
/// gagal jadi HasilBaris GAGAL yang menyebut kolom & alasannya, supaya
/// operator bisa membuka baris itu di Excel dan memperbaikinya.
function saringBaris<T extends z.ZodType>(
  skema: T,
  mentah: readonly unknown[],
): { sah: z.infer<T>[]; cacat: HasilBaris[] } {
  const sah: z.infer<T>[] = []
  const cacat: HasilBaris[] = []
  mentah.forEach((isi, i) => {
    const hasil = skema.safeParse(isi)
    if (hasil.success) {
      sah.push(hasil.data)
      return
    }
    // Nomor baris & nomor langganan dibaca dari muatan MENTAH: baris yang
    // gagal validasi tetap harus bisa ditunjuk. Kalau keduanya pun tidak
    // terbaca, posisinya di batch masih lebih berguna daripada diam.
    const m = (isi ?? {}) as Record<string, unknown>
    cacat.push({
      baris: typeof m.baris === "number" ? m.baris : i + 1,
      nomorLangganan:
        typeof m.nomorLangganan === "string" ? m.nomorLangganan : "—",
      status: "GAGAL",
      pesan: hasil.error.issues
        .map((u) => `${u.path.join(".") || "baris"}: ${u.message}`)
        .join("; ")
        .slice(0, 200),
    })
  })
  return { sah, cacat }
}

/// Kondisi catat di lapdatameter disimpan sebagai KODE di kolom `Kd_kel`
/// (nama kolomnya menyesatkan — isinya bukan kelurahan). Peta ini HARUS
/// sama persis dengan yang dipakai seed (`normalizeKondisiCatat` di
/// prisma/seed/lib/normalize.ts); disalin, bukan diimpor, karena
/// API route code must not depend on seed implementation details.
///
/// Kode yang TIDAK dikenali dibiarkan kosong, bukan ditebak jadi NORMAL —
/// menebak akan menyembunyikan pembacaan bermasalah dari verifikator,
/// persis orang yang seharusnya melihatnya.
const KONDISI_DARI_KODE: Record<string, string> = {
  "": "NORMAL",
  "-": "NORMAL",
  "2": "DK",
  "3": "MTA",
  "4": "MB",
  "5": "TTB",
  "6": "BMK_BMB",
  "7": "METER_MATI_ADA_AIR",
  "8": "TIDAK_ADA_AIR",
  "9": "LOS_METER",
  AA: "METER_DALAM_AIR",
  D: "DICABUT",
  E: "TERHALANG",
  F: "METER_MUNDUR",
  H: "TIDAK_DIPAKAI",
  N: "STAND_TEMPEL",
  O: "METER_RUSAK",
  P: "REV_PENCATAT",
  Q: "ADA_ANJING",
  R: "RUMAH_KOSONG",
  T: "METER_TERBALIK",
  U: "MUDA_KEMBALI",
  Z: "STAND_KONSUMEN",
}

imporRouter.post(
  "/pencatatan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", batchPencatatanSchema),
  async (c) => {
    const { periode, baris: barisMentah } = c.req.valid("json")
    await pastikanPeriodeTerbuka(periode)

    const { sah: baris, cacat } = saringBaris(
      barisPencatatanSchema,
      barisMentah,
    )

    const requester = getSessionUser(c)
    const pencatatSaya = await prisma.pencatat.findUnique({
      where: { userId: requester.id },
      select: { id: true },
    })

    // Preload sekali per batch — bukan per baris. Dengan 1.000 baris, dua
    // query di sini menggantikan 2.000 round-trip.
    const nomor = baris.map((b) => b.nomorLangganan)
    const [pelanggan, pencatat] = await Promise.all([
      prisma.pelanggan.findMany({
        where: { nomorLangganan: { in: nomor }, deletedAt: null },
        select: { id: true, nomorLangganan: true, nama: true, alamat: true },
      }),
      prisma.pencatat.findMany({ select: { id: true, namaLapangan: true } }),
    ])
    const petaPelanggan = new Map(pelanggan.map((p) => [p.nomorLangganan, p]))
    const petaPencatat = new Map(
      pencatat.map((p) => [p.namaLapangan.toUpperCase(), p.id]),
    )

    // `diproses` menghitung SEMUA baris yang dikirim, termasuk yang cacat.
    // Klien membandingkan angka ini dengan jumlah baris berkas (neraca baris
    // di impor-data-client.tsx); baris cacat yang tidak ikut terhitung akan
    // muncul di sana sebagai "baris hilang" yang tidak pernah ada.
    const hasil: HasilBatch = {
      diproses: barisMentah.length,
      tersimpan: 0,
      diperbarui: 0,
      duplikat: 0,
      dilewati: 0,
      gagal: cacat.length,
      masalah: [...cacat],
    }

    // KONKURENSI, bukan for-loop sequential: versi sebelumnya melakukan satu
    // create() per baris SATU PER SATU (menunggu round-trip Neon tuntas
    // sebelum baris berikutnya mulai) — untuk batch 1.000 baris itu berarti
    // 1.000 round-trip berurutan, terukur ~2-3 menit per batch, dan di atas
    // batas timeout Serverless Function Vercel (10 detik di Hobby) yang jauh
    // lebih pendek dari itu, jadi kemungkinan besar gagal diam-diam sebelum
    // sempat selesai. Pola perbaikannya SAMA PERSIS dengan yang sudah
    // dipakai di prisma/seed/steps/06-meter.ts (lihat catatan KINERJA di
    // sana): proses berkelompok paralel, bukan satu-satu. Increment counter
    // & push ke `hasil.masalah` tetap aman dilakukan dari dalam Promise.all
    // — JS single-threaded, tidak ada balapan pada operasi sinkron di
    // antara dua `await`.
    const KONKURENSI = 16
    async function prosesBaris(b: (typeof baris)[number]): Promise<void> {
      const kondisi = b.kondisi
        ? KONDISI_DARI_KODE[b.kondisi.trim().toUpperCase()]
        : undefined

      const p = petaPelanggan.get(b.nomorLangganan)
      if (!p) {
        // Nomor tak dikenal BUKAN kegagalan sistem, dan sebabnya ada DUA yang
        // berlawanan arah — membedakannya menentukan apakah operator perlu
        // bertindak atau tidak:
        //
        //   kondisi DICABUT  sambungan yang sudah dicabut sebelum periode ini.
        //                    Petugas masih mendatanginya sekali untuk memastikan
        //                    (stand tidak bergerak), lalu ia lenyap dari sistem.
        //                    TIDAK ADA yang perlu dikerjakan — membuatkan
        //                    pelanggan justru menghidupkan sambungan mati yang
        //                    akan menagih beban tiap bulan tanpa pernah dibayar.
        //
        //   selain itu       lazimnya sambungan baru yang PBPK-nya belum
        //                    diimpor. Ini yang menuntut tindakan.
        //
        // Pesan lama menyebut keduanya "impor PBPK dulu", dan untuk yang
        // dicabut itu menyesatkan — operator akan mencarinya di berkas PBPK
        // yang memang tidak akan pernah memuatnya.
        hasil.dilewati++
        hasil.masalah.push({
          baris: b.baris,
          nomorLangganan: b.nomorLangganan,
          status: "DILEWATI",
          pesan:
            kondisi === "DICABUT"
              ? "Sambungan sudah DICABUT — tidak dibuatkan pelanggan, tapi diarsipkan ke Pemutusan."
              : "Nomor langganan tidak ada di data pelanggan — impor PBPK-nya lebih dulu bila ini sambungan baru.",
        })
        // ARSIP: konfirmasi petugas lapangan bahwa sambungan ini sudah
        // dicabut TETAP harus meninggalkan jejak, walau tidak ada baris
        // Pelanggan untuk ditautkan (persis alasan pelangganId Pemutusan
        // nullable — lihat komentar modelnya). Sebelumnya baris ini cuma
        // masuk `hasil.masalah` yang dibuang begitu respons batch ini
        // selesai dibaca — pola yang sama yang baru dibenahi di seed step
        // 11 (lihat sumberData "PROGRESCATER_HILANG"). sumberKey menjaga
        // idempoten kalau CSV yang sama diimpor ulang.
        if (kondisi === "DICABUT") {
          await prisma.pemutusan.upsert({
            where: {
              sumberKey: `LAPDATAMETER:${b.periode}:${b.nomorLangganan}`,
            },
            create: {
              nomorLangganan: b.nomorLangganan,
              jenis: "LAINNYA",
              periode: b.periode,
              sumberData: "LAPDATAMETER_DICABUT",
              sumberKey: `LAPDATAMETER:${b.periode}:${b.nomorLangganan}`,
              catatan: `Kondisi DICABUT di lapdatameter periode ${b.periode}, nomor tidak ada di data pelanggan — jenis pencabutan perlu ditinjau lewat layar pemutusan.`,
            },
            update: {},
          })
        }
        return
      }
      const pencatatId =
        (b.namaPetugas
          ? petaPencatat.get(b.namaPetugas.trim().toUpperCase())
          : undefined) ??
        pencatatSaya?.id ??
        null
      const tanggalCatat = b.tanggalCatat ? new Date(b.tanggalCatat) : null

      try {
        await prisma.laporanHarianPetugas.create({
          data: {
            nomorLangganan: b.nomorLangganan,
            pelangganId: p.id,
            namaPelanggan: p.nama,
            alamatPelanggan: p.alamat,
            periode: b.periode,
            standAwal: b.standAwal,
            standAkhir: b.standAkhir,
            // PEMAKAIAN DIAMBIL APA ADANYA dari berkas, bukan dihitung dari
            // selisih stand. lapdatameter & ProgresCater adalah keluaran
            // verifikasi berjenjang Aurora — angkanya sudah matang, dan
            // menghitung ulang berarti menaksir ulang keputusan yang sudah
            // diambil manusia. Selisih stand tetap tersimpan terpisah
            // (standAwal/standAkhir) supaya keduanya bisa dibandingkan.
            //
            // Fallback ke selisih stand HANYA bila berkasnya memang tidak
            // membawa kolom pemakaian.
            pemakaian: b.pemakaian ?? Math.max(0, b.standAkhir - b.standAwal),
            ...(b.pemakaianLalu !== null && b.pemakaianLalu !== undefined
              ? { pemakaianLalu: b.pemakaianLalu }
              : {}),
            // Diambil apa adanya dari berkas — ini angka yang jadi dasar
            // penyaringan anomali di layar verifikasi.
            ...(b.persentase !== null && b.persentase !== undefined
              ? { persentase: b.persentase }
              : {}),
            ...(kondisi ? { kondisi: kondisi as never } : {}),
            ...(pencatatId ? { pencatatId } : {}),
            ...(tanggalCatat && !Number.isNaN(tanggalCatat.getTime())
              ? { tanggalCatat }
              : {}),
          },
        })
        hasil.tersimpan++
      } catch (err) {
        if (isPrismaKnownError(err) && err.code === "P2002") {
          hasil.duplikat++
          hasil.masalah.push({
            baris: b.baris,
            nomorLangganan: b.nomorLangganan,
            status: "DUPLIKAT",
            pesan: "Pencatatan periode ini sudah pernah masuk.",
          })
        } else {
          hasil.gagal++
          hasil.masalah.push({
            baris: b.baris,
            nomorLangganan: b.nomorLangganan,
            status: "GAGAL",
            pesan: (err as Error).message.slice(0, 200),
          })
        }
      }
    }

    for (let mulai = 0; mulai < baris.length; mulai += KONKURENSI) {
      const kelompok = baris.slice(mulai, mulai + KONKURENSI)
      await Promise.all(kelompok.map((b) => prosesBaris(b)))
    }

    return ok(c, hasil)
  },
)

// ── 2) PEMUTUSAN (r-nomor) ───────────────────────────────────────────────
//
// Mencatat FAKTA pemutusan. Status PELANGGAN tidak diubah di sini — sikap
// yang sama yang dipegang seed sejak awal: mengubah status adalah keputusan
// berkonsekuensi hukum & tagihan, dan harus lewat layar pemutusan dengan
// manusia yang menyetujuinya.
//
// TAPI DAFTAR CATAT PERIODE ITU DITANDAI DICABUT — dan itu bukan hal yang
// sama. "Buka bulan baru" mengeluarkan sambungan dari daftar bulan depan
// berdasarkan tanda DICABUT di DaftarCatat, BUKAN berdasarkan isi tabel
// Pemutusan (lihat bulan-baru.service.ts: "Satu-satunya pintu keluar").
// Tanpa penandaan itu, mengimpor r-nomor tidak berpengaruh apa pun pada
// siklus: sambungan yang sudah putus tetap terbawa ke daftar kerja bulan
// depan, terus dikunjungi, dan terus ditagih. POST /pemutusan (entri
// satuan) sudah menandainya sejak awal; impor massal tertinggal — dan
// justru lewat impor inilah cabutan sungguhan masuk tiap bulan.
//
// PERIODE YANG SUDAH DIKUNCI DITOLAK PER BARIS. Menandai DICABUT di periode
// yang DRD-nya sudah terbit berarti menulis ulang beban kerja bulan yang
// sudah selesai — persis yang dicegah di seluruh berkas closing. Barisnya
// dilewati beserta alasannya, bukan menjatuhkan seluruh batch: satu berkas
// r-nomor bisa memuat lebih dari satu periode.
const barisPemutusanSchema = z.object({
  baris: z.number().int().min(1),
  nomorLangganan: z.string().trim().min(1).max(20),
  periode: z.number().int().min(190001).max(999912),
  jenis: z.string().trim().min(1).max(20),
  noSurat: z.string().trim().max(100).nullable().optional(),
  tanggalTutup: z.string().trim().max(40).nullable().optional(),
  tanggalCabut: z.string().trim().max(40).nullable().optional(),
})

/// Barisnya `unknown` dengan alasan yang sama persis seperti batch
/// pencatatan di atas — lihat catatan panjang di sana.
const batchPemutusanSchema = z.object({
  baris: z.array(z.unknown()).min(1).max(MAKS_BARIS_PER_BATCH),
})

/// Kosakata r-nomor -> enum JenisPemutusan. Sengaja HANYA dua yang dikenal —
/// nilai lain ditolak per baris, tidak ditebak. TSM & SPT berbeda akibat
/// hukumnya.
///
/// Nilainya HARUS anggota enum. Versi sebelumnya memetakan ke
/// "TUTUP_SEMENTARA"/"TUTUP_SPT" — itu nilai enum StatusPelanggan, bukan
/// JenisPemutusan — lalu meloloskannya lewat `as never`, sehingga SETIAP
/// baris r-nomor gagal di database dengan "Invalid value for argument
/// `jenis`". Anotasi tipe di bawah yang membuat kekeliruan seperti itu
/// ketahuan saat compile, bukan saat operator sedang mengimpor.
const JENIS_PEMUTUSAN: Record<string, JenisPemutusan> = {
  TSM: "TSM",
  SPT: "SPT",
}

imporRouter.post(
  "/pemutusan",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", batchPemutusanSchema),
  async (c) => {
    const { baris: barisMentah } = c.req.valid("json")
    const { sah: baris, cacat } = saringBaris(barisPemutusanSchema, barisMentah)
    const requester = getSessionUser(c)
    const nomor = baris.map((b) => b.nomorLangganan)
    const periodeDiBatch = [...new Set(baris.map((b) => b.periode))]

    // Dua preload sekali per batch, bukan per baris — pola yang sama dengan
    // impor pencatatan di atas.
    const [pelanggan, periodeRows] = await Promise.all([
      prisma.pelanggan.findMany({
        where: { nomorLangganan: { in: nomor }, deletedAt: null },
        select: { id: true, nomorLangganan: true },
      }),
      prisma.periodePenagihan.findMany({
        where: { periode: { in: periodeDiBatch }, status: "TERKUNCI" },
        select: { periode: true },
      }),
    ])
    const peta = new Map(pelanggan.map((p) => [p.nomorLangganan, p.id]))
    const terkunci = new Set(periodeRows.map((p) => p.periode))

    // Termasuk baris cacat — lihat catatan neraca baris di endpoint pencatatan.
    const hasil: HasilBatch = {
      diproses: barisMentah.length,
      tersimpan: 0,
      diperbarui: 0,
      duplikat: 0,
      dilewati: 0,
      gagal: cacat.length,
      masalah: [...cacat],
    }

    /// Penanda yang membuat pemutusan benar-benar berpengaruh pada siklus —
    /// lihat catatan panjang di atas. Barisnya TIDAK dihapus, hanya ditandai:
    /// petugas memang sudah mengunjunginya bulan ini, jadi beban kerja
    /// periode berjalan tidak boleh berubah surut.
    const tandaiDicabut = (pelangganId: string, periode: number) =>
      prisma.daftarCatat.updateMany({
        where: { periode, pelangganId },
        data: { status: "DICABUT", selesaiAt: new Date() },
      })

    for (const b of baris) {
      const jenis = JENIS_PEMUTUSAN[b.jenis.trim().toUpperCase()]
      if (!jenis) {
        hasil.gagal++
        hasil.masalah.push({
          baris: b.baris,
          nomorLangganan: b.nomorLangganan,
          status: "GAGAL",
          pesan: `Jenis pemutusan "${b.jenis}" tidak dikenal — hanya TSM atau SPT.`,
        })
        continue
      }
      const pelangganId = peta.get(b.nomorLangganan)
      if (!pelangganId) {
        hasil.dilewati++
        hasil.masalah.push({
          baris: b.baris,
          nomorLangganan: b.nomorLangganan,
          status: "DILEWATI",
          pesan: "Nomor langganan tidak ada di data pelanggan.",
        })
        continue
      }
      if (terkunci.has(b.periode)) {
        hasil.dilewati++
        hasil.masalah.push({
          baris: b.baris,
          nomorLangganan: b.nomorLangganan,
          status: "DILEWATI",
          pesan:
            `Periode ${b.periode} sudah dikunci — impor pemutusan ke periode itu ditolak supaya daftar catat & ` +
            `DRD-nya tidak berubah surut. Buka kembali periodenya lewat Closing bila memang perlu diperbaiki.`,
        })
        continue
      }

      const tglTutup = b.tanggalTutup ? new Date(b.tanggalTutup) : null
      const tglCabut = b.tanggalCabut ? new Date(b.tanggalCabut) : null
      // Kunci idempoten deterministik. @@unique([pelangganId, periode,
      // nomorSurat]) TIDAK cukup: nomorSurat selalu null untuk jenis SPT,
      // dan Postgres menganggap NULL selalu berbeda dari NULL lain — tanpa
      // sumberKey, mengulang batch akan diam-diam menggandakan baris SPT.
      // Bentuknya mengikuti yang sudah dipakai seed.
      const sumberKey = `RNOMOR:${b.periode}:${b.jenis.trim().toUpperCase()}:${b.nomorLangganan}`
      const isi = {
        jenis,
        sumberData: "RNOMOR_CSV",
        sumberKey,
        ...(b.noSurat ? { nomorSurat: b.noSurat } : {}),
        ...(tglTutup && !Number.isNaN(tglTutup.getTime())
          ? { tanggalTutup: tglTutup }
          : {}),
        ...(tglCabut && !Number.isNaN(tglCabut.getTime())
          ? { tanggalCabut: tglCabut }
          : {}),
      }
      try {
        // BARIS LAMA DILENGKAPI, BUKAN DIGANDAKAN. Pemutusan periode ini
        // kerap SUDAH tercatat dari sumber yang lebih lemah — deteksi "hilang
        // dari ProgresCater" (sumberData PROGRESCATER_HILANG) atau kondisi
        // catat "D" (LAPDATAMETER_DICABUT). Keduanya berjenis LAINNYA:
        // "terkonfirmasi cabut, jenis pasti belum diketahui". r-nomor adalah
        // dokumen resminya, jadi ia MELENGKAPI baris itu.
        //
        // Kalau tidak, baris kedua akan lolos begitu saja: sumberKey-nya beda,
        // dan @@unique([pelangganId, periode, nomorSurat]) tidak menahannya
        // karena nomorSurat null di kedua baris — Postgres menganggap NULL
        // selalu berbeda dari NULL lain. Satu pemutusan jadi terhitung dua
        // kali di rekap dan di aritmetika DPM.
        const lama = await prisma.pemutusan.findFirst({
          where: { pelangganId, periode: b.periode },
          select: { id: true, sumberKey: true, sumberData: true },
        })

        if (lama?.sumberKey === sumberKey) {
          hasil.duplikat++
          hasil.masalah.push({
            baris: b.baris,
            nomorLangganan: b.nomorLangganan,
            status: "DUPLIKAT",
            pesan:
              "Pemutusan periode ini sudah tercatat dari berkas r-nomor yang sama.",
          })
          // Penandaan tetap dijalankan: mengulang batch harus MEMPERBAIKI
          // keadaan, bukan sekadar melaporkan "sudah ada" sambil membiarkan
          // daftar catatnya tetap salah.
          await tandaiDicabut(pelangganId, b.periode)
          continue
        }

        if (lama) {
          await prisma.pemutusan.update({ where: { id: lama.id }, data: isi })
          await tandaiDicabut(pelangganId, b.periode)
          hasil.diperbarui++
          hasil.masalah.push({
            baris: b.baris,
            nomorLangganan: b.nomorLangganan,
            status: "DIPERBARUI",
            pesan: `Sudah tercatat dari ${lama.sumberData} — dilengkapi dengan jenis & nomor surat dari r-nomor.`,
          })
          continue
        }

        await prisma.pemutusan.create({
          data: {
            pelangganId,
            nomorLangganan: b.nomorLangganan,
            periode: b.periode,
            prosesOlehId: requester.id,
            ...isi,
          },
        })
        await tandaiDicabut(pelangganId, b.periode)
        hasil.tersimpan++
      } catch (err) {
        if (isPrismaKnownError(err) && err.code === "P2002") {
          hasil.duplikat++
          hasil.masalah.push({
            baris: b.baris,
            nomorLangganan: b.nomorLangganan,
            status: "DUPLIKAT",
            pesan: "Pemutusan periode ini sudah tercatat.",
          })
        } else {
          hasil.gagal++
          hasil.masalah.push({
            baris: b.baris,
            nomorLangganan: b.nomorLangganan,
            status: "GAGAL",
            pesan: (err as Error).message.slice(0, 200),
          })
        }
      }
    }

    return ok(c, hasil)
  },
)
