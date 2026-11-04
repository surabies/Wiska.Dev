/**
 * masuk-screen.tsx — layar penuh "Masuk" (padanan masuk_warga_screen.dart):
 * chrome halaman (AppScaffold) di sekitar MasukWargaForm. Sukses → Laporan
 * Saya; tautan daftar → ganti ke layar Daftar.
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { AppScaffold } from '@/components';

import { tandaiSesiBerubah } from '@/features/shared/SesiStore';
import { MasukWargaForm } from './components/MasukForm';

export function MasukWargaScreen() {
  const router = useRouter();
  return (
    <AppScaffold
      title="Masuk"
      subtitle="Akun warga — pantau semua laporan Anda"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <MasukWargaForm
            onSukses={() => {
              tandaiSesiBerubah();
              router.replace('/LaporanSaya');
            }}
            onTukarKeDaftar={() => router.replace('/Daftar')}
          />
        </ScrollView>
      }
    />
  );
}

const styles = StyleSheet.create({ scroll: { padding: 16, paddingBottom: 48 } });
