/**
 * kompres-foto.ts — kompresi foto bukti untuk seluruh aplikasi mobile.
 *
 * Yang dituju: berkas kecil (sekitar 100–120 KB) TANPA mengorbankan detail yang
 * jadi alasan foto itu diambil — angka pada meter air harus tetap terbaca.
 *
 * Versi sebelumnya mengecilkan ke 600 px dengan kualitas tetap 0.8. Dua-duanya
 * keliru untuk tujuan itu:
 *
 *   - 600 px terlalu kecil. Angka meter menempati sebagian kecil bingkai, jadi
 *     digitnya tinggal beberapa piksel dan hancur dimakan artefak JPEG.
 *   - Kualitas tetap TIDAK menghasilkan ukuran tetap. JPEG bergantung isi
 *     gambar: dinding polos jadi 40 KB, rumput dan pagar jadi 400 KB. Jadi
 *     hasilnya tidak bisa diandalkan dari dua sisi sekaligus — kadang terlalu
 *     besar untuk kuota petugas, kadang terlalu remuk untuk dibaca.
 *
 * Pendekatan sekarang membalik urutannya: ukuran berkas yang ditetapkan, lalu
 * kualitas TERTINGGI yang masih muat di dalamnya dicari. Resolusi dipertahankan
 * setinggi mungkin dan hanya diturunkan bila anggaran tetap terlampaui — sebab
 * menurunkan resolusi menghilangkan detail secara permanen, sedangkan
 * menurunkan kualitas JPEG lebih dulu hanya menambah artefak halus.
 *
 * Ukuran hasil diukur lewat panjang base64, bukan filesystem: `expo-file-system`
 * tidak terpasang di semua aplikasi (mobile-publik tidak punya), sementara
 * `saveAsync({ base64: true })` tersedia di mana saja. Lihat SDK 57 —
 * ImageResult hanya memuat uri/width/height/base64, tidak ada ukuran berkas.
 *
 * PERBEDAAN yang disengaja: watermark stempel-waktu belum diport.
 * `expo-image-manipulator` tidak bisa menggambar teks (butuh kanvas Skia).
 * Server tetap mencatat waktu unggah.
 */
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

/**
 * Lebar bawaan. 1600 px membuat digit meter tetap tajam pada foto yang diambil
 * sambil berdiri di depan kotak meter, dan masih muat di anggaran di bawah.
 */
const LEBAR_TARGET_BAWAAN = 1600;

/** Anggaran ukuran berkas. Di atas 100 KB sedikit, sesuai target lapangan. */
const ANGGARAN_BYTE_BAWAAN = 120 * 1024;

/**
 * Batas atas kualitas. Di atas ~0.92 ukuran berkas melonjak tajam sementara
 * mata praktis tidak bisa membedakannya — anggaran habis tanpa imbalan.
 */
const KUALITAS_MAKS = 0.92;

/**
 * Batas bawah kualitas. Di bawah ~0.45 artefak blok mulai memakan tepi digit,
 * yang justru merusak satu-satunya hal yang perlu terbaca. Kalau anggaran masih
 * terlampaui di titik ini, resolusi yang diturunkan — bukan kualitas.
 */
const KUALITAS_MIN = 0.45;

/** Cukup untuk menyempitkan rentang kualitas sampai ~0.03. */
const LANGKAH_CARI = 6;

/**
 * Tangga penurunan resolusi, dipakai berurutan hanya bila anggaran terlampaui.
 * Berhenti di 800 px: di bawah itu foto tidak lagi berguna sebagai bukti.
 */
const TANGGA_LEBAR = [1600, 1280, 1024, 800];

export interface KompresFotoOptions {
  /** URI berkas sumber (hasil kamera/galeri). */
  sumberUri: string;
  /** Lebar maksimum px. Foto yang sudah lebih kecil TIDAK diperbesar. */
  lebarTarget?: number;
  /** Anggaran ukuran berkas dalam byte. */
  anggaranByte?: number;
  /** Keterangan watermark (belum dirender — lihat catatan modul). */
  keterangan?: string;
  /** Aktifkan watermark stempel waktu (belum diimplementasi — no-op). */
  watermark?: boolean;
}

export interface HasilKompresFoto {
  uri: string;
  lebar: number;
  tinggi: number;
  /** Ukuran hasil dalam byte — berguna untuk log/diagnosa lapangan. */
  byte: number;
  /** Kualitas JPEG yang akhirnya dipakai (0–1). */
  kualitas: number;
  /** true bila anggaran tetap terlampaui walau resolusi sudah diturunkan. */
  melebihiAnggaran: boolean;
}

/** Panjang base64 → jumlah byte asli, memperhitungkan padding '='. */
function byteDariBase64(base64: string): number {
  if (base64.length === 0) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Cari kualitas TERTINGGI yang hasilnya masih muat di [anggaranByte], lewat
 * pencarian biner pada satu gambar yang sudah dirender.
 *
 * Percobaan pertama sengaja langsung di kualitas maksimum: foto berlatar
 * sederhana sering langsung muat, dan itu menghemat seluruh sisa pencarian.
 */
async function cariKualitasTerbaik(
  gambar: ImageRef,
  anggaranByte: number,
): Promise<HasilKompresFoto> {
  let bawah = KUALITAS_MIN;
  let atas = KUALITAS_MAKS;
  let terbaik: HasilKompresFoto | null = null;
  /** Hasil terkecil yang pernah dilihat — jaring pengaman bila tak ada yang muat. */
  let terkecil: HasilKompresFoto | null = null;

  for (let i = 0; i < LANGKAH_CARI; i++) {
    const kualitas = i === 0 ? atas : (bawah + atas) / 2;
    const hasil = await gambar.saveAsync({
      format: SaveFormat.JPEG,
      compress: kualitas,
      base64: true,
    });
    const byte = byteDariBase64(hasil.base64 ?? '');
    const kandidat: HasilKompresFoto = {
      uri: hasil.uri,
      lebar: hasil.width,
      tinggi: hasil.height,
      byte,
      kualitas,
      melebihiAnggaran: byte > anggaranByte,
    };

    if (terkecil == null || byte < terkecil.byte) terkecil = kandidat;

    if (byte <= anggaranByte) {
      if (terbaik == null || kualitas > terbaik.kualitas) terbaik = kandidat;
      bawah = kualitas; // masih muat — coba yang lebih bagus
    } else {
      atas = kualitas; // kebesaran — turunkan
    }

    // Rentang sudah cukup sempit; iterasi lanjutan tidak lagi mengubah hasil
    // yang terlihat, hanya menambah satu encode lagi.
    if (atas - bawah < 0.03) break;
  }

  return terbaik ?? terkecil!;
}

/**
 * Kecilkan foto agar muat di anggaran ukuran, dengan detail semaksimal mungkin.
 * Mengembalikan URI hasil beserta ukuran akhirnya.
 *
 * Tidak pernah melempar karena foto "terlalu berat" — bila anggaran tetap tak
 * tercapai di resolusi terendah, hasil terbaik yang ada tetap dikembalikan
 * dengan penanda `melebihiAnggaran`. Server masih menerima sampai 5 MB, jadi
 * mengembalikan foto agak besar jauh lebih baik daripada menggagalkan
 * pencatatan petugas yang sudah berdiri di depan meter.
 */
export async function kompresFoto({
  sumberUri,
  lebarTarget = LEBAR_TARGET_BAWAAN,
  anggaranByte = ANGGARAN_BYTE_BAWAAN,
}: KompresFotoOptions): Promise<HasilKompresFoto> {
  // Ukuran asli dikenali dulu supaya foto yang sudah kecil tidak DIPERBESAR —
  // memperbesar hanya menambah byte tanpa menambah satu pun detail baru.
  // Orientasi EXIF sudah dibakar oleh manipulator, jadi tidak perlu ditangani.
  const asli = await ImageManipulator.manipulate(sumberUri).renderAsync();

  const batasLebar = Math.min(lebarTarget, asli.width);
  // Lebar tertinggi yang boleh dipakai SELALU dicoba lebih dulu, baru anak
  // tangga di bawahnya. Tanpa baris pertama ini, foto yang aslinya 900 px
  // akan langsung dilempar ke 800 px padahal 900 px-nya sendiri belum pernah
  // diuji — detail hilang tanpa perlu.
  const tangga = [batasLebar, ...TANGGA_LEBAR.filter((l) => l < batasLebar)];

  let terbaik: HasilKompresFoto | null = null;

  for (const lebar of tangga) {
    const gambar =
      lebar >= asli.width
        ? asli
        : await ImageManipulator.manipulate(sumberUri).resize({ width: lebar }).renderAsync();

    const hasil = await cariKualitasTerbaik(gambar, anggaranByte);
    if (!hasil.melebihiAnggaran) return hasil;

    // Belum muat: simpan yang terkecil lalu turun satu anak tangga.
    if (terbaik == null || hasil.byte < terbaik.byte) terbaik = hasil;
  }

  return terbaik!;
}
