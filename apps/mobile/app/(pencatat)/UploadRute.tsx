/** Rute /upload-rute?kodeRute= — isi antrean satu rute, tempat menandai. */
import { router, useLocalSearchParams } from 'expo-router';
import { AntreanRuteScreen } from '@/features/pencatat/AntreanRute';
import { TANPA_RUTE } from '@/features/pencatat/lib/RuteAntrean';

export default function UploadRute() {
  const { kodeRute } = useLocalSearchParams<{ kodeRute: string }>();
  return <AntreanRuteScreen kodeRute={kodeRute ?? TANPA_RUTE} onBack={() => router.back()} />;
}
