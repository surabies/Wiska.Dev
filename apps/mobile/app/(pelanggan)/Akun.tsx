/** Rute /akun — identitas petugas, versi aplikasi, dan keluar. */
import { router } from 'expo-router';
import { AkunScreen } from '@/features/pelanggan/AkunWarga';

export default function Akun() {
  return (
    <AkunScreen
      onBack={() => router.back()}
      onKeluar={() => router.replace('/Masuk')}
      onBukaPengaturanApi={() => router.push('/PengaturanApi')}
    />
  );
}
