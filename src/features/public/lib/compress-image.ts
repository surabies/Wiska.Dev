// features/publik/lib/compress-image.ts — kecilkan foto di browser sebelum
// diunggah. Foto langsung dari kamera HP modern bisa 8–15 MB; mengecilkannya di
// client menghemat kuota data pelapor (banyak yang melapor dari sinyal seluler)
// dan mempercepat unggah. Backend TETAP memvalidasi ukuran & isi berkas sendiri
// lewat magic bytes (server/lib/storage.ts) — ini murni optimisasi UX, bukan
// validasi.
//
// Tiga hal yang membuat versi sebelumnya menghasilkan foto jelek:
//
//   1. Kualitas dipatok 0.8 tanpa target ukuran. Ukuran berkas JPEG bergantung
//      isi gambar, jadi hasilnya tidak terkendali dari dua sisi: dinding polos
//      jadi 40 KB, rumput dan pagar jadi 400 KB.
//   2. Penurunan ukuran dilakukan SEKALI LOMPAT dari mis. 4000 px ke 1200 px.
//      `drawImage` memakai penyaringan bilinear yang hanya mencuplik beberapa
//      piksel tetangga, jadi lompatan besar membuang sebagian besar piksel
//      sumber — hasilnya bergerigi dan berdesir, persis yang terlihat sebagai
//      "hasil kompresnya jelek".
//   3. Orientasi EXIF diabaikan. `createImageBitmap` bawaannya TIDAK memutar
//      gambar, sehingga foto potret dari iPhone terunggah dalam posisi miring.
//
// Sekarang: ukuran berkas yang ditetapkan lalu kualitas tertinggi yang masih
// muat dicari, penurunan dilakukan bertahap, dan orientasi dihormati.

/** Sisi terpanjang. Cukup untuk membaca angka meter, masih ramah kuota. */
const SISI_MAKS = 1600

/** Anggaran ukuran berkas — sedikit di atas 100 KB, sesuai target lapangan. */
const ANGGARAN_BYTE = 120 * 1024

/** Di atas ~0.92 ukuran melonjak tanpa perbedaan yang kasat mata. */
const KUALITAS_MAKS = 0.92

/** Di bawah ~0.45 artefak blok mulai memakan tepi digit meter. */
const KUALITAS_MIN = 0.45

const LANGKAH_CARI = 6

/** Tangga penurunan resolusi, dipakai hanya bila anggaran tetap terlampaui. */
const TANGGA_SISI = [1600, 1280, 1024, 800]

/**
 * WebP pada ukuran berkas yang sama membawa detail jauh lebih banyak daripada
 * JPEG, dan server sudah menerimanya (lihat TIPE_DIIZINKAN di storage.ts).
 * Dukungannya dideteksi sungguhan lewat hasil `toDataURL`, bukan ditebak dari
 * user-agent: browser yang tidak mengenal tipe itu diam-diam memulangkan PNG.
 */
function dukungWebp(): boolean {
  try {
    const c = document.createElement("canvas")
    c.width = 1
    c.height = 1
    return c.toDataURL("image/webp").startsWith("data:image/webp")
  } catch {
    return false
  }
}

/**
 * Turunkan ukuran BERTAHAP, tiap langkah paling banyak setengah. Melompat
 * langsung ke ukuran akhir membuang mayoritas piksel sumber; memotong separuh
 * berulang kali membuat tiap piksel hasil benar-benar merata-ratakan
 * tetangganya, sehingga tepi angka tetap bersih.
 */
function gambarBertahap(
  sumber: ImageBitmap,
  lebarAkhir: number,
  tinggiAkhir: number
): HTMLCanvasElement | null {
  let lebar = sumber.width
  let tinggi = sumber.height

  let kanvas = document.createElement("canvas")
  kanvas.width = lebar
  kanvas.height = tinggi
  let ctx = kanvas.getContext("2d")
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(sumber, 0, 0)

  while (lebar > lebarAkhir * 2) {
    const lebarBaru = Math.max(lebarAkhir, Math.round(lebar / 2))
    const tinggiBaru = Math.max(tinggiAkhir, Math.round(tinggi / 2))
    const berikut = document.createElement("canvas")
    berikut.width = lebarBaru
    berikut.height = tinggiBaru
    const c = berikut.getContext("2d")
    if (!c) return null
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = "high"
    c.drawImage(kanvas, 0, 0, lebarBaru, tinggiBaru)
    kanvas = berikut
    ctx = c
    lebar = lebarBaru
    tinggi = tinggiBaru
  }

  if (lebar !== lebarAkhir || tinggi !== tinggiAkhir) {
    const akhir = document.createElement("canvas")
    akhir.width = lebarAkhir
    akhir.height = tinggiAkhir
    const c = akhir.getContext("2d")
    if (!c) return null
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = "high"
    c.drawImage(kanvas, 0, 0, lebarAkhir, tinggiAkhir)
    return akhir
  }
  return kanvas
}

function keBlob(kanvas: HTMLCanvasElement, tipe: string, kualitas: number): Promise<Blob | null> {
  return new Promise((resolve) => kanvas.toBlob(resolve, tipe, kualitas))
}

/**
 * Cari kualitas TERTINGGI yang hasilnya masih muat di anggaran, lewat pencarian
 * biner. Percobaan pertama sengaja di kualitas maksimum: foto berlatar
 * sederhana sering langsung muat, dan itu menghemat seluruh sisa pencarian.
 */
async function cariKualitasTerbaik(
  kanvas: HTMLCanvasElement,
  tipe: string
): Promise<{ blob: Blob; muat: boolean } | null> {
  let bawah = KUALITAS_MIN
  let atas = KUALITAS_MAKS
  let terbaik: Blob | null = null
  let terkecil: Blob | null = null

  for (let i = 0; i < LANGKAH_CARI; i++) {
    const kualitas = i === 0 ? atas : (bawah + atas) / 2
    const blob = await keBlob(kanvas, tipe, kualitas)
    if (!blob) break

    if (terkecil == null || blob.size < terkecil.size) terkecil = blob

    if (blob.size <= ANGGARAN_BYTE) {
      terbaik = blob
      bawah = kualitas
    } else {
      atas = kualitas
    }
    if (atas - bawah < 0.03) break
  }

  if (terbaik) return { blob: terbaik, muat: true }
  if (terkecil) return { blob: terkecil, muat: false }
  return null
}

/**
 * Kecilkan [file] agar muat di anggaran ukuran dengan detail semaksimal
 * mungkin. Bila apa pun gagal (kanvas tidak tersedia, berkas bukan gambar yang
 * bisa didekode), berkas ASLI dikembalikan apa adanya — mengunggah foto besar
 * jauh lebih baik daripada menggagalkan laporan warga.
 */
export async function compressImage(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    // `imageOrientation: 'from-image'` memutar sesuai EXIF. Tanpa ini foto
    // potret dari iPhone terunggah miring.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    return file
  }

  const tipe = dukungWebp() ? "image/webp" : "image/jpeg"
  const ekstensi = tipe === "image/webp" ? "webp" : "jpg"

  try {
    let hasilTerkecil: Blob | null = null

    for (const sisi of TANGGA_SISI) {
      // Jangan pernah MEMPERBESAR: menaikkan ukuran hanya menambah byte tanpa
      // menambah satu pun detail baru.
      const skala = Math.min(1, sisi / Math.max(bitmap.width, bitmap.height))
      const lebar = Math.max(1, Math.round(bitmap.width * skala))
      const tinggi = Math.max(1, Math.round(bitmap.height * skala))

      const kanvas = gambarBertahap(bitmap, lebar, tinggi)
      if (!kanvas) return file

      const hasil = await cariKualitasTerbaik(kanvas, tipe)
      if (!hasil) return file

      if (hasil.muat) {
        return new File([hasil.blob], `foto-meter.${ekstensi}`, { type: tipe })
      }
      if (hasilTerkecil == null || hasil.blob.size < hasilTerkecil.size) {
        hasilTerkecil = hasil.blob
      }
    }

    if (hasilTerkecil) {
      return new File([hasilTerkecil], `foto-meter.${ekstensi}`, { type: tipe })
    }
    return file
  } finally {
    bitmap.close()
  }
}
