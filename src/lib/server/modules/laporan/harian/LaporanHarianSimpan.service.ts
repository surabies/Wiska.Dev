// src/lib/server/modules/laporan/LaporanHarianSimpan.service.ts — penyimpanan
// laporan harian (unggah foto/video bukti, simpan satuan, sinkronisasi batch).
import { prisma } from "@db"
import {
  BadRequestError,
  ConflictError,
  isPrismaKnownError,
} from "../../../lib/Galat"
import { simpanBerkas, BerkasTidakValidError } from "../../../lib/Penyimpanan"
import type { SessionUser } from "../../../lib/Sesi"
import {
  unggahFotoSchema,
  type CreateLaporanInput,
  type BatchLaporanInput,
} from "./LaporanHarian.schema"

// ── Upload berkas bukti petugas (foto stand / segel / rumah, plus video
// pembacaan). multipart/form-data karena membawa berkas; validasi isi
// (magic bytes) + penamaan deterministik terjadi di simpanBerkas(). Client
// memanggil ini per berkas, lalu menyertakan URL-nya di POST / atau /batch
// (fotoStandUrl/fotoSegelUrl/fotoRumahUrl/videoUrl). Field form tetap
// bernama `foto` juga untuk video — kontrak satu pintu, jangan dipecah.
export async function unggahFotoLaporanHarian(form: FormData) {
  const parsed = unggahFotoSchema.parse({
    nomorLangganan: form.get("nomorLangganan"),
    periode: form.get("periode"),
    jenis: form.get("jenis"),
  })

  const foto = form.get("foto")
  if (!(foto instanceof File))
    throw new BadRequestError("Foto wajib dilampirkan sebagai field `foto`.")

  try {
    const hasil = await simpanBerkas(foto, {
      prefix: "laporan-harian",
      namaBerkas: `${parsed.periode}_${parsed.jenis}_${parsed.nomorLangganan}`,
      subFolder: `${parsed.periode}`,
      jenisMedia: parsed.jenis === "video" ? "video" : "foto",
    })
    return {
      jenis: parsed.jenis,
      url: hasil.url,
      publicId: hasil.publicId,
    }
  } catch (err) {
    if (err instanceof BerkasTidakValidError)
      throw new BadRequestError(err.message)
    throw err
  }
}

/// Jarak (meter, bulat) posisi catat petugas ke titik pelanggan — bukti
/// kehadiran di lokasi (marginMeter di Aurora). Prioritas kolom PostGIS
/// `koordinat`; fallback geoLat/geoLong legacy HANYA bila masuk akal sebagai
/// koordinat (placeholder Excel-serial ~46168 di data lama harus tersaring).
/// $queryRawUnsafe + parameter posisi — JANGAN Prisma.raw (server/README.md).
export async function hitungJarakMeter(
  pelangganId: string,
  latCatat: number,
  longCatat: number
): Promise<number | null> {
  const hasil = await prisma.$queryRawUnsafe<{ jarak: number | null }[]>(
    `SELECT ST_DistanceSphere(
        COALESCE(
          koordinat,
          CASE WHEN "geoLat" BETWEEN -90 AND 90 AND "geoLong" BETWEEN -180 AND 180
               THEN ST_SetSRID(ST_MakePoint("geoLong", "geoLat"), 4326) END
        ),
        ST_SetSRID(ST_MakePoint($1, $2), 4326)
     ) AS jarak
     FROM pelanggan WHERE id = $3`,
    longCatat,
    latCatat,
    pelangganId
  )
  const jarak = hasil[0]?.jarak
  return jarak == null ? null : Math.round(jarak)
}

/// Inti penyimpanan satu laporan — dipakai POST / dan POST /batch supaya
/// aturan bisnisnya (pemakaian dihitung server, snapshot identitas, jarak
/// GPS) tidak bercabang dua.
/// Hari terakhir bulan sebuah periode (TTTTBB), dalam UTC. Hari ke-0 bulan
/// berikutnya = hari terakhir bulan ini.
export function akhirBulanPeriode(periode: number): Date {
  const tahun = Math.floor(periode / 100)
  const bulan = periode % 100
  return new Date(Date.UTC(tahun, bulan, 0))
}

export async function simpanLaporan(
  input: CreateLaporanInput,
  pencatatIdDefault: string | null
) {
  // notelpBaru bukan kolom laporan — dipisah sebelum spread ke create().
  const { notelpBaru, ...body } = input
  const periodePenagihan = await prisma.periodePenagihan?.findUnique?.({
    where: { periode: body.periode },
    select: { status: true },
  })
  if (periodePenagihan?.status === "TERKUNCI") {
    throw new ConflictError(
      `Periode ${body.periode} sudah ditutup (TERKUNCI). Laporan baru untuk periode ini tidak dapat disimpan.`
    )
  }
  // pemakaian dihitung server dari stand, bukan diterima dari client.
  // Sesuai VERIFIKASI.md & REKONSILIASI.md: jangan mengubah selisih negatif
  // menjadi nol diam-diam supaya anomali stand mundur tetap terlihat di antrean V1.
  const pemakaian = body.standAkhir - body.standAwal

  // Siapa pencatatnya, dengan tiga lapis — dari yang paling tahu ke yang
  // paling umum:
  //
  //   1. dikirim client        (jarang; hanya alat administratif)
  //   2. akun token            aplikasi petugas: pengirimnya sendiri
  //      (jembatan Pencatat.userId), tanpa memercayai client menyebut
  //      identitasnya sendiri
  //   3. PENUGASAN RUTE        entri manual dari layar Mutasi PBPK: yang
  //      menekan tombol adalah operator kantor, bukan pencatat, sehingga
  //      lapis 2 kosong. Petugas yang benar adalah yang ditugaskan pada
  //      rute pelanggan itu.
  //
  // Tanpa lapis ke-3, laporan hasil entri manual lahir tanpa petugas — dan
  // di layar verifikasi kolom Petugas kosong padahal rutenya jelas menunjuk
  // seseorang. Itu bukan sekadar tampilan: beban kerja per petugas jadi
  // tidak menghitung sambungan baru sama sekali.
  let pencatatId =
    body.pencatatId === undefined ? pencatatIdDefault : body.pencatatId
  if (!pencatatId && body.pelangganId) {
    const lewatRute = await prisma.pelanggan.findUnique({
      where: { id: body.pelangganId },
      select: {
        rute: {
          select: {
            penugasanRute: {
              select: { pencatatId: true },
              orderBy: { urutan: "asc" },
              take: 1,
            },
          },
        },
      },
    })
    pencatatId = lewatRute?.rute?.penugasanRute[0]?.pencatatId ?? null
  }

  // Snapshot identitas (nama/alamat) WAJIB terisi selama pelanggannya
  // dikenal — baris harus tetap terbaca di UI walau relasi pelanggan
  // kelak terputus (pola relasi+snapshot, lihat prisma/docs/README.md).
  let { namaPelanggan, alamatPelanggan } = body
  if (body.pelangganId && (!namaPelanggan || !alamatPelanggan)) {
    const p = await prisma.pelanggan.findUnique({
      where: { id: body.pelangganId },
      select: { nama: true, alamat: true },
    })
    namaPelanggan ??= p?.nama ?? null
    alamatPelanggan ??= p?.alamat ?? null
  }

  const jarakMeter =
    body.pelangganId && body.latCatat != null && body.longCatat != null
      ? await hitungJarakMeter(body.pelangganId, body.latCatat, body.longCatat)
      : null

  // tanggalCatat: kiriman aplikasi petugas selalu membawanya (waktu ia
  // berdiri di depan meter). Entri manual tidak — dan tanpa nilai, kolom
  // "Catat" di layar verifikasi kosong serta saringan rentang tanggal tidak
  // pernah menemukan barisnya.
  //
  // Bawaannya AKHIR BULAN PERIODE, bukan "sekarang". Periode yang dikerjakan
  // kerap tertinggal jauh dari kalender — mengisi waktu penyimpanan membuat
  // pembacaan Januari bertanggal catat Juli, yang salah di layar dan membuat
  // saringan rentang tanggal Januari tidak pernah menemukannya. Kapan baris
  // ini DIKETIK tetap terekam terpisah di createdAt; yang dicatat di sini
  // adalah kapan meternya dibaca, dan itu ada di dalam periodenya.
  const tanggalCatat = body.tanggalCatat ?? akhirBulanPeriode(body.periode)

  const row = await prisma.laporanHarianPetugas.create({
    data: {
      ...body,
      pencatatId,
      tanggalCatat,
      namaPelanggan,
      alamatPelanggan,
      pemakaian,
      jarakMeter,
      tanggalUpload: new Date(),
    },
  })

  // Pembaruan kontak dari lapangan diterapkan SETELAH laporan tersimpan —
  // gagalnya update notelp (mis. pelanggan terhapus) tidak boleh
  // menggagalkan laporan yang sudah susah payah dicatat.
  if (notelpBaru && body.pelangganId) {
    try {
      await prisma.pelanggan.update({
        where: { id: body.pelangganId },
        data: { notelp: notelpBaru },
      })
    } catch {
      // baris pelanggan hilang/berubah — laporan tetap sah tanpa update HP.
    }
  }
  return row
}

export async function buatLaporanHarian(
  body: CreateLaporanInput,
  requester: SessionUser
) {
  let pencatatIdDefault: string | null = null
  if (body.pencatatId === undefined) {
    const pencatat = await prisma.pencatat.findUnique({
      where: { userId: requester.id },
      select: { id: true },
    })
    pencatatIdDefault = pencatat?.id ?? null
  }
  return simpanLaporan(body, pencatatIdDefault)
}

// ── Sinkronisasi batch dari aplikasi petugas (pola dev_store_data.php
// Aurora): petugas bekerja OFFLINE seharian lalu mengunggah borongan.
// Kontraknya per-record, BUKAN semua-atau-gagal: satu baris bermasalah
// tidak boleh membatalkan ratusan baris lain yang sudah susah payah
// dicatat di lapangan. DUPLIKAT (P2002 pada [nomorLangganan, periode])
// diperlakukan sebagai sukses-idempoten — terjadi saat unggah ulang karena
// sinyal putus sebelum respons pertama sampai; client cukup menandai baris
// itu "sudah terunggah".
export async function buatBatchLaporanHarian(
  input: BatchLaporanInput,
  requester: SessionUser
) {
  const { laporan } = input
  const pencatat = await prisma.pencatat.findUnique({
    where: { userId: requester.id },
    select: { id: true },
  })
  const pencatatIdDefault = pencatat?.id ?? null

  const hasil: {
    index: number
    nomorLangganan: string
    periode: number
    status: "TERSIMPAN" | "DUPLIKAT" | "GAGAL"
    id?: string
    pesan?: string
  }[] = []

  // Sequential, bukan Promise.all — batch 300 baris paralel akan menghabiskan
  // pool koneksi dan urutan hasil harus stabil mengikuti urutan kiriman.
  for (const [index, item] of laporan.entries()) {
    const identitas = {
      index,
      nomorLangganan: item.nomorLangganan,
      periode: item.periode,
    }
    try {
      const row = await simpanLaporan(item, pencatatIdDefault)
      hasil.push({ ...identitas, status: "TERSIMPAN", id: row.id })
    } catch (err) {
      if (isPrismaKnownError(err) && err.code === "P2002") {
        hasil.push({
          ...identitas,
          status: "DUPLIKAT",
          pesan: "Laporan periode ini sudah pernah terunggah.",
        })
      } else if (isPrismaKnownError(err) && err.code === "P2003") {
        hasil.push({
          ...identitas,
          status: "GAGAL",
          pesan: "Referensi pelanggan/pencatat tidak valid.",
        })
      } else {
        // Pesan internal tidak diteruskan — bisa memuat detail infrastruktur.
        console.error("[laporan-harian/batch] baris gagal:", identitas, err)
        hasil.push({
          ...identitas,
          status: "GAGAL",
          pesan: "Terjadi kesalahan menyimpan baris ini.",
        })
      }
    }
  }

  const hitung = (s: "TERSIMPAN" | "DUPLIKAT" | "GAGAL") =>
    hasil.filter((h) => h.status === s).length
  return {
    total: laporan.length,
    tersimpan: hitung("TERSIMPAN"),
    duplikat: hitung("DUPLIKAT"),
    gagal: hitung("GAGAL"),
    hasil,
  }
}
