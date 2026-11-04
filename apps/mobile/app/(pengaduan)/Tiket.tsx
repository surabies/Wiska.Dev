/** Rute /tiket?id= — detail tiket & tindak lanjut. */
import { router, useLocalSearchParams } from 'expo-router';
import { TiketScreen } from '@/features/pengaduan/PenangananTiketGangguan';

export default function Tiket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TiketScreen id={id ?? ''} onBack={() => router.back()} />;
}
