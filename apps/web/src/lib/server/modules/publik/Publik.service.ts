// server/modules/publik/Publik.service.ts — logika bisnis endpoint warga/
// pelanggan TANPA login: lookup pratinjau pelanggan, cek tagihan, pengaduan
// publik, pelacakan tiket, dan lapor meter mandiri.
import type { Prisma } from "@db"
import { prisma } from "@db"
import { NotFoundError, BadRequestError } from "../../lib/Galat"
import { simpanBerkas, BerkasTidakValidError } from "../../lib/Penyimpanan"
import { GEO, setPoint, getPointGeoJsonMany } from "../../lib/Spatial"
import { dateToPeriode } from "../../lib/Periode"
import type { SessionUser } from "../../lib/Sesi"
import { verifikasiPelanggan, samarkanAlamat } from "./Verifikasi"
import { buatNomorTiketUnik, normalisasiNomorTiket } from "../pengaduan/Tiket"
import { hitungTargetSla, prioritasAwal, ringkasSla } from "@/lib/domain/SLA"
import { STATUS_TERBUKA } from "@/lib/domain/AlurPengaduan"
import {
  transisiPengaduan,
  catatRiwayat,
  PELAPOR,
  type Pelaku,
} from "../pengaduan/Alur"
import { tutupOtomatisBilaKedaluwarsa } from "../pengaduan/Otomatis"
import { tandaiWilayah } from "../pengaduan/Wilayah"
import {
  dapatkanJendelaLaporMandiri,
  daftarPeriodeUjiLaporMandiri,
  pastikanPeriodeUjiLaporMandiri,
  pastikanLaporanMandiriBolehDikirim,
  pastikanSambunganTertautKeAkun,
  simpanKirimanLaporanMandiri,
} from "../laporan/mandiri/LaporanMandiri.service"
import type {
  CekTagihanInput,
  PengaduanPublikInput,
  KonfirmasiTiketInput,
  BukaKembaliTiketInput,
  ChatPelaporInput,
  LaporMeterInput,
} from "./Publik.schema"

// ============================================================
// LOOKUP PELANGGAN (identitas saja, dipakai kartu pratinjau lapor-meter)
// ============================================================

/// Exact match SATU pelanggan lewat nomorLangganan lengkap (11 digit) — BUKAN
/// pencarian sebagian/prefix (lihat catatan header Publik.router.ts). Dipakai
/// frontend untuk kartu "ini pelanggan Anda?" sebelum mengisi form lapor meter,
/// dan bisa dipakai ulang di mana pun butuh pratinjau identitas ringan tanpa
/// data tagihan.
export async function lookupPelangganPublik(
  nomorLangganan: string,
  periodeUji?: string
) {
  const pelanggan = await verifikasiPelanggan(nomorLangganan)

  const periodeBerjalan = periodeUji
    ? await pastikanPeriodeUjiLaporMandiri(periodeUji)
    : (await dapatkanJendelaLaporMandiri()).periode
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
      // server/modules/laporan/LaporanMandiri.router.ts, yang membuat
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

  return {
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
  }
}

// ============================================================
// CEK TAGIHAN
// ============================================================

export async function cekTagihanPublik(input: CekTagihanInput) {
  const { nomorLangganan } = input
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

  return {
    pelanggan: {
      nomorLangganan: pelanggan.nomorLangganan,
      nama: pelanggan.nama,
      // Alamat disamarkan — lihat catatan keputusan produk di Verifikasi.ts.
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
  }
}

// ============================================================
// PENGADUAN
// ============================================================

export async function buatPengaduanPublik(
  input: PengaduanPublikInput,
  berkas: { foto: File | null; video: File | null },
  sesi: SessionUser | null
) {
  // Endpoint ini TETAP tanpa login wajib — tapi kalau pelapor KEBETULAN
  // sedang login (cookie web ATAU Bearer mobile, lihat getSessionUserOpsional
  // di server/lib/Sesi.ts), tiket ini otomatis tertaut ke akunnya lewat
  // olehId di entri linimasa DIBUAT di bawah — itulah SATU-SATUNYA penanda
  // "tiket ini milik siapa", tanpa kolom baru: GET /api/v1/pengaduan/saya
  // membaca balik penanda yang sama. Anonim tetap PELAPOR, sama seperti
  // sebelumnya.
  const pelaku: Pelaku = sesi
    ? { id: sesi.id, nama: sesi.name ?? sesi.email }
    : PELAPOR

  const { foto, video } = berkas
  const { koordinat, nomorLangganan, clientRequestId, ...body } = input

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
      return {
        nomorTiket: sudahAda.nomorTiket,
        targetSelesaiAt: sudahAda.targetSelesaiAt,
        pesan: "Pengaduan Anda sudah tercatat sebelumnya. Nomor tiketnya sama.",
      }
    }
  }

  // PENCEGAHAN TIKET GANDA: jika pelanggan sudah memiliki aduan aktif untuk jenis yang sama,
  // pulangkan tiket aktif tersebut agar tidak terjadi duplikasi pengerjaan di lapangan.
  if (nomorLangganan) {
    const tiketAktif = await prisma.pengaduan.findFirst({
      where: {
        nomorLangganan,
        jenis: body.jenis,
        status: { in: [...STATUS_TERBUKA] },
      },
      select: { nomorTiket: true, targetSelesaiAt: true, status: true },
      orderBy: { createdAt: "desc" },
    })
    if (tiketAktif) {
      return {
        nomorTiket: tiketAktif.nomorTiket,
        targetSelesaiAt: tiketAktif.targetSelesaiAt,
        pesan: `Pengaduan aktif untuk jenis ${body.jenis} dengan nomor langganan ini sudah tercatat (Tiket: ${tiketAktif.nomorTiket}, Status: ${tiketAktif.status}). Petugas kami sedang menindaklanjuti.`,
      }
    }
  }

  const prioritas = prioritasAwal(body.jenis)
  const sekarang = new Date()
  const target = hitungTargetSla(prioritas, sekarang)

  // Nomor tiket dibangkitkan aplikasi: TW-YYMM-XXXXXX dengan 6 karakter
  // ACAK. Keacakan itu bukan hiasan — ia satu-satunya yang menjaga tiket
  // warga lain tidak terbaca orang di endpoint pelacakan di bawah, yang
  // sengaja tanpa verifikasi identitas. Lihat modules/pengaduan/Tiket.ts.
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
      // "video" → 50 MB + validasi magic bytes MP4/WebM di Penyimpanan.ts). Diunggah
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
        // modules/pengaduan/Wilayah.ts) — kanal publik dan kanal petugas
        // memakai aturan yang sama.
        const wilayah = koordinat
          ? await tandaiWilayah(tx, koordinat.lat, koordinat.lng)
          : null
        // `nomorLangganan` disimpan sebagai TEKS saja, TIDAK ditautkan ke
        // pelangganId, dan TIDAK diverifikasi. Alasannya: memverifikasi di
        // sini akan mengubah endpoint pengaduan menjadi alat pengecek "nomor
        // langganan ini ada/tidak" — persis pemanenan yang dicegah di
        // Verifikasi.ts. Petugaslah yang mencocokkannya nanti lewat dashboard.
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
            koordinat.lng
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
    // server/lib/Galat.ts soal kelas Prisma yang bisa termuat ganda.
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
        return {
          nomorTiket: menang.nomorTiket,
          targetSelesaiAt: menang.targetSelesaiAt,
          pesan:
            "Pengaduan Anda sudah tercatat sebelumnya. Nomor tiketnya sama.",
        }
      }
    }
    throw err
  }

  // HANYA nomor tiket & janji waktu yang dikembalikan — bukan seluruh baris
  // (yang memuat id internal & field lain).
  return {
    nomorTiket: row.nomorTiket,
    targetSelesaiAt: row.targetSelesaiAt,
    pesan:
      "Pengaduan Anda tercatat. Simpan nomor tiket ini untuk memantau perkembangannya.",
  }
}

// ============================================================
// PELACAKAN TIKET
// ============================================================
//
// ==================== KENAPA TANPA VERIFIKASI ====================
// `nomorTiket` berperan sebagai KUNCI PEMBAWA (bearer): siapa pun yang
// memegangnya boleh melihat — dan menutup/membuka kembali — tiket itu. Itu
// aman HANYA karena 6 karakter terakhirnya acak (32^6 ≈ 1,07 miliar
// kemungkinan per bulan), bukan nomor urut. Rate limit di router adalah
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
  select: T
) {
  const nomorTiket = normalisasiNomorTiket(nomorInput)
  const row = await prisma.pengaduan.findUnique({
    where: { nomorTiket },
    select,
  })
  if (!row) throw new NotFoundError("Tiket pengaduan")
  return row
}

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

export async function lacakTiketPublik(nomorTiketInput: string) {
  let row = await cariTiket(nomorTiketInput, SELECT_LACAK)

  // Auto-close MALAS: tiket SELESAI yang lewat batas konfirmasi ditutup di
  // sini juga (bukan hanya oleh sweep /tutup-otomatis) — pembaca selalu
  // melihat status yang jujur meski tidak ada cron yang berjalan.
  if (await tutupOtomatisBilaKedaluwarsa(row)) {
    row = await cariTiket(nomorTiketInput, SELECT_LACAK)
  }

  // `id` internal sengaja TIDAK ikut ke client — pemegang tiket tidak butuh
  // kunci primer kami, dan membocorkannya cuma memperluas permukaan.
  const { id, ...publik } = row
  void id

  return {
    ...publik,
    sla: ringkasSla(row),
    /// Supaya UI tahu tombol mana yang layak ditampilkan tanpa perlu
    /// menyalin aturan alur ke sisi client (yang pasti akan menyimpang).
    bisaDinilai: row.status === "SELESAI" && row.ratingKepuasan === null,
    bisaDibukaKembali: row.status === "SELESAI",
    /// Chat dibuka selama tiket belum DITUTUP.
    bisaChat: row.status !== "DITUTUP",
  }
}

/// Pelapor mengonfirmasi masalahnya memang beres + menilai penanganan.
/// SELESAI -> DITUTUP.
///
/// Menutup tiket sengaja jadi HAK PELAPOR, bukan petugas (lihat penolakan
/// eksplisit di Pengaduan.service.ts): kalau petugas boleh menutup sendiri,
/// angka kepuasan menjadi karangan dan tiket yang "beres" menurut kita tapi
/// tidak menurut warga tidak punya tempat untuk pulang.
export async function konfirmasiTiketPublik(
  nomorTiketInput: string,
  input: KonfirmasiTiketInput
) {
  const { rating, komentar } = input
  const tiket = await cariTiket(nomorTiketInput, {
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
      "Batas waktu konfirmasi sudah terlewati — tiket telah ditutup otomatis. Bila masalahnya masih ada, silakan buat pengaduan baru."
    )
  }

  if (tiket.status !== "SELESAI") {
    throw new BadRequestError(
      "Tiket ini belum dinyatakan selesai oleh petugas, jadi belum bisa dikonfirmasi."
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

  return {
    pesan: "Terima kasih. Penilaian Anda tercatat dan tiket ditutup.",
  }
}

/// Pelapor menyatakan masalahnya BELUM beres. SELESAI -> DIBUKA_KEMBALI,
/// dengan tenggat SLA baru dihitung dari sekarang (lihat Alur.ts).
///
/// Inilah yang membuat pembedaan SELESAI/DITUTUP ada gunanya: tanpa jalur
/// ini, satu-satunya cara warga membantah adalah membuat tiket baru — dan
/// riwayat penanganan yang buruk jadi terputus, tak terlihat siapa pun.
export async function bukaKembaliTiketPublik(
  nomorTiketInput: string,
  input: BukaKembaliTiketInput
) {
  const { alasan } = input
  const tiket = await cariTiket(nomorTiketInput, {
    id: true,
    status: true,
    konfirmasiBatasAt: true,
  })

  if (await tutupOtomatisBilaKedaluwarsa(tiket)) {
    throw new BadRequestError(
      "Batas waktu tanggapan sudah terlewati — tiket telah ditutup otomatis. Bila masalahnya masih ada, silakan buat pengaduan baru."
    )
  }

  if (tiket.status !== "SELESAI") {
    throw new BadRequestError(
      tiket.status === "DITUTUP"
        ? "Tiket ini sudah ditutup. Bila masalahnya kembali muncul, silakan buat pengaduan baru."
        : "Tiket ini masih dalam penanganan — belum ada yang perlu dibuka kembali."
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
    })
  )

  return {
    pesan: "Tiket Anda dibuka kembali dan akan ditinjau ulang petugas.",
  }
}

/// Pesan CHAT dari PELAPOR pada thread tiketnya — pasangan dari
/// POST /api/v1/pengaduan/:id/chat (sisi petugas). Pemegang nomor tiket =
/// pemegang hak chat (kunci pembawa, lihat catatan blok pelacakan di atas).
/// Balasannya terbaca lewat GET /pengaduan/:nomorTiket (entri riwayat
/// aksi CHAT, isPublik).
export async function kirimChatPelaporPublik(
  nomorTiketInput: string,
  input: ChatPelaporInput,
  sesi: SessionUser | null
) {
  const pelaku: Pelaku = sesi
    ? { id: sesi.id, nama: sesi.name ?? sesi.email }
    : PELAPOR
  const { pesan } = input

  const tiket = await cariTiket(nomorTiketInput, {
    id: true,
    status: true,
    konfirmasiBatasAt: true,
  })
  if (await tutupOtomatisBilaKedaluwarsa(tiket)) {
    throw new BadRequestError(
      "Tiket sudah ditutup otomatis — percakapan tidak bisa dilanjutkan."
    )
  }
  if (tiket.status === "DITUTUP") {
    throw new BadRequestError(
      "Tiket sudah ditutup — percakapan tidak bisa dilanjutkan."
    )
  }

  const row = await prisma.$transaction((tx) =>
    catatRiwayat(tx, {
      pengaduanId: tiket.id,
      aksi: "CHAT",
      oleh: pelaku,
      catatan: pesan,
      isPublik: true,
    })
  )
  return {
    aksi: row.aksi,
    catatan: row.catatan,
    olehNama: row.olehNama,
    createdAt: row.createdAt,
  }
}

// ============================================================
// LAPOR METER MANDIRI
// ============================================================

/// Jendela waktu pelaporan dari konfigurasi server, bukan jam/perkiraan client.
export async function ambilJendelaLaporMeterPublik() {
  return dapatkanJendelaLaporMandiri()
}

export async function ambilPeriodeUjiLaporMeterPublik() {
  return {
    aktif: process.env.NODE_ENV !== "production",
    periodes:
      process.env.NODE_ENV === "production"
        ? []
        : await daftarPeriodeUjiLaporMandiri(),
  }
}

export async function kirimLaporMeterPublik(
  input: LaporMeterInput,
  foto: File | null,
  sesi: SessionUser | null
) {
  // Endpoint ini memang jalur publik/tamu. Sesi warga tetap mendapat
  // pemeriksaan kepemilikan sambungan; sesi role lain tidak boleh menghalangi
  // penggunaan formulir publik dan diperlakukan seperti kiriman anonim.
  const sesiWarga = sesi?.role === "USER" ? sesi : null

  let periode: number
  if (input.periodeUji) {
    periode = await pastikanPeriodeUjiLaporMandiri(input.periodeUji)
  } else {
    const jendela = await dapatkanJendelaLaporMandiri()
    if (!jendela.boleh) throw new BadRequestError(jendela.pesan)
    periode = jendela.periode
  }

  const pelanggan = await verifikasiPelanggan(input.nomorLangganan)
  if (sesiWarga) {
    await pastikanSambunganTertautKeAkun(sesiWarga.id, pelanggan.id)
  }

  if (!foto)
    throw new BadRequestError("Foto meter wajib dilampirkan sebagai bukti.")

  // Dicek DULU sebelum foto diunggah — percuma menulis berkas kalau barisnya
  // pasti ditolak unique constraint.
  const kirimUlang = await pastikanLaporanMandiriBolehDikirim(
    pelanggan.id,
    periode
  )

  let simpan
  try {
    // ID unik mencegah retry sesudah penolakan menimpa bukti kiriman terdahulu.
    simpan = await simpanBerkas(foto, {
      prefix: "laporan-mandiri",
      namaBerkas: `${periode}_stand_${pelanggan.nomorLangganan}_${crypto.randomUUID()}`,
      subFolder: String(periode),
    })
  } catch (err) {
    if (err instanceof BerkasTidakValidError)
      throw new BadRequestError(err.message)
    throw err
  }

  const row = await simpanKirimanLaporanMandiri({
    pelangganId: pelanggan.id,
    nomorLangganan: pelanggan.nomorLangganan,
    periode,
    standDilaporkan: input.standDilaporkan,
    fotoUrl: simpan.url,
    fotoPublicId: simpan.publicId,
    nomorPelapor: input.nomorPelapor,
    namaPelapor: input.namaPelapor,
    pengirimId: sesiWarga?.id ?? null,
  })

  return {
    periode: row.periode,
    standDilaporkan: row.standDilaporkan,
    status: row.status,
    createdAt: row.createdAt,
    pesan: kirimUlang
      ? "Laporan perbaikan Anda terkirim. Bukti kiriman sebelumnya tetap tersimpan; kiriman baru menunggu verifikasi petugas."
      : "Laporan meter Anda terkirim dan sedang menunggu verifikasi petugas.",
  }
}

// ============================================================
// PETA SPASIAL PENGADUAN PUBLIK
// ============================================================

export async function ambilPengaduanPetaPublik() {
  const rows = await prisma.pengaduan.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      nomorTiket: true,
      jenis: true,
      judul: true,
      deskripsi: true,
      status: true,
      prioritas: true,
      alamatKejadian: true,
      fotoUrl: true,
      pelapor: true,
      kontakPelapor: true,
      targetSelesaiAt: true,
      ditugaskanKe: {
        select: {
          name: true,
        },
      },
      createdAt: true,
      riwayat: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          aksi: true,
          statusKe: true,
          statusDari: true,
          catatan: true,
          olehNama: true,
          createdAt: true,
        },
      },
    },
  })

  const geoMap = await getPointGeoJsonMany(
    prisma,
    GEO.pengaduan,
    rows.map((r) => r.id)
  )

  const TITIK_BANDUNG: [number, number][] = [
    [107.6098, -6.9147],
    [107.6111, -6.8905],
    [107.6082, -6.9021],
    [107.6207, -6.8724],
    [107.6239, -6.9111],
    [107.6291, -6.9385],
    [107.5950, -6.9200],
    [107.6400, -6.9100],
    [107.6150, -6.9350],
    [107.5800, -6.8950],
    [107.6350, -6.8850],
    [107.6050, -6.9400],
  ]

  return rows.map((r, idx) => {
    const geo = geoMap.get(r.id)
    const [lng, lat] = geo ? geo.coordinates : TITIK_BANDUNG[idx % TITIK_BANDUNG.length]
    return {
      id: r.id,
      nomorTiket: r.nomorTiket,
      jenis: r.jenis,
      judul: r.judul,
      deskripsi: r.deskripsi,
      status: r.status,
      prioritas: r.prioritas,
      alamatKejadian: r.alamatKejadian || "Kota Bandung",
      fotoUrl: r.fotoUrl,
      pelapor: r.pelapor,
      kontakPelapor: r.kontakPelapor,
      petugasNama: r.ditugaskanKe?.name ?? null,
      targetSelesaiAt: r.targetSelesaiAt ? r.targetSelesaiAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      lng,
      lat,
      riwayat: r.riwayat.map((rw) => ({
        id: rw.id,
        aksi: rw.aksi,
        status: rw.statusKe,
        statusDari: rw.statusDari,
        catatan: rw.catatan,
        olehNama: rw.olehNama,
        waktu: rw.createdAt.toISOString(),
      })),
    }
  })
}

/** Geokoding balik: koordinat (lat, lng) -> alamat teks */
export async function geokodeBalik(lat: number, lng: number): Promise<string> {
  // 1. Coba Nominatim OpenStreetMap
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: { "User-Agent": "PerumdaTirtawening/1.0" },
        signal: controller.signal,
      }
    )
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (data?.display_name) return data.display_name
    }
  } catch {}

  // 2. Fallback PostGIS ST_Contains kecamatan/kelurahan
  try {
    const wilayah = await tandaiWilayah(prisma, lat, lng)
    if (wilayah?.kelurahanId || wilayah?.kecamatanId) {
      const kel = wilayah.kelurahanId
        ? await prisma.kelurahan.findUnique({
            where: { id: wilayah.kelurahanId },
            select: { nama: true },
          })
        : null
      const kec = wilayah.kecamatanId
        ? await prisma.kecamatan.findUnique({
            where: { id: wilayah.kecamatanId },
            select: { nama: true },
          })
        : null
      if (kel?.nama && kec?.nama) return `Kel. ${kel.nama}, Kec. ${kec.nama}, Kota Bandung`
      if (kec?.nama) return `Kec. ${kec.nama}, Kota Bandung`
    }
  } catch {}

  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

/** Geokoding cari: teks query -> array lokasi */
export async function geokodeCari(
  query: string
): Promise<{ lng: number; lat: number; label: string }[]> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&viewbox=107.55,-6.8,107.75,-7.0&bounded=1&limit=5`,
      {
        headers: { "User-Agent": "PerumdaTirtawening/1.0" },
        signal: controller.signal,
      }
    )
    clearTimeout(timer)
    if (res.ok) {
      const items = await res.json()
      if (Array.isArray(items)) {
        return items.map((it: { lon: string; lat: string; display_name: string }) => ({
          lng: parseFloat(it.lon),
          lat: parseFloat(it.lat),
          label: it.display_name,
        }))
      }
    }
  } catch {}
  return []
}

