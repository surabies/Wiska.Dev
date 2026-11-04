/**
 * Tab Rute — pilih rute yang dikerjakan hari ini.
 *
 * `onBack` sengaja tidak dioper: ini tab akar, tidak ada tempat untuk kembali.
 */
import { router } from 'expo-router';
import { DaftarRuteScreen } from '@/features/pencatat/DaftarRute';

export default function Rute() {
  return (
    <DaftarRuteScreen
      onBukaRute={(kodeRute) =>
        router.push({ pathname: '/PelangganRute', params: { kodeRute } })
      }
      // Antrean punya tabnya sendiri di dock — pindah tab, bukan menumpuk layar.
      onBukaAntrean={() => router.navigate('/Upload')}
    />
  );
}
