/**
 * media.ts — helper pengambilan foto/video bukti (kamera/galeri) dipakai
 * bersama layar Lapor Pengaduan & Lapor Meter. Membungkus `expo-image-picker`
 * (SDK 57: `mediaTypes: ['images'|'videos']`) + kompresi foto dari mobile-core.
 *
 * Padanan gabungan logika `_ambilFoto`/`_ambilVideo` yang di Flutter tersebar
 * di tiap layar — di sini dipusatkan agar konsisten.
 */
import * as ImagePicker from 'expo-image-picker';
import { kompresFoto } from '@workspace/mobile-core';

export type SumberMedia = 'kamera' | 'galeri';

/** Dilempar bila kamera tak tersedia/izin ditolak — layar menampilkan pesan. */
export class MediaError extends Error {}

async function pastikanIzinKamera(): Promise<void> {
  const izin = await ImagePicker.requestCameraPermissionsAsync();
  if (!izin.granted) {
    throw new MediaError('Izin kamera diperlukan — gunakan pilihan Galeri.');
  }
}

/**
 * Ambil satu foto lalu kompres ke anggaran ukuran (lihat `kompresFoto`).
 * Mengembalikan URI hasil, atau null bila pengguna membatalkan.
 *
 * `quality: 1` pada picker DISENGAJA: biarkan picker menyerahkan gambar
 * seutuhnya, lalu satu tempat saja — `kompresFoto` — yang memutuskan ukuran
 * akhirnya. Mengompres dua kali hanya menumpuk artefak tanpa menghemat byte.
 */
export async function ambilFoto(
  sumber: SumberMedia,
  opts?: {
    lebarTarget?: number;
    anggaranByte?: number;
    /**
     * Diselipkan ANTARA pengambilan dan kompresi — tempatnya menempelkan cap
     * watermark. Urutannya penting: cap yang dipasang SESUDAH kompresi akan
     * menambah byte di belakang punggung anggaran ukuran, padahal seluruh
     * gagasan `kompresFoto` adalah menjadi satu-satunya yang memutuskan
     * ukuran akhir. Mengembalikan URI baru; galat di dalamnya adalah urusan
     * pemanggil (cap boleh gagal, foto tidak boleh hilang karenanya).
     */
    praProses?: (uri: string) => Promise<string>;
  },
): Promise<string | null> {
  try {
    if (sumber === 'kamera') await pastikanIzinKamera();
    const hasil =
      sumber === 'kamera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (hasil.canceled || hasil.assets.length === 0) return null;
    const asli = hasil.assets[0].uri;
    const siap = opts?.praProses != null ? await opts.praProses(asli) : asli;
    const dikompres = await kompresFoto({
      sumberUri: siap,
      lebarTarget: opts?.lebarTarget,
      anggaranByte: opts?.anggaranByte,
    });
    return dikompres.uri;
  } catch (e) {
    if (e instanceof MediaError) throw e;
    throw new MediaError('Kamera tidak tersedia di perangkat ini — gunakan pilihan Galeri.');
  }
}

/**
 * Ambil klip video (maks 60 detik). Kompresi/optimasi dilakukan server —
 * transcoding berat di HP dihindari. Mengembalikan URI, atau null bila batal.
 */
export async function ambilVideo(sumber: SumberMedia): Promise<string | null> {
  try {
    if (sumber === 'kamera') await pastikanIzinKamera();
    const hasil =
      sumber === 'kamera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
    if (hasil.canceled || hasil.assets.length === 0) return null;
    return hasil.assets[0].uri;
  } catch (e) {
    if (e instanceof MediaError) throw e;
    throw new MediaError('Kamera video tidak tersedia — coba pilih dari Galeri.');
  }
}
