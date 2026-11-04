/**
 * cek-tagihan-screen.tsx — Cek Tagihan (publik, tanpa login). Padanan
 * features/public/cek_tagihan/cek_tagihan_screen.dart.
 *
 * Identitas cukup nomor langganan persis 11 digit; hasil menampilkan maksimal
 * 12 periode terakhir plus ringkasan tunggakan.
 *
 * Validasi form Flutter (ShadForm + validator) diganti state controlled: nomor
 * disaring digit-only saat mengetik, pesan galat dihitung saat submit.
 *
 * CATATAN: prefill nomor langganan UTAMA (LanggananSayaCache.utama di Flutter)
 * menyusul saat modul Langganan diport — untuk kini form mulai kosong.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Text as UIText } from '@/components/ui/text';
import { AppScaffold, useTheme } from '@/components';
import { ApiException, type CekTagihanResult } from '@workspace/mobile-core';

import { buatCekTagihanRepository } from './lib/RepositoryCekTagihan';
import { HasilCekTagihanView } from './components/HasilCekTagihan';

export function CekTagihanScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  // Repository dibuat sekali per mount (bukan tiap render).
  const [repo] = useState(buatCekTagihanRepository);

  const [nomor, setNomor] = useState('');
  const [galatInput, setGalatInput] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<CekTagihanResult | null>(null);

  const cek = async () => {
    if (nomor.length !== 11) {
      setGalatInput('Nomor langganan harus tepat 11 digit angka.');
      return;
    }
    setGalatInput(null);
    setMemuat(true);
    setGalat(null);
    setHasil(null);
    try {
      setHasil(await repo.cekTagihan(nomor));
    } catch (e) {
      // Pesan ApiException sudah bahasa Indonesia & siap tampil.
      setGalat(ApiException.is(e) ? e.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setMemuat(false);
    }
  };

  return (
    <AppScaffold
      title="Cek Tagihan"
      subtitle="Informasi rekening air Anda"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card>
            <CardHeader>
              <CardTitle>Nomor Langganan</CardTitle>
              <CardDescription>
                Masukkan 11 digit nomor langganan sesuai yang tertera pada rekening air Anda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <View style={styles.form}>
                <Field
                  value={nomor}
                  // Saring hanya digit + batasi 11 (padanan inputFormatters Flutter).
                  onChangeText={(t) => setNomor(t.replace(/\D/g, '').slice(0, 11))}
                  placeholder="Contoh: 00000100119"
                  keyboardType="number-pad"
                  maxLength={11}
                  error={galatInput}
                />
                <Button onPress={cek} disabled={memuat} className="h-11 w-full">
                  {memuat ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Ionicons name="search" size={16} color={colors.primaryForeground} />
                  )}
                  <UIText>{memuat ? 'Memeriksa…' : 'Cek Tagihan'}</UIText>
                </Button>
              </View>
            </CardContent>
          </Card>

          {galat != null ? (
            <View style={styles.spacer}>
              <Alert icon={TriangleAlert} variant="destructive">
                <AlertTitle>Pemeriksaan gagal</AlertTitle>
                <AlertDescription>{galat}</AlertDescription>
              </Alert>
            </View>
          ) : null}

          {hasil != null ? (
            <View style={styles.spacer}>
              <HasilCekTagihanView hasil={hasil} />
            </View>
          ) : null}
        </ScrollView>
      }
    />
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  form: { marginTop: 12, gap: 12 },
  spacer: { marginTop: 16 },
});
