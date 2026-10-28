// server/modules/publik/publik.router.ts — API untuk warga/pelanggan TANPA
// login: cek tagihan, lapor pengaduan, lapor meter mandiri.
//
// ============================ ATURAN MAIN ============================
// Router ini SENGAJA terpisah dari /api/v1 dan di-mount di /api/public.
// JANGAN memindahkan endpoint publik ke dalam /api/v1 lalu "melubangi"
// verifyAuth() di sana — blanket auth di /api/v1 adalah jaring pengaman:
// selama ia utuh, endpoint internal yang lupa dipasangi requireRole() tetap
// tertutup. Melubanginya satu per satu menghapus jaring itu diam-diam.
//
// Semua yang ada di file ini bisa diakses SIAPA SAJA dari internet. Karena
// itu setiap handler WAJIB:
//   1. cekRateLimit()          — rem penyalahgunaan (lihat lib/rate-limit.ts)
//   2. verifikasiPelanggan()   — untuk apa pun yang menyentuh data pelanggan
//   3. mengembalikan data SEMINIMAL mungkin
//
// Yang TIDAK boleh ada di sini: LISTING/PENCARIAN banyak pelanggan sekaligus
// (mis. cari berdasarkan sebagian nama/alamat, atau prefix nomor) — itu yang
// bisa dipakai memanen data massal. Lookup SATU pelanggan lewat
// `nomorLangganan` PERSIS (exact match, 11 digit) tetap boleh — lihat
// GET /pelanggan/:nomorLangganan di bawah dan catatan keputusan produk di
// verifikasi.ts soal kenapa itu tidak lagi mensyaratkan nama.
import { Hono, type Context } from "hono"
import { z } from "zod"
import { JenisPengaduan, KlasifikasiPengaduan, type Prisma } from "@db"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { ok, created } from "../../lib/response"
import { NotFoundError, BadRequestError } from "../../lib/errors"
import { cekRateLimit, ipKlien } from "../../lib/rate-limit"
import { jendelaLaporMandiri } from "@/lib/domain/lapor-mandiri"
import {
  simpanBerkas,
  BerkasTidakValidError,
  MAKS_UKURAN_BYTE,
} from "../../lib/storage"
import { GEO, setPoint } from "../../lib/spatial"
import { periodeToDate, dateToPeriode } from "../../lib/periode"
import { verifikasiPelanggan, samarkanAlamat } from "./verifikasi"
import { buatNomorTiketUnik, normalisasiNomorTiket } from "../pengaduan/tiket"
import { hitungTargetSla, prioritasAwal, ringkasSla } from "../pengaduan/sla"
import {
  transisiPengaduan,
  catatRiwayat,
  PELAPOR,
  type Pelaku,
} from "../pengaduan/alur"
import { tutupOtomatisBilaKedaluwarsa } from "../pengaduan/otomatis"
import { tandaiWilayah } from "../pengaduan/wilayah"
import { getSessionUserOpsional } from "../../lib/session"

export const publikRouter = new Hono()

const nomorLangganganSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/, "Nomor langganan harus 11 digit angka")

// ============================================================
// LOOKUP PELANGGAN (identitas saja, dipakai kartu pratinjau lapor-meter)
// ============================================================

/// Exact match SATU pelanggan lewat nomorLangganan lengkap (11 digit) — BUKAN
/// pencarian sebagian/prefix (lihat catatan header file). Dipakai frontend
/// untuk kartu "ini pelanggan Anda?" sebelum mengisi form lapor meter, dan
/// bisa dipakai ulang di mana pun butuh pratinjau identitas ringan tanpa
/// data tagihan.
publikRouter.get("/pelanggan/:nomorLangganan", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "lookup-pelanggan",
    maks: 20,
    jendelaMs: 5 * 60 * 1000,
  })

  const parsed = nomorLangganganSchema.safeParse(c.req.param("nomorLangganan"))
  if (!parsed.success)
    throw new BadRequestError("Nomor langganan harus 11 digit angka")

  const pelanggan = await verifikasiPelanggan(parsed.data)

  const periodeBerjalan = dateToPeriode(new Date())
  const laporanBulanIni = await prisma.laporanMandiri.findUnique({
    where: {
      pelangganId_periode: {
        pelangganId: pelanggan.id,
        periode: periodeBerjalan,
      },
    },
    select: {
      status: true,
      alasanDitolak: true,
      // Field TAMBAHAN di bawah (fotoUrl s/d pembacaan) dipakai tab "Cek
      // laporan" di /lapor-meter (lihat laporanBulanIni di respons) — endpoint
      // yang SAMA PERSIS dengan yang menggerbangi tab "Lapor meter" (lookup
      // exact-match nomorLangganan), sengaja TIDAK dipecah jadi endpoint kedua
      // supaya kedua tab berbagi satu kotak cari + satu perilaku, bukan
      // masing-masing menulis ulang sendiri dan lambat laun menyimpang.
      fotoUrl: true,
      standDilaporkan: true,
      createdAt: true,
      verifiedAt: true,
      // Terisi HANYA setelah petugas memverifikasi (status DIGUNAKAN) — lihat
      // PATCH /api/v1/laporan-mandiri/:id/verify di
      // server/modules/laporan/laporan-mandiri.router.ts, yang membuat
      // PembacaanMeter resmi (pemakaianM3 = standAkhir - standLalu) sekaligus
      // menautkannya lewat pembacaanId.
      pembacaan: {
        select: { standLalu: true, standAkhir: true, pemakaianM3: true },
      },
    },
  })

  // Laporan DITOLAK TIDAK mengunci bulan berjalan. Alasan penolakan yang
  // paling sering dipakai petugas adalah "foto salah/tidak terbaca" — dan
  // itu justru permintaan kirim ulang. Kalau baris ditolak tetap dihitung
  // sebagai "sudah lapor", warga membaca alasan penolakannya lalu menemukan
  // tombol kirimnya mati sampai bulan depan. Lihat POST /lapor-meter.
  const ditolak = laporanBulanIni?.status === "DITOLAK"

  return ok(c, {
    nomorLangganan: pelanggan.nomorLangganan,
    nama: pelanggan.nama,
    alamat: samarkanAlamat(pelanggan.alamat),
    rt: pelanggan.rt,
    rw: pelanggan.rw,
    status: pelanggan.status,
    tarifGolongan: pelanggan.tarifGolongan,
    periodeBerjalan,
    sudahLaporBulanIni: !!laporanBulanIni,
    statusLaporanBulanIni: laporanBulanIni?.status ?? null,
    /// Boleh mengirim (atau mengirim ULANG) untuk periode berjalan? Dihitung
    /// di server supaya layar web & mobile tidak masing-masing menebak
    /// status mana yang mengunci — server tetap gerbang terakhirnya.
    bisaKirimUlang: !laporanBulanIni || ditolak,
    /// Hanya diisi saat laporan terakhir ditolak: warga perlu tahu APA yang
    /// harus diperbaiki sebelum memotret ulang.
    alasanDitolak: ditolak ? laporanBulanIni.alasanDitolak : null,
    /// Detail lengkap laporan periode berjalan — null bila belum ada laporan
    /// bulan ini sama sekali. Dipakai tab "Cek laporan"; field di atas
    /// (statusLaporanBulanIni dst.) dipertahankan apa adanya untuk konsumen
    /// lama (tab "Lapor meter" di sini, dan mobile-publik) yang sudah
    /// membaca bentuk datar itu.
    laporanBulanIni: laporanBulanIni
      ? {
          periode: periodeBerjalan,
          status: laporanBulanIni.status,
          fotoUrl: laporanBulanIni.fotoUrl,
          standDilaporkan: laporanBulanIni.standDilaporkan,
          createdAt: laporanBulanIni.createdAt,
          verifiedAt: laporanBulanIni.verifiedAt,
          alasanDitolak: ditolak ? laporanBulanIni.alasanDitolak : null,
          standLalu: laporanBulanIni.pembacaan?.standLalu ?? null,
          standAkhir: laporanBulanIni.pembacaan?.standAkhir ?? null,
          pemakaianM3: laporanBulanIni.pembacaan?.pemakaianM3 ?? null,
        }
      : null,
  })
})

// ============================================================
// CEK TAGIHAN
// ============================================================

const cekTagihanSchema = z.object({
  nomorLangganan: nomorLangganganSchema,
})

/// POST (bukan GET) supaya nomor langganan tidak tercatat di log akses
/// server / riwayat browser / header Referer.
publikRouter.post(
  "/cek-tagihan",
  validate("json", cekTagihanSchema),
  async (c) => {
    // Ketat: ini endpoint yang paling menarik untuk dipanen.
    cekRateLimit(ipKlien(c), {
      nama: "cek-tagihan",
      maks: 10,
      jendelaMs: 5 * 60 * 1000,
    })

    const { nomorLangganan } = c.req.valid("json")
    const pelanggan = await verifikasiPelanggan(nomorLangganan)

    const tagihan = await prisma.tagihan.findMany({
      where: { pelangganId: pelanggan.id },
      orderBy: { periode: "desc" },
      take: 12, // satu tahun terakhir — cukup untuk pelanggan, tidak membuka seluruh riwayat
      select: {
        periode: true,
        pemakaianM3: true,
        jmlHargaAir: true,
        beaBeban: true,
        beaAdmin: true,
        airKotor: true,
        lainLain: true,
        denda: true,
        totalTagihan: true,
        status: true,
        tanggalJatuhTempo: true,
        tanggalBayar: true,
        pembacaan: { select: { standLalu: true, standAkhir: true } },
      },
    })

    return ok(c, {
      pelanggan: {
        nomorLangganan: pelanggan.nomorLangganan,
        nama: pelanggan.nama,
        // Alamat disamarkan — lihat catatan keputusan produk di verifikasi.ts.
        alamat: samarkanAlamat(pelanggan.alamat),
        rt: pelanggan.rt,
        rw: pelanggan.rw,
        status: pelanggan.status,
        tarifGolongan: pelanggan.tarifGolongan,
      },
      // Field internal (id, validatorId, nominalTunggak, catatan, dst.) SENGAJA
      // tidak ikut — hanya yang perlu dilihat pelanggan.
      tagihan: tagihan.map((t) => ({
        periode: dateToPeriode(t.periode),
        pemakaianM3: t.pemakaianM3,
        jmlHargaAir: t.jmlHargaAir,
        beaBeban: t.beaBeban,
        beaAdmin: t.beaAdmin,
        airKotor: t.airKotor,
        lainLain: t.lainLain,
        denda: t.denda,
        totalTagihan: t.totalTagihan,
        status: t.status,
        tanggalJatuhTempo: t.tanggalJatuhTempo,
        tanggalBayar: t.tanggalBayar,
        standLalu: t.pembacaan?.standLalu ?? null,
        standAkhir: t.pembacaan?.standAkhir ?? null,
      })),
      totalTunggakan: tagihan
        .filter((t) => t.status === "BELUM_BAYAR" || t.status === "JATUH_TEMPO")
        .reduce((n, t) => n + t.totalTagihan, 0),
    })
  },
)

// ============================================================
// PENGADUAN
// ============================================================

const pengaduanSchema = z
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
    // handler.
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
    /// tiket kembar akibat retry/tap ganda. Lihat catatan di bawah.
    clientRequestId: z.string().trim().uuid().optional(),
  })
  .refine((d) => d.jenis !== "BOCOR_PIPA_DINAS" || !!d.koordinat, {
    message:
      "Untuk laporan bocor pipa dinas, lokasi wajib diisi agar petugas bisa menemukannya",
    path: ["koordinat"],
  })

/// Menerima DUA bentuk badan permintaan: `multipart/form-data` (form web,
/// karena foto bukti ikut) dan `application/json` (aplikasi Flutter & klien
/// lama, yang tidak melampirkan foto lewat endpoint ini).
///
/// Dipisah ke fungsi sendiri supaya percabangan content-type tidak
/// berceceran di handler. Di multipart, koordinat datang sebagai dua field
/// skalar `lat`/`lng` — objek bersarang tidak punya representasi yang wajar
/// di form-data, dan memaksakannya lewat JSON.parse() di dalam field form
/// hanya menambah satu lagi masukan yang harus dipercaya.
async function bacaBodyPengaduan(
  c: Context,
): Promise<{ data: unknown; foto: File | null; video: File | null }> {
  if (!(c.req.header("content-type") ?? "").includes("multipart/form-data")) {
    return { data: await c.req.json(), foto: null, video: null }
  }

  const form = await c.req.formData()
  const teks = (kunci: string) => {
    const nilai = form.get(kunci)
    return typeof nilai === "string" && nilai.trim() !== "" ? nilai : undefined
  }
  const lat = teks("lat")
  const lng = teks("lng")
  const foto = form.get("foto")
  const video = form.get("video")

  return {
    data: {
      klasifikasi: teks("klasifikasi"),
      jenis: teks("jenis"),
      judul: teks("judul"),
      deskripsi: teks("deskripsi"),
      pelapor: teks("pelapor"),
      kontakPelapor: teks("kontakPelapor"),
      alamatKejadian: teks("alamatKejadian"),
      nomorLangganan: teks("nomorLangganan"),
      clientRequestId: teks("clientRequestId"),
      // Number() atas string non-angka menghasilkan NaN, dan z.number()
      // menolak NaN — jadi koordinat sampah gagal di validator, bukan
      // diam-diam tersimpan sebagai titik di tengah laut.
      koordinat:
        lat !== undefined && lng !== undefined
          ? { lat: Number(lat), lng: Number(lng) }
          : undefined,
    },
    foto: foto instanceof File && foto.size > 0 ? foto : null,
    video: video instanceof File && video.size > 0 ? video : null,
  }
}

publikRouter.post("/pengaduan", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "pengaduan",
    maks: 5,
    jendelaMs: 10 * 60 * 1000,
  })

  // Endpoint ini TETAP tanpa login wajib — tapi kalau pelapor KEBETULAN
  // sedang login (cookie web ATAU Bearer mobile, lihat getSessionUserOpsional
  // di server/lib/session.ts), tiket ini otomatis tertaut ke akunnya lewat
  // olehId di entri linimasa DIBUAT di bawah — itulah SATU-SATUNYA penanda
  // "tiket ini milik siapa", tanpa kolom baru: GET /api/v1/pengaduan/saya
  // membaca balik penanda yang sama. Anonim tetap PELAPOR, sama seperti
  // sebelumnya.
  //
  // WAJIB dipanggil SEBELUM bacaBodyPengaduan(): jalur cookie di
  // getSessionUserOpsional() (@hono/auth-js getAuthUser) mengkloning
  // `c.req.raw` mentah-mentah, termasuk body stream-nya — kalau body sudah
  // dibaca lebih dulu (c.req.json()/formData()), stream itu sudah
  // "disturbed" dan kloning tersebut throw. Sudah diverifikasi lewat curl:
  // dengan urutan terbalik, PENGADUAN ANONIM (satu-satunya jalur yang
  // benar-benar sampai ke fallback cookie) gagal 500 di setiap permintaan.
  const sesi = await getSessionUserOpsional(c)
  const pelaku: Pelaku = sesi
    ? { id: sesi.id, nama: sesi.name ?? sesi.email }
    : PELAPOR

  const { data, foto, video } = await bacaBodyPengaduan(c)
  const { koordinat, nomorLangganan, clientRequestId, ...body } =
    pengaduanSchema.parse(data)

  // IDEMPOTENSI: kalau permintaan dengan clientRequestId ini sudah pernah
  // berhasil, pulangkan tiket yang SAMA — jangan buat kembar. Pre-check ini
  // menutup kasus umum (retry setelah respons hilang di jaringan) SEBELUM
  // foto diunggah ulang; kasus balapan (dua permintaan nyaris bersamaan)
  // ditangani lewat unique constraint di blok catch di bawah.
  if (clientRequestId) {
    const sudahAda = await prisma.pengaduan.findUnique({
      where: { clientRequestId },
      select: { nomorTiket: true, targetSelesaiAt: true },
    })
    if (sudahAda) {
      return created(c, {
        nomorTiket: sudahAda.nomorTiket,
        targetSelesaiAt: sudahAda.targetSelesaiAt,
        pesan: "Pengaduan Anda sudah tercatat sebelumnya. Nomor tiketnya sama.",
      })
    }
  }

  const prioritas = prioritasAwal(body.jenis)
  const sekarang = new Date()
  const target = hitungTargetSla(prioritas, sekarang)

  // Nomor tiket dibangkitkan aplikasi: TW-YYMM-XXXXXX dengan 6 karakter
  // ACAK. Keacakan itu bukan hiasan — ia satu-satunya yang menjaga tiket
  // warga lain tidak terbaca orang di endpoint pelacakan di bawah, yang
  // sengaja tanpa verifikasi identitas. Lihat modules/pengaduan/tiket.ts.
  const buatTiket = () =>
    buatNomorTiketUnik(async (nomorTiket) => {
      // Foto diunggah SEBELUM transaksi: unggahan ke Cloudinary itu panggilan
      // jaringan yang bisa memakan detik, dan menahannya di dalam transaksi
      // DB berarti mengunci baris selama itu. Kalau transaksi kelak gagal,
      // yang tersisa hanya berkas yatim di storage — jauh lebih murah
      // daripada connection pool yang habis.
      let simpan: Awaited<ReturnType<typeof simpanBerkas>> | null = null
      if (foto) {
        try {
          simpan = await simpanBerkas(foto, {
            prefix: "pengaduan",
            namaBerkas: `${nomorTiket}_bukti`,
            subFolder: nomorTiket.slice(3, 7),
          })
        } catch (err) {
          if (err instanceof BerkasTidakValidError)
            throw new BadRequestError(err.message)
          throw err
        }
      }

      // Video bukti (opsional): jalur & batas berbeda dari foto (jenisMedia
      // "video" → 50 MB + validasi magic bytes MP4/WebM di storage.ts). Diunggah
      // di sini, sebelum transaksi, dengan alasan yang sama seperti foto.
      let simpanVideo: Awaited<ReturnType<typeof simpanBerkas>> | null = null
      if (video) {
        try {
          simpanVideo = await simpanBerkas(video, {
            prefix: "pengaduan",
            namaBerkas: `${nomorTiket}_video`,
            subFolder: nomorTiket.slice(3, 7),
            jenisMedia: "video",
          })
        } catch (err) {
          if (err instanceof BerkasTidakValidError)
            throw new BadRequestError(err.message)
          throw err
        }
      }

      return prisma.$transaction(async (tx) => {
        // Auto-tag wilayah kejadian dari koordinat (ST_Contains, lihat
        // modules/pengaduan/wilayah.ts) — kanal publik dan kanal petugas
        // memakai aturan yang sama.
        const wilayah = koordinat
          ? await tandaiWilayah(tx, koordinat.lat, koordinat.lng)
          : null
        // `nomorLangganan` disimpan sebagai TEKS saja, TIDAK ditautkan ke
        // pelangganId, dan TIDAK diverifikasi. Alasannya: memverifikasi di
        // sini akan mengubah endpoint pengaduan menjadi alat pengecek "nomor
        // langganan ini ada/tidak" — persis pemanenan yang dicegah di
        // verifikasi.ts. Petugaslah yang mencocokkannya nanti lewat dashboard.
        const row = await tx.pengaduan.create({
          data: {
            ...body,
            nomorTiket,
            clientRequestId: clientRequestId ?? null,
            nomorLangganan: nomorLangganan ?? null,
            prioritas,
            ...target,
            fotoUrl: simpan?.url ?? null,
            fotoPublicId: simpan?.publicId ?? null,
            videoUrl: simpanVideo?.url ?? null,
            videoPublicId: simpanVideo?.publicId ?? null,
            kelurahanId: wilayah?.kelurahanId ?? null,
            kecamatanId: wilayah?.kecamatanId ?? null,
          },
        })
        if (koordinat)
          await setPoint(
            tx,
            GEO.pengaduan,
            row.id,
            koordinat.lat,
            koordinat.lng,
          )
        await catatRiwayat(tx, {
          pengaduanId: row.id,
          aksi: "DIBUAT",
          oleh: pelaku,
          catatan: "Pengaduan diterima dan masuk antrean penanganan.",
          isPublik: true,
        })
        return row
      })
    })

  let row: Awaited<ReturnType<typeof buatTiket>>
  try {
    row = await buatTiket()
  } catch (err) {
    // Balapan idempotensi: dua permintaan berbeda dengan clientRequestId sama
    // tiba nyaris bersamaan sehingga lolos pre-check di atas; yang kalah kena
    // unique constraint. Bukan error bagi pengguna — pulangkan tiket pemenang.
    // Cek P2002 STRUKTURAL (properti code/meta), bukan instanceof — lihat
    // server/lib/errors.ts soal kelas Prisma yang bisa termuat ganda.
    const kode = (err as { code?: string } | null)?.code
    const bentrok = (err as { meta?: { target?: unknown } } | null)?.meta
      ?.target
    const bentrokClientReq =
      kode === "P2002" &&
      (Array.isArray(bentrok)
        ? bentrok.includes("clientRequestId")
        : bentrok === "clientRequestId")
    if (bentrokClientReq && clientRequestId) {
      const menang = await prisma.pengaduan.findUnique({
        where: { clientRequestId },
        select: { nomorTiket: true, targetSelesaiAt: true },
      })
      if (menang) {
        return created(c, {
          nomorTiket: menang.nomorTiket,
          targetSelesaiAt: menang.targetSelesaiAt,
          pesan:
            "Pengaduan Anda sudah tercatat sebelumnya. Nomor tiketnya sama.",
        })
      }
    }
    throw err
  }

  // HANYA nomor tiket & janji waktu yang dikembalikan — bukan seluruh baris
  // (yang memuat id internal & field lain).
  return created(c, {
    nomorTiket: row.nomorTiket,
    targetSelesaiAt: row.targetSelesaiAt,
    pesan:
      "Pengaduan Anda tercatat. Simpan nomor tiket ini untuk memantau perkembangannya.",
  })
})

// ============================================================
// PELACAKAN TIKET
// ============================================================
//
// ==================== KENAPA TANPA VERIFIKASI ====================
// `nomorTiket` berperan sebagai KUNCI PEMBAWA (bearer): siapa pun yang
// memegangnya boleh melihat — dan menutup/membuka kembali — tiket itu. Itu
// aman HANYA karena 6 karakter terakhirnya acak (32^6 ≈ 1,07 miliar
// kemungkinan per bulan), bukan nomor urut. Rate limit di bawah adalah
// lapisan kedua, bukan yang utama.
//
// KONSEKUENSINYA: kalau format nomor tiket suatu saat dibuat berurutan,
// SELURUH blok ini harus dikasih faktor kedua lebih dulu (mis. nomor HP
// pelapor, dengan pesan gagal SERAGAM agar tidak jadi orakel "tiket ini
// ada/tidak"). Jangan ubah formatnya tanpa mengubah ini.

/// Cari tiket dari nomor yang diketik warga, atau lempar 404.
///
/// Pesannya sengaja SAMA untuk "tidak ada" dan "salah ketik" — tidak ada
/// yang perlu dibedakan di sini, dan membedakannya hanya memberi penebak
/// umpan balik gratis.
async function cariTiket<T extends Prisma.PengaduanSelect>(
  nomorInput: string,
  select: T,
) {
  const nomorTiket = normalisasiNomorTiket(nomorInput)
  const row = await prisma.pengaduan.findUnique({
    where: { nomorTiket },
    select,
  })
  if (!row) throw new NotFoundError("Tiket pengaduan")
  return row
}

publikRouter.get("/pengaduan/:nomorTiket", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "lacak-tiket",
    maks: 30,
    jendelaMs: 5 * 60 * 1000,
  })

  const SELECT_LACAK = {
    id: true,
    nomorTiket: true,
    jenis: true,
    judul: true,
    deskripsi: true,
    alamatKejadian: true,
    status: true,
    prioritas: true,
    fotoUrl: true,
    videoUrl: true,
    createdAt: true,
    ditanganiMulai: true,
    selesaiAt: true,
    catatanPenyelesaian: true,
    /// Bukti hasil pekerjaan + batas konfirmasi — pelapor berhak melihat
    /// bukti dan tahu sampai kapan ia bisa menanggapi sebelum auto-close.
    fotoPenyelesaianUrl: true,
    konfirmasiBatasAt: true,
    targetResponsAt: true,
    targetSelesaiAt: true,
    responsAt: true,
    jedaMulaiAt: true,
    ratingKepuasan: true,
    komentarKepuasan: true,
    jumlahDibukaKembali: true,
    // NAMA petugas saja. Email/kontak/id-nya TIDAK — warga berhak tahu siapa
    // yang menangani laporannya, tapi itu bukan alasan membocorkan kontak
    // pribadi pegawai ke internet; komunikasi tetap lewat kanal resmi.
    ditugaskanKe: { select: { name: true } },
    riwayat: {
      // HANYA entri yang sadar ditandai publik. Catatan koordinasi internal
      // ("tunggu approval manager", "pelapor sulit dihubungi") tidak pernah
      // ikut. Difilter di QUERY, bukan disaring setelahnya di JS — data
      // internal tidak boleh sempat ikut terbawa keluar dari database.
      where: { isPublik: true },
      orderBy: { createdAt: "asc" },
      select: {
        aksi: true,
        statusKe: true,
        catatan: true,
        olehNama: true,
        fotoUrl: true,
        createdAt: true,
      },
    },
  } satisfies Prisma.PengaduanSelect

  let row = await cariTiket(c.req.param("nomorTiket"), SELECT_LACAK)

  // Auto-close MALAS: tiket SELESAI yang lewat batas konfirmasi ditutup di
  // sini juga (bukan hanya oleh sweep /tutup-otomatis) — pembaca selalu
  // melihat status yang jujur meski tidak ada cron yang berjalan.
  if (await tutupOtomatisBilaKedaluwarsa(row)) {
    row = await cariTiket(c.req.param("nomorTiket"), SELECT_LACAK)
  }

  // `id` internal sengaja TIDAK ikut ke client — pemegang tiket tidak butuh
  // kunci primer kami, dan membocorkannya cuma memperluas permukaan.
  const { id, ...publik } = row
  void id

  return ok(c, {
    ...publik,
    sla: ringkasSla(row),
    /// Supaya UI tahu tombol mana yang layak ditampilkan tanpa perlu
    /// menyalin aturan alur ke sisi client (yang pasti akan menyimpang).
    bisaDinilai: row.status === "SELESAI" && row.ratingKepuasan === null,
    bisaDibukaKembali: row.status === "SELESAI",
    /// Chat dibuka selama tiket belum DITUTUP.
    bisaChat: row.status !== "DITUTUP",
  })
})

const konfirmasiSchema = z.object({
  rating: z.number().int().min(1, "Beri nilai 1-5").max(5, "Beri nilai 1-5"),
  komentar: z.string().trim().max(1000).optional(),
})

/// Pelapor mengonfirmasi masalahnya memang beres + menilai penanganan.
/// SELESAI -> DITUTUP.
///
/// Menutup tiket sengaja jadi HAK PELAPOR, bukan petugas (lihat penolakan
/// eksplisit di pengaduan.router.ts): kalau petugas boleh menutup sendiri,
/// angka kepuasan menjadi karangan dan tiket yang "beres" menurut kita tapi
/// tidak menurut warga tidak punya tempat untuk pulang.
publikRouter.post(
  "/pengaduan/:nomorTiket/konfirmasi",
  validate("json", konfirmasiSchema),
  async (c) => {
    cekRateLimit(ipKlien(c), {
      nama: "konfirmasi-tiket",
      maks: 10,
      jendelaMs: 10 * 60 * 1000,
    })

    const { rating, komentar } = c.req.valid("json")
    const tiket = await cariTiket(c.req.param("nomorTiket"), {
      id: true,
      status: true,
      ratingKepuasan: true,
      konfirmasiBatasAt: true,
    })

    // Konfirmasi yang datang SETELAH batas waktu: tutup dulu secara jujur,
    // lalu tolak dengan pesan yang menjelaskan kenapa — bukan diam-diam
    // menerima konfirmasi untuk tiket yang seharusnya sudah tertutup.
    if (await tutupOtomatisBilaKedaluwarsa(tiket)) {
      throw new BadRequestError(
        "Batas waktu konfirmasi sudah terlewati — tiket telah ditutup otomatis. Bila masalahnya masih ada, silakan buat pengaduan baru.",
      )
    }

    if (tiket.status !== "SELESAI") {
      throw new BadRequestError(
        "Tiket ini belum dinyatakan selesai oleh petugas, jadi belum bisa dikonfirmasi.",
      )
    }
    if (tiket.ratingKepuasan !== null) {
      throw new BadRequestError("Tiket ini sudah pernah Anda nilai.")
    }

    await prisma.$transaction(async (tx) => {
      await transisiPengaduan(tx, {
        pengaduanId: tiket.id,
        ke: "DITUTUP",
        aksi: "DIKONFIRMASI",
        oleh: PELAPOR,
        catatan: "Pelapor mengonfirmasi penanganan selesai. Tiket ditutup.",
        isPublik: true,
      })
      await tx.pengaduan.update({
        where: { id: tiket.id },
        data: {
          ratingKepuasan: rating,
          komentarKepuasan: komentar ?? null,
          ratingAt: new Date(),
        },
      })
      await catatRiwayat(tx, {
        pengaduanId: tiket.id,
        aksi: "DINILAI",
        oleh: PELAPOR,
        catatan: `Penilaian pelapor: ${rating}/5${komentar ? ` — "${komentar}"` : ""}`,
        isPublik: true,
      })
    })

    return ok(c, {
      pesan: "Terima kasih. Penilaian Anda tercatat dan tiket ditutup.",
    })
  },
)

const bukaKembaliSchema = z.object({
  alasan: z
    .string()
    .trim()
    .min(10, "Ceritakan apa yang masih bermasalah (minimal 10 karakter)")
    .max(1000),
})

/// Pelapor menyatakan masalahnya BELUM beres. SELESAI -> DIBUKA_KEMBALI,
/// dengan tenggat SLA baru dihitung dari sekarang (lihat alur.ts).
///
/// Inilah yang membuat pembedaan SELESAI/DITUTUP ada gunanya: tanpa jalur
/// ini, satu-satunya cara warga membantah adalah membuat tiket baru — dan
/// riwayat penanganan yang buruk jadi terputus, tak terlihat siapa pun.
publikRouter.post(
  "/pengaduan/:nomorTiket/buka-kembali",
  validate("json", bukaKembaliSchema),
  async (c) => {
    cekRateLimit(ipKlien(c), {
      nama: "buka-tiket",
      maks: 5,
      jendelaMs: 10 * 60 * 1000,
    })

    const { alasan } = c.req.valid("json")
    const tiket = await cariTiket(c.req.param("nomorTiket"), {
      id: true,
      status: true,
      konfirmasiBatasAt: true,
    })

    if (await tutupOtomatisBilaKedaluwarsa(tiket)) {
      throw new BadRequestError(
        "Batas waktu tanggapan sudah terlewati — tiket telah ditutup otomatis. Bila masalahnya masih ada, silakan buat pengaduan baru.",
      )
    }

    if (tiket.status !== "SELESAI") {
      throw new BadRequestError(
        tiket.status === "DITUTUP"
          ? "Tiket ini sudah ditutup. Bila masalahnya kembali muncul, silakan buat pengaduan baru."
          : "Tiket ini masih dalam penanganan — belum ada yang perlu dibuka kembali.",
      )
    }

    await prisma.$transaction((tx) =>
      transisiPengaduan(tx, {
        pengaduanId: tiket.id,
        ke: "DIBUKA_KEMBALI",
        aksi: "DIBUKA_KEMBALI",
        oleh: PELAPOR,
        catatan: `Pelapor menyatakan masalah belum selesai: ${alasan}`,
        isPublik: true,
      }),
    )

    return ok(c, {
      pesan: "Tiket Anda dibuka kembali dan akan ditinjau ulang petugas.",
    })
  },
)

const chatPelaporSchema = z.object({
  pesan: z.string().trim().min(1, "Pesan tidak boleh kosong").max(2000),
})

/// Pesan CHAT dari PELAPOR pada thread tiketnya — pasangan dari
/// POST /api/v1/pengaduan/:id/chat (sisi petugas). Pemegang nomor tiket =
/// pemegang hak chat (kunci pembawa, lihat catatan blok pelacakan di atas).
/// Balasannya terbaca lewat GET /pengaduan/:nomorTiket (entri riwayat
/// aksi CHAT, isPublik).
publikRouter.post("/pengaduan/:nomorTiket/chat", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "chat-tiket",
    maks: 20,
    jendelaMs: 10 * 60 * 1000,
  })

  // WAJIB sebelum membaca body — lihat catatan urutan getSessionUserOpsional
  // di POST /pengaduan (body stream tidak boleh sudah dikonsumsi).
  const sesi = await getSessionUserOpsional(c)
  const pelaku: Pelaku = sesi
    ? { id: sesi.id, nama: sesi.name ?? sesi.email }
    : PELAPOR

  const { pesan } = chatPelaporSchema.parse(await c.req.json())

  const tiket = await cariTiket(c.req.param("nomorTiket"), {
    id: true,
    status: true,
    konfirmasiBatasAt: true,
  })
  if (await tutupOtomatisBilaKedaluwarsa(tiket)) {
    throw new BadRequestError(
      "Tiket sudah ditutup otomatis — percakapan tidak bisa dilanjutkan.",
    )
  }
  if (tiket.status === "DITUTUP") {
    throw new BadRequestError(
      "Tiket sudah ditutup — percakapan tidak bisa dilanjutkan.",
    )
  }

  const row = await prisma.$transaction((tx) =>
    catatRiwayat(tx, {
      pengaduanId: tiket.id,
      aksi: "CHAT",
      oleh: pelaku,
      catatan: pesan,
      isPublik: true,
    }),
  )
  return created(c, {
    aksi: row.aksi,
    catatan: row.catatan,
    olehNama: row.olehNama,
    createdAt: row.createdAt,
  })
})

// ============================================================
// LAPOR METER MANDIRI
// ============================================================

/// Jendela waktu pelaporan, supaya layar warga bisa menampilkan pemberitahuan
/// tanpa menebak-nebak dari jam perangkatnya sendiri. Sengaja TANPA rate
/// limit dan tanpa autentikasi: ini hanya membaca kalender.
publikRouter.get("/lapor-meter/jendela", (c) => ok(c, jendelaLaporMandiri()))

/// multipart/form-data (bukan JSON) karena membawa berkas foto.
publikRouter.post("/lapor-meter", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "lapor-meter",
    maks: 5,
    jendelaMs: 10 * 60 * 1000,
  })

  // DIPERIKSA PALING AWAL — sebelum form diurai, sebelum foto disentuh.
  // Menolak setelah mengunggah foto berarti menghabiskan kuota penyimpanan
  // dan kuota bandwidth warga untuk berkas yang pasti dibuang.
  const jendela = jendelaLaporMandiri()
  if (!jendela.boleh) throw new BadRequestError(jendela.pesan)

  const form = await c.req.formData()
  const parsed = z
    .object({
      nomorLangganan: nomorLangganganSchema,
      standDilaporkan: z.coerce
        .number()
        .int()
        .min(0, "Angka meter tidak valid")
        .max(9_999_999),
      nomorPelapor: z.string().trim().min(5, "Nomor HP wajib diisi").max(30),
      namaPelapor: z
        .string()
        .trim()
        .min(2, "Nama pelapor wajib diisi")
        .max(150),
    })
    .parse({
      nomorLangganan: form.get("nomorLangganan"),
      standDilaporkan: form.get("standDilaporkan"),
      nomorPelapor: form.get("nomorPelapor"),
      namaPelapor: form.get("namaPelapor"),
    })

  const pelanggan = await verifikasiPelanggan(parsed.nomorLangganan)

  const foto = form.get("foto")
  if (!(foto instanceof File))
    throw new BadRequestError("Foto meter wajib dilampirkan sebagai bukti.")

  // Periode = bulan berjalan. TIDAK diterima dari client: kalau bisa dipilih
  // sendiri, orang bisa menimpa/mengisi periode lampau yang sudah ditagih.
  const sekarang = new Date()
  const periode = dateToPeriode(
    new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), 1)),
  )

  // Dicek DULU sebelum foto diunggah — percuma menulis berkas kalau barisnya
  // pasti ditolak unique constraint.
  const sudahAda = await prisma.laporanMandiri.findUnique({
    where: { pelangganId_periode: { pelangganId: pelanggan.id, periode } },
  })

  // "Satu laporan per bulan" berlaku untuk laporan yang MASIH HIDUP:
  // MENUNGGU (sedang diverifikasi) dan DIVERIFIKASI/DIGUNAKAN (sudah jadi
  // angka resmi). Laporan DITOLAK bukan salah satunya — penolakan justru
  // biasanya berbunyi "foto tidak terbaca, kirim ulang", dan mengunci warga
  // sampai bulan depan membuat perintah itu mustahil dijalankan sekaligus
  // menghapus satu-satunya kesempatan mereka punya angka meter bulan ini.
  if (sudahAda && sudahAda.status !== "DITOLAK") {
    throw new BadRequestError(
      `Anda sudah mengirim laporan meter untuk periode ${periode}. Satu laporan per bulan. Status laporan Anda: ${sudahAda.status}.`,
    )
  }

  let simpan
  try {
    // Nama & folder deterministik ("202607_stand_00401700010" di dalam
    // folder Cloudinary "laporan-mandiri/202607") — bukan UUID acak — supaya
    // foto tersusun rapi per periode dan gampang ditelusuri manual di
    // Cloudinary Console, bukan hanya lewat fotoUrl di database.
    simpan = await simpanBerkas(foto, {
      prefix: "laporan-mandiri",
      namaBerkas: `${periode}_stand_${pelanggan.nomorLangganan}`,
      subFolder: String(periode),
    })
  } catch (err) {
    if (err instanceof BerkasTidakValidError)
      throw new BadRequestError(err.message)
    throw err
  }

  const isi = {
    standDilaporkan: parsed.standDilaporkan,
    fotoUrl: simpan.url,
    fotoPublicId: simpan.publicId,
    nomorPelapor: parsed.nomorPelapor,
    namaPelapor: parsed.namaPelapor,
    // status MENUNGGU — laporan TIDAK langsung jadi angka resmi. Petugas
    // memverifikasinya lewat PATCH /api/v1/laporan-mandiri/:id/verify sebelum
    // menjadi PembacaanMeter. Ini yang membuat laporan palsu dari publik
    // tidak bisa langsung mengubah tagihan siapa pun.
    status: "MENUNGGU" as const,
  }
  const pilih = {
    periode: true,
    standDilaporkan: true,
    status: true,
    createdAt: true,
  }

  // KIRIM ULANG MENIMPA BARIS YANG DITOLAK, bukan menambah baris kedua — dan
  // itu bukan sekadar cara menghindari @@unique([pelangganId, periode]).
  // Nama berkas di storage deterministik (`${periode}_stand_${nomorLangganan}`
  // dengan overwrite), jadi foto lama SUDAH tergantikan oleh yang baru.
  // Baris kedua hanya akan menunjuk foto yang sama persis: dua laporan
  // berbeda angka dengan satu foto, dan yang lama memamerkan bukti yang bukan
  // miliknya. Jejak penolakan sengaja dibersihkan (alasan & verifikator
  // dinolkan) supaya panel verifikasi tidak menampilkan alasan penolakan
  // lama di samping foto baru yang belum diperiksa siapa pun.
  //
  // createdAt DISEGARKAN — satu-satunya kolom yang "berbohong" kalau
  // dibiarkan. Antrean verifikasi diurutkan createdAt desc dan disaring
  // "kiriman warga hari ini" lewat createdAt: laporan yang dikirim ulang hari
  // ini tapi masih bertanggal dua pekan lalu akan terkubur di dasar antrean
  // dan tidak muncul di saringan hari ini — persis nasib yang sedang kita
  // perbaiki. Setelah ditimpa, baris ini MEMANG kiriman hari ini.
  const row = sudahAda
    ? await prisma.laporanMandiri.update({
        where: { id: sudahAda.id },
        data: {
          ...isi,
          alasanDitolak: null,
          verifiedAt: null,
          verifiedById: null,
          createdAt: new Date(),
        },
        select: pilih,
      })
    : await prisma.laporanMandiri.create({
        data: {
          ...isi,
          pelangganId: pelanggan.id,
          nomorLangganan: pelanggan.nomorLangganan,
          periode,
        },
        select: pilih,
      })

  return created(c, {
    ...row,
    pesan: sudahAda
      ? "Laporan perbaikan Anda terkirim menggantikan laporan yang ditolak, dan sedang menunggu verifikasi petugas."
      : "Laporan meter Anda terkirim dan sedang menunggu verifikasi petugas.",
  })
})

export const MAKS_FOTO_BYTE = MAKS_UKURAN_BYTE
export { periodeToDate }
