/** Rute /info-tagihan — cek rekening pelanggan di lokasi. */
import { router } from 'expo-router';
import { InfoTagihanScreen } from '@/features/pelanggan/InfoTagihan';

export default function InfoTagihan() {
  return <InfoTagihanScreen onBack={() => router.back()} />;
}
