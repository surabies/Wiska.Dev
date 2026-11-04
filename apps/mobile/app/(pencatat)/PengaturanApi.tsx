/**
 * Rute /pengaturan-api — SENGAJA tidak ditautkan dari menu mana pun. Satu-
 * satunya jalan masuk: ketuk "Versi aplikasi" 7x di layar Akun. Lihat
 * features/pengaturan/pengaturan-api-screen.tsx.
 */
import { router } from 'expo-router';
import { PengaturanApiScreen } from '@/features/pencatat/PengaturanApi';

export default function PengaturanApi() {
  return (
    <PengaturanApiScreen
      onSelesai={() => router.replace('/Masuk')}
      onBack={() => router.back()}
    />
  );
}
