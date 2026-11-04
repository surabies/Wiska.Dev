/**
 * daftar-screen.tsx — layar penuh "Daftar Akun" (padanan daftar_warga_screen.dart):
 * chrome halaman di sekitar DaftarWargaForm. Sukses → Laporan Saya; tautan
 * masuk → ganti ke layar Masuk.
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { AppScaffold } from '@/components';

import { tandaiSesiBerubah } from '@/features/shared/SesiStore';
import { DaftarWargaForm } from './components/DaftarForm';

export function DaftarWargaScreen() {
  const router = useRouter();
  return (
    <AppScaffold
      title="Daftar Akun"
      subtitle="Supaya laporan Anda tersimpan otomatis"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <DaftarWargaForm
            onSukses={() => {
              tandaiSesiBerubah();
              router.replace('/LaporanSaya');
            }}
            onTukarKeMasuk={() => router.replace('/Masuk')}
          />
        </ScrollView>
      }
    />
  );
}

const styles = StyleSheet.create({ scroll: { padding: 16, paddingBottom: 48 } });
