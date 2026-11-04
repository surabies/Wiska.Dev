/**
 * akun-tab-content.tsx — konten tab "Akun" (padanan akun_tab_content.dart).
 * TANPA back-chevron (shell tab yang menyediakan chrome). Mengelola toggle
 * masuk/daftar lewat state lokal, dan menampilkan profil + tombol keluar
 * begitu login.
 *
 * Setiap perubahan sesi memanggil `tandaiSesiBerubah()` supaya tab lain
 * (Beranda) ikut membaca ulang status login.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text as UIText } from '@/components/ui/text';
import { PremiumBackground, useTheme } from '@/components';
import { SesiWarga } from '@workspace/mobile-core';

import { LanggananSayaCache } from '../lib/RepositoryLangganan';
import { tandaiSesiBerubah, useSesiVersi } from '@/features/shared/SesiStore';
import { LaporanSayaCache } from '../lib/RepositoryLaporanWarga';
import { DaftarWargaForm } from './DaftarForm';
import { MasukWargaForm } from './MasukForm';

export function AkunTabContent() {
  const router = useRouter();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  useSesiVersi(); // Render ulang saat sesi berubah.
  const [modeDaftar, setModeDaftar] = useState(false);

  const akun = SesiWarga.akun;

  const keluar = async () => {
    await SesiWarga.keluar();
    // Langganan & tiket milik sesi yang berakhir — jangan terbaca akun berikut.
    LanggananSayaCache.reset();
    LaporanSayaCache.reset();
    tandaiSesiBerubah();
  };

  return (
    <PremiumBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled">
        {akun != null ? (
          <Card className="gap-0" style={styles.profilCard}>
            <View style={styles.profilRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary, borderRadius: radius.md }]}>
                <Ionicons name="person" size={24} color={colors.primaryForeground} />
              </View>
              <View style={styles.profilTeks}>
                <Text style={[styles.nama, { color: colors.foreground }]}>{akun.name}</Text>
                {akun.email != null ? (
                  <Text style={[styles.email, { color: colors.mutedForeground }]} numberOfLines={1}>{akun.email}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.profilAksi}>
              <Button variant="outline" onPress={() => router.push('/KelolaLangganan')} className="h-11 w-full">
                <Ionicons name="card-outline" size={16} color={colors.foreground} />
                <UIText>Kelola Nomor Langganan</UIText>
              </Button>
              <Button variant="outline" onPress={keluar} className="h-11 w-full">
                <Ionicons name="log-out-outline" size={16} color={colors.foreground} />
                <UIText>Keluar</UIText>
              </Button>
            </View>
          </Card>
        ) : (
          <View style={styles.authWrap}>
            <Text style={[styles.judul, { color: colors.foreground }]}>{modeDaftar ? 'Daftar Akun' : 'Masuk'}</Text>
            <Text style={[styles.subjudul, { color: colors.mutedForeground }]}>
              {modeDaftar
                ? 'Tautkan nomor langganan Anda — biodata & tunggakan tampil di beranda, laporan tersimpan otomatis.'
                : 'Pantau semua laporan pengaduan yang pernah Anda kirim.'}
            </Text>
            <View style={styles.formWrap}>
              {modeDaftar ? (
                <DaftarWargaForm onSukses={() => tandaiSesiBerubah()} onTukarKeMasuk={() => setModeDaftar(false)} />
              ) : (
                <MasukWargaForm onSukses={() => tandaiSesiBerubah()} onTukarKeDaftar={() => setModeDaftar(true)} />
              )}
            </View>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 120 },
  profilCard: { padding: 20 },
  profilRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  profilTeks: { flex: 1, marginLeft: 14 },
  nama: { fontSize: 17, fontWeight: '700' },
  email: { fontSize: 13, marginTop: 2 },
  profilAksi: { marginTop: 20, gap: 10 },
  authWrap: { gap: 4 },
  judul: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subjudul: { fontSize: 14, lineHeight: 20 },
  formWrap: { marginTop: 20 },
});
