/** Rute /pelanggan-rute?kodeRute= — daftar pelanggan satu rute. */
import { router, useLocalSearchParams } from 'expo-router';
import { PelangganRuteScreen } from '@/features/pencatat/PelangganRute';

export default function PelangganRute() {
  const { kodeRute } = useLocalSearchParams<{ kodeRute: string }>();
  return (
    <PelangganRuteScreen
      kodeRute={kodeRute ?? ''}
      onBack={() => router.back()}
      /*
       * Mengetuk alamat membuka INFO PELANGGAN dulu, bukan langsung layar
       * catat. Petugas sampai di depan rumah dan memastikan rumahnya benar —
       * identitas, no. meter, histori tiga bulan — sebelum mengetik angka.
       * Dari sana tombol Lanjutkan yang membawanya ke pencatatan.
       */
      onBukaCatat={(nomorLangganan) =>
        router.push({
          pathname: '/InfoPelanggan',
          params: { nomorLangganan, kodeRute: kodeRute ?? '' },
        })
      }
    />
  );
}
