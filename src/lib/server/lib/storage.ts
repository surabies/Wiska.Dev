import "server-only"

// server/lib/storage.ts — satu-satunya pintu penyimpanan berkas (foto meter,
// foto pengaduan).
//
// PENYEDIA: Cloudinary (paket gratis). Skema mensyaratkan
// `LaporanMandiri.fotoUrl` + `fotoPublicId` (keduanya wajib) — `fotoPublicId`
// dipetakan langsung ke `public_id` milik Cloudinary, jadi penghapusan/
// transformasi gambar kelak cukup bermodal nilai yang sudah tersimpan itu.
//
//   - CLOUDINARY_* diisi -> unggah ke Cloudinary (signed upload).
//   - Tidak diisi        -> simpan ke DISK LOKAL ./.uploads, dilayani lewat
//                           /api/public/berkas/:namaFile.
//
// Fallback disk dipertahankan supaya `pnpm dev` tetap jalan bagi orang yang
// belum punya kredensial Cloudinary. TAPI di produksi tanpa CLOUDINARY_*
// kondisi itu dianggap ERROR — disk lokal hilang saat container di-redeploy
// dan tidak terbagi antar instance, jadi diam-diam memakainya di produksi =
// foto bukti pelanggan menguap tanpa jejak.
//
// Ganti penyedia? Cukup ubah isi simpanBerkas(); pemanggilnya tidak berubah.
import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

/// Hanya format gambar yang lazim dari kamera HP. Daftar putih, bukan daftar
/// hitam: apa pun di luar ini ditolak.
const TIPE_DIIZINKAN = new Set(["image/jpeg", "image/png", "image/webp"])
/// Video bukti pembacaan meter (kamera HP Android: MP4/3GP ber-`ftyp`,
/// sebagian device WebM). Dipisah dari foto: batas ukuran & endpoint
/// Cloudinary-nya berbeda.
const TIPE_VIDEO_DIIZINKAN = new Set(["video/mp4", "video/webm"])
const EKSTENSI: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
}

export const MAKS_UKURAN_BYTE = 5 * 1024 * 1024 // 5 MB — cukup untuk foto HP
/// Video dibatasi 50 MB — klip pembacaan meter berdurasi detik, bukan menit.
export const MAKS_UKURAN_VIDEO_BYTE = 50 * 1024 * 1024

const DIR_LOKAL = path.join(process.cwd(), ".uploads")

export interface HasilSimpan {
  /** URL yang bisa dibuka publik. */
  url: string
  /** Pengenal internal untuk penghapusan kelak (fotoPublicId di skema). */
  publicId: string
}

export class BerkasTidakValidError extends Error {}

/// Mencocokkan ISI berkas dengan tipe yang diakuinya (magic bytes / file
/// signature). WAJIB: `file.type` berasal dari browser dan BISA DIPALSUKAN —
/// `curl -F "foto=@virus.txt;type=image/jpeg"` lolos begitu saja kalau kita
/// hanya memercayai `file.type`. Mengembalikan tipe SEBENARNYA, atau null.
function tipeSebenarnya(buf: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "image/jpeg"
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png"
  // WEBP: "RIFF" .... "WEBP"
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString() === "RIFF" &&
    buf.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp"
  // MP4/3GP (ISO BMFF): 4 byte ukuran box lalu "ftyp" di offset 4 — brand
  // (mp42/isom/3gp4/...) beragam antar kamera HP, cukup penanda ftyp-nya.
  if (buf.length >= 8 && buf.subarray(4, 8).toString() === "ftyp")
    return "video/mp4"
  // WebM/Matroska: header EBML 1A 45 DF A3.
  if (
    buf.length >= 4 &&
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  )
    return "video/webm"
  return null
}

export interface IdentitasBerkas {
  /** Folder logis & prefix path lokal, mis. "laporan-mandiri". Konsisten
   *  per jenis laporan (bukan per periode) — route lokal `berkas.router.ts`
   *  hanya menerima 2 segmen path (`/:prefix/:namaFile`), jadi periode
   *  TIDAK masuk sini, taruh di `namaBerkas` atau `subFolder`. */
  prefix: string
  /** Nama berkas TANPA ekstensi, DETERMINISTIK dari identitas datanya —
   *  bukan UUID acak — supaya foto periode yang sama gampang ditemukan &
   *  ditimpa (bukan menumpuk salinan) di Cloudinary Console. Konvensi:
   *  `${periode}_${jenisFoto}_${nomorLangganan}`, mis.
   *  "202607_stand_00401700010". */
  namaBerkas: string
  /** Sub-folder tambahan KHUSUS Cloudinary (mis. periode "202607") supaya
   *  foto tersusun rapi per periode di Cloudinary Console. Diabaikan di
   *  fallback disk lokal (tetap flat per `prefix` di sana). */
  subFolder?: string
  /** "video" mengizinkan MP4/WebM dengan batas 50 MB dan mengunggah lewat
   *  endpoint video Cloudinary. Default (undefined/"foto") = perilaku lama:
   *  hanya gambar. */
  jenisMedia?: "foto" | "video"
}

/// Validasi WAJIB di sini, bukan dipercayakan ke client. Tiga lapis:
///  1. ukuran (batasi biaya),
///  2. ISI berkas dicocokkan lewat magic bytes — bukan sekadar `file.type`
///     yang bisa dipalsukan,
///  3. ekstensi & nama file DITENTUKAN SERVER dari tipe hasil deteksi —
///     nama dari pengguna TIDAK PERNAH dipakai (mencegah path traversal
///     "../../etc/passwd" dan ekstensi ganda "a.jpg.html"); hanya BAGIAN
///     deskriptif dari `namaBerkas` yang datang dari pemanggil, dan itu pun
///     harus dibangun dari data yang sudah tervalidasi (periode/nomor
///     langganan), bukan input bebas pengguna.
export async function simpanBerkas(
  file: File,
  identitas: IdentitasBerkas,
): Promise<HasilSimpan> {
  const isVideo = identitas.jenisMedia === "video"
  const maksByte = isVideo ? MAKS_UKURAN_VIDEO_BYTE : MAKS_UKURAN_BYTE
  if (file.size > maksByte) {
    throw new BerkasTidakValidError(
      `Ukuran ${isVideo ? "video" : "foto"} maksimal ${maksByte / 1024 / 1024} MB.`,
    )
  }
  if (file.size === 0) {
    throw new BerkasTidakValidError("Berkas kosong atau gagal terbaca.")
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const tipe = tipeSebenarnya(buffer)

  // Yang dipercaya adalah ISI berkas, bukan pengakuan client.
  const diizinkan = isVideo ? TIPE_VIDEO_DIIZINKAN : TIPE_DIIZINKAN
  if (!tipe || !diizinkan.has(tipe)) {
    throw new BerkasTidakValidError(
      isVideo
        ? "File yang diunggah bukan video MP4/WebM yang valid."
        : "File yang diunggah bukan foto JPG, PNG, atau WEBP yang valid.",
    )
  }

  if (process.env.CLOUDINARY_CLOUD_NAME) {
    // `tipe` (hasil deteksi magic bytes), BUKAN file.type dari client —
    // kalau tidak, Content-Type palsu ikut tersimpan permanen di penyedia
    // dan disajikan balik ke browser apa adanya.
    return simpanKeCloudinary(buffer, tipe, identitas)
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME belum diisi — foto tidak bisa disimpan secara andal di produksi. Set env CLOUDINARY_* atau ganti implementasi simpanBerkas().",
    )
  }

  const publicId = `${identitas.prefix}/${identitas.namaBerkas}.${EKSTENSI[tipe]}`
  const tujuan = path.join(DIR_LOKAL, publicId)
  await mkdir(path.dirname(tujuan), { recursive: true })
  await writeFile(tujuan, buffer)
  return { url: `/api/public/berkas/${publicId}`, publicId }
}

/// Unggah ke Cloudinary lewat REST API + fetch, tanpa SDK `cloudinary`
/// (~2 MB, menyeret banyak dependensi Node) — kita hanya butuh satu POST.
///
/// SIGNED upload, BUKAN unsigned preset. Unsigned preset berarti siapa pun
/// yang membaca JS di browser bisa memakai kuota Cloudinary kita untuk
/// mengunggah apa saja. Di sini API secret tidak pernah meninggalkan server:
/// tanda tangannya dihitung di sini dan berkas diteruskan dari server.
///
/// Aturan tanda tangan Cloudinary: ambil SEMUA parameter kecuali `file`,
/// `api_key`, dan `resource_type`; urutkan menurut nama; rangkai jadi
/// `k=v&k=v`; tempelkan api_secret di belakang; SHA-1. Salah urut = 401.
async function simpanKeCloudinary(
  buffer: Buffer,
  tipe: string,
  identitas: IdentitasBerkas,
): Promise<HasilSimpan> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME diisi tapi CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET belum.",
    )
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = ["surabie", identitas.prefix, identitas.subFolder]
    .filter(Boolean)
    .join("/")

  // public_id + overwrite: nama berkas deterministik (bukan Cloudinary
  // auto-generate acak) supaya laporan bulan yang sama menimpa asetnya
  // sendiri di Cloudinary alih-alih menumpuk salinan baru tiap percobaan.
  const params: Record<string, string> = {
    folder,
    public_id: identitas.namaBerkas,
    overwrite: "true",
    timestamp: String(timestamp),
  }
  const signature = tandaTanganCloudinary(params, apiSecret)

  const form = new FormData()
  // Data URI: cara Cloudinary menerima berkas mentah tanpa multipart manual.
  form.append("file", `data:${tipe};base64,${buffer.toString("base64")}`)
  form.append("api_key", apiKey)
  for (const [k, v] of Object.entries(params)) form.append(k, v)
  form.append("signature", signature)

  // resource_type ada di PATH, tidak ikut ditandatangani (aturan Cloudinary).
  const resourceType = tipe.startsWith("video/") ? "video" : "image"
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {
      method: "POST",
      body: form,
    },
  )

  if (!res.ok) {
    // Detail hanya ke log server — pesan penyedia bisa memuat konfigurasi
    // internal / potongan kredensial.
    console.error(
      "[storage] Cloudinary menolak:",
      res.status,
      await res.text().catch(() => ""),
    )
    throw new Error("Gagal menyimpan foto")
  }

  const hasil = (await res.json()) as {
    secure_url?: string
    public_id?: string
  }
  if (!hasil.secure_url || !hasil.public_id) {
    console.error("[storage] respons Cloudinary tidak terduga:", hasil)
    throw new Error("Gagal menyimpan foto")
  }

  // secure_url (https), bukan `url` (http) — foto ini disematkan di halaman
  // https, dan aset http akan diblokir browser sebagai mixed content.
  return { url: hasil.secure_url, publicId: hasil.public_id }
}

/// Dipisah supaya bisa diuji tanpa jaringan.
export function tandaTanganCloudinary(
  params: Record<string, string>,
  apiSecret: string,
): string {
  const rangkaian = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&")
  return createHash("sha1")
    .update(rangkaian + apiSecret)
    .digest("hex")
}

/// Path aman untuk fallback lokal. WAJIB dipakai route pelayan berkas —
/// tanpa ini, `publicId` dari URL bisa berisi "../" dan membaca berkas
/// sembarang di server.
export function pathLokalAman(publicId: string): string | null {
  const tujuan = path.resolve(DIR_LOKAL, publicId)
  if (!tujuan.startsWith(path.resolve(DIR_LOKAL) + path.sep)) return null
  return tujuan
}
