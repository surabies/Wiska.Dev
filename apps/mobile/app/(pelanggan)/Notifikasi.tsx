/** Rute /notifikasi — inbox notifikasi petugas. */
import { router } from 'expo-router';
import { NotifikasiScreen } from '@/features/pelanggan/NotifikasiWarga';

export default function Notifikasi() {
  return <NotifikasiScreen onBack={() => router.back()} />;
}
