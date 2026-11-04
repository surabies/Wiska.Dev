/**
 * watermark.ts — cap resmi pada foto bukti (stand, segel, rumah).
 *
 * KENAPA DIBAKAR KE PIKSEL, BUKAN DISIMPAN SEBAGAI METADATA. Foto bukti hidup
 * lebih lama daripada basis data yang menemaninya: ia diunduh verifikator,
 * ditempel di berkas sengketa, dikirim lewat WhatsApp saat pelanggan
 * menyanggah. EXIF hilang di hampir setiap perjalanan itu, sedangkan piksel
 * ikut ke mana pun gambarnya pergi. Yang perlu bertahan justru tiga hal
 * termurah itu: rumah siapa, kapan, dan oleh lembaga mana.
 *
 * PITA DI TEPI BAWAH, bukan blok di pojok. Roda angka meter hampir selalu ada
 * di tengah bingkai — itulah yang dipotret petugas — dan cap di pojok mana pun
 * berisiko menimpanya tergantung sudut pengambilan, yang tidak bisa
 * dikendalikan dari sini. Pita bawah selebar foto tidak pernah menutupi
 * subjeknya, dan sekaligus terbaca sebagai stempel resmi alih-alih coretan.
 *
 * DIPASANG SEBELUM KOMPRESI. `kompresFoto` adalah SATU-SATUNYA tempat yang
 * memutuskan ukuran akhir berkas (lihat catatannya di media.ts), dan menempel
 * cap sesudahnya berarti menambah byte di belakang punggung anggaran itu.
 * Ukuran hurufnya karena itu ditulis sebagai RASIO terhadap lebar gambar,
 * bukan piksel tetap: foto 4000 px dan 1200 px harus menghasilkan pita yang
 * sama proporsinya setelah keduanya diperkecil.
 */
import Marker, {
  ImageFormat,
  Position,
  TextBackgroundType,
  type WatermarkLayer,
} from 'react-native-image-marker';

/*
 * LOGO WAJIB PNG BERALFA. `icon-logo.png` — pilihan pertama yang tampak
 * masuk akal karena ia ikon aplikasinya — ternyata bertipe warna RGB TANPA
 * kanal alfa, sehingga latar putihnya adalah bagian dari gambar itu sendiri
 * dan tercetak sebagai kotak putih di atas foto. `trimTransparentPadding`
 * tidak bisa berbuat apa-apa terhadapnya: tidak ada transparansi untuk
 * dipangkas. `logo.png` bertipe RGBA dan mereknya mengisi penuh bingkainya.
 *
 * Bila suatu saat aset ini diganti, PERIKSA COLOR TYPE-nya lebih dulu — cacat
 * ini tidak terlihat di penampil gambar mana pun, karena penampil menggambar
 * latar putih untuk yang transparan maupun yang benar-benar putih.
 */
const LOGO = require('../../assets/images/logo.png');

/**
 * Tinggi huruf sebagai pecahan lebar gambar. 1,8% memberi ±22 px pada foto
 * 1200 px — masih terbaca setelah gambar dikecilkan untuk dikirim lewat
 * pesan, dan cukup kecil untuk tidak merebut perhatian dari angka meternya.
 */
const RASIO_HURUF = 0.018;

/** Lebar logo sebagai pecahan lebar gambar. */
const RASIO_LOGO = 0.055;

/**
 * Jarak teks kiri dari tepi, sebagai pecahan lebar gambar. Harus melebihi
 * RASIO_LOGO supaya teksnya bermula SESUDAH logo, bukan di atasnya.
 */
const RASIO_GESER_TEKS = 0.09;

/** Warna pita: slate900 pada 80% — gelap cukup untuk teks putih di atas
 *  foto siang yang terang, tembus cukup untuk tidak menghapus isinya. */
const WARNA_PITA = '#0F172ACC';

export interface IsiWatermark {
  nomorLangganan: string;
  nama: string;
  /** Saat foto diambil. Dioper, tidak diambil sendiri di sini, supaya ketiga
   *  foto satu kunjungan bisa memakai stempel waktu yang sama persis. */
  waktu: Date;
}

/** "4 Agu 2026" dan "21.30" — dua baris, sejajar dengan dua baris di kiri. */
function barisWaktu(waktu: Date): string {
  const tanggal = waktu.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const jam = waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${tanggal}\n${jam}`;
}

/**
 * Tempel cap ke satu foto. Mengembalikan URI hasil.
 *
 * GAGAL DENGAN MENGEMBALIKAN FOTO ASLINYA, bukan melempar. Cap adalah
 * penambah nilai, sementara fotonya sendiri adalah buktinya — kehilangan bukti
 * karena penambahnya gagal adalah pertukaran yang salah, dan petugas di depan
 * pagar tidak punya cara memperbaiki kegagalan pustaka gambar.
 */
export async function tempelWatermark(uri: string, isi: IsiWatermark): Promise<string> {
  try {
    const info = await Marker.getImageInfo(uri);
    const lebar = info.width > 0 ? info.width : 1200;
    const ukuranHuruf = Math.round(lebar * RASIO_HURUF);
    const geserTeks = Math.round(lebar * RASIO_GESER_TEKS);
    const sisiLogo = Math.round(lebar * RASIO_LOGO);

    /*
     * Kedua teks sengaja SAMA-SAMA DUA BARIS dengan ukuran huruf yang sama.
     * Tingginya jadi identik, sehingga keduanya duduk sejajar di dalam pita
     * tanpa perlu menghitung offset vertikal yang akan meleset begitu nama
     * pelanggan atau format tanggalnya berubah panjang.
     */
    const lapisan: WatermarkLayer[] = [
      {
        type: 'text',
        // Lapisan inilah yang MENGGAMBAR pitanya (stretchX = selebar foto),
        // jadi ia harus digambar pertama — dua lapisan sesudahnya duduk di
        // atasnya.
        text: `${isi.nomorLangganan}\n${isi.nama}`,
        position: { position: Position.bottomLeft, X: geserTeks, edgeInset: 0 },
        style: {
          color: '#FFFFFF',
          fontSize: ukuranHuruf,
          textBackgroundStyle: {
            type: TextBackgroundType.stretchX,
            color: WARNA_PITA,
            paddingY: Math.round(ukuranHuruf * 0.45),
          },
          maxLines: 2,
          overflow: 'ellipsis',
          // Nama panjang dipotong di ujungnya, bukan mendorong kolom tanggal
          // keluar dari foto.
          maxWidth: '55%',
        },
      },
      {
        type: 'text',
        text: barisWaktu(isi.waktu),
        position: {
          position: Position.bottomRight,
          X: Math.round(lebar * 0.03),
          edgeInset: 0,
        },
        style: { color: '#FFFFFF', fontSize: ukuranHuruf, maxLines: 2 },
      },
      {
        type: 'image',
        src: LOGO,
        position: { position: Position.bottomLeft, X: Math.round(lebar * 0.025), edgeInset: 0 },
        // Logo PNG punya bantalan transparan di sekelilingnya; tanpa
        // pemangkasan ini ia tampak jauh lebih kecil dari ruang yang dipakainya.
        trimTransparentPadding: true,
        // logo.png berukuran 512 px; skala = lebar target dibagi lebar aslinya.
        scale: sisiLogo / 512,
      },
    ];

    const hasil = await Marker.mark({
      backgroundImage: { src: uri },
      watermarks: lapisan,
      // Kualitas tinggi DISENGAJA: berkas ini masih akan melewati kompresFoto
      // yang punya anggaran byte sendiri. Menekan mutu dua kali hanya menumpuk
      // artefak tanpa menghemat apa pun.
      quality: 95,
      saveFormat: ImageFormat.jpg,
    });

    return typeof hasil === 'string' ? hasil : (hasil.uri ?? uri);
  } catch {
    return uri;
  }
}
