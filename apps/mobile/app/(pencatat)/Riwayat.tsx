/** Rute /riwayat — hasil catat saya periode berjalan. */
import { router } from 'expo-router';
import { RiwayatScreen } from '@/features/pencatat/RiwayatCatat';

export default function Riwayat() {
  return <RiwayatScreen onBack={() => router.back()} />;
}
