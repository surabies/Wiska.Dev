/**
 * ocr-stand.ts — membaca angka stand dari foto meter dengan Google ML Kit.
 *
 * DIJALANKAN DI PERANGKAT, BUKAN DI AWAN, dan itu bukan pilihan performa
 * melainkan syarat kerja: seluruh modul Baca Meter dirancang jalan penuh tanpa
 * sinyal (lihat dao.ts), dan OCR yang menuntut jaringan akan mati persis di
 * gang-gang yang sinyalnya paling buruk — tempat petugas paling banyak
 * menghabiskan waktu.
 *
 * MENGUSULKAN, TIDAK MENGISI. Hasilnya SELALU disajikan sebagai pilihan yang
 * harus diketuk petugas, tidak pernah langsung masuk ke kolom stand. Tiga
 * alasan yang semuanya nyata di lapangan:
 *
 *   1. Roda meter itu MEKANIS. Angka bisa berhenti di antara dua digit, dan
 *      manusia membacanya dengan aturan ("ambil yang sudah lewat"), sementara
 *      OCR menebak.
 *   2. DIGIT MERAH desimal tidak bisa dibedakan dari digit hitam oleh ML Kit —
 *      keluarannya tidak membawa warna. Deret "0086 75" bisa terbaca 008675.
 *   3. Kaca meter berembun, berlumpur, dan tergores. Sebagian foto lapangan
 *      memang tidak terbaca, dan itu keadaan normal, bukan kerusakan.
 *
 * Stand yang salah masuk ke tagihan pelanggan dan baru ketahuan sebulan
 * kemudian, jadi ongkos satu ketukan konfirmasi jauh lebih murah daripada
 * ongkos satu angka yang salah.
 */
/*
 * TIPE DIIMPOR, FUNGSINYA TIDAK — dan itu bukan gaya penulisan melainkan
 * perbaikan atas cacat nyata.
 *
 * Pustaka ML Kit memanggil `requireNativeModule()` di LINGKUP ATAS berkasnya,
 * jadi `import { recognizeText }` biasa akan MELEMPAR saat modul dimuat bila
 * binernya belum memuat modul native itu — bukan saat fungsinya dipanggil.
 * Akibatnya seluruh layar catat gagal dimuat gara-gara fitur tambahan, dan
 * `try/catch` di dalam fungsi di bawah tidak bisa menangkapnya sama sekali.
 * Itu persis yang terjadi saat JS baru berjalan di atas biner lama.
 *
 * `import type` DIHAPUS saat kompilasi sehingga tidak menyentuh apa pun di
 * runtime, dan fungsinya diambil malas di dalam try/catch. Dengan begitu
 * kegagalan OCR turun pangkat jadi "tidak ada usulan" — pencatatan manual yang
 * selama ini sudah jalan tidak boleh ikut mati karena penambahnya gagal.
 */
import type { Text, TextElement } from '@infinitered/react-native-mlkit-text-recognition';

type FungsiOcr = (imagePath: string) => Promise<Text>;

/** null = belum dicoba; false = modul native tidak ada di biner ini. */
let ocr: FungsiOcr | false | null = null;

function ambilOcr(): FungsiOcr | false {
  if (ocr !== null) return ocr;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modul = require('@infinitered/react-native-mlkit-text-recognition') as {
      recognizeText: FungsiOcr;
    };
    ocr = modul.recognizeText;
  } catch {
    ocr = false;
  }
  return ocr;
}

/** Satu usulan angka beserta alasan ia diurutkan di posisi itu. */
export interface UsulanStand {
  /** Angka yang akan mengisi kolom stand bila diketuk. */
  nilai: string;
  /** Tinggi cetakannya di foto (piksel) — dasar pengurutan. */
  tinggi: number;
}

/**
 * Deret angka terpanjang yang masuk akal sebagai stand. Meter di sini
 * berkisar 3–8 digit; di bawah itu biasanya potongan tanggal atau nomor
 * kecil di badan meter, di atas itu hampir pasti nomor seri.
 */
const MIN_DIGIT = 3;
const MAKS_DIGIT = 8;

/** Ambil semua deret angka murni dari sepotong teks. */
function deretAngka(teks: string): string[] {
  return teks.match(/\d+/g) ?? [];
}

/**
 * Urutkan usulan menurut TINGGI CETAKANNYA DI FOTO, bukan panjang deretnya.
 *
 * Inilah bagian yang membuat usulannya berguna. Pada foto meter yang diambil
 * dari depan, register utama adalah cetakan TERBESAR di bingkai — nomor seri,
 * merek, dan tulisan "m³" semuanya jauh lebih kecil. Mengurutkan berdasarkan
 * panjang deret akan menempatkan nomor seri 8 digit di atas stand 5 digit,
 * dan itu justru usulan yang paling sering salah.
 */
function tinggiElemen(e: TextElement): number {
  return Math.max(0, e.frame.bottom - e.frame.top);
}

/**
 * Baca foto, kembalikan usulan angka terurut dari yang paling mungkin.
 * Larik kosong = tidak ada yang terbaca, dan itu bukan galat.
 *
 * TIDAK PERNAH MELEMPAR. Kegagalan OCR tidak boleh menghalangi pencatatan
 * manual yang selama ini sudah jalan — fitur ini menambah, bukan menggantikan.
 */
export async function usulkanStand(uriFoto: string): Promise<UsulanStand[]> {
  const recognizeText = ambilOcr();
  if (recognizeText === false) return [];

  try {
    const hasil = await recognizeText(uriFoto);

    const kandidat = new Map<string, number>();
    for (const blok of hasil.blocks) {
      for (const baris of blok.lines) {
        for (const elemen of baris.elements) {
          const tinggi = tinggiElemen(elemen);
          for (const angka of deretAngka(elemen.text)) {
            if (angka.length < MIN_DIGIT || angka.length > MAKS_DIGIT) continue;
            // Angka yang sama terbaca di beberapa tempat: simpan yang
            // cetakannya paling besar, karena itu yang paling mungkin register
            // utamanya dan bukan pantulan atau cetakan kecil di badan meter.
            const sebelumnya = kandidat.get(angka) ?? 0;
            if (tinggi > sebelumnya) kandidat.set(angka, tinggi);
          }
        }
      }
    }

    return [...kandidat.entries()]
      .map(([nilai, tinggi]) => ({ nilai, tinggi }))
      .sort((a, b) => b.tinggi - a.tinggi)
      // Empat sudah lebih dari cukup: daftar panjang berarti petugas membaca
      // ulang seluruh angka di meter dari layar, yang lebih lambat daripada
      // mengetiknya sendiri.
      .slice(0, 4);
  } catch {
    return [];
  }
}
