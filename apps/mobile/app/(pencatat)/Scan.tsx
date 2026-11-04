/**
 * Rute /scan — pemindai kode pelanggan, dibuka dari tombol tengah dock.
 *
 * `replace` ke /catat, bukan `push`: setelah kode ketemu, pemindai tidak boleh
 * tertinggal di tumpukan. Kalau tidak, menekan kembali dari layar catat akan
 * menyalakan kamera lagi dan langsung memindai kode yang sama.
 */
import { router } from 'expo-router';
import { ScanScreen } from '@/features/pencatat/ScanMeter';

export default function Scan() {
  return (
    <ScanScreen
      onTutup={() => router.back()}
      onKetemu={(nomorLangganan) =>
        router.replace({ pathname: '/Catat', params: { nomorLangganan } })
      }
    />
  );
}
