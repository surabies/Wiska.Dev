/**
 * Rute /Masuk — Layar Masuk Terpadu (Unified Login).
 * Mendukung autentikasi seluruh peran: Pencatat Meter, Teknisi Gangguan, Supervisor, dan Warga.
 */
import { router } from 'expo-router';
import { MasukTerpaduScreen } from '@/features/shared/MasukTerpadu';

export default function Masuk() {
  return <MasukTerpaduScreen onSukses={() => router.replace('/')} />;
}
