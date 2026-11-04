/**
 * langganan-saya-section.tsx — blok "Langganan Saya" di beranda (padanan
 * widgets/langganan_saya_section.dart): kartu biodata langganan, digeser
 * horizontal bila lebih dari satu. Hanya tampil saat login — beranda anonim
 * tidak berubah.
 *
 * Data lewat LanggananSayaCache (sekali fetch per sesi); layar Kelola yang
 * menyegarkannya setelah mutasi.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/card';
import { SectionHeader, useTheme } from '@/components';
import { ApiException, SesiWarga } from '@workspace/mobile-core';

import { KartuLangganan } from './KartuLangganan';
import { LanggananSayaCache, type LanggananWargaModel } from '../lib/RepositoryLangganan';

const LEBAR = Dimensions.get('window').width;

export function LanggananSayaSection() {
  const router = useRouter();
  const { colors } = useTheme();
  const [data, setData] = useState<LanggananWargaModel[] | null>(LanggananSayaCache.data);
  const [galat, setGalat] = useState<string | null>(null);

  // Muat ulang tiap tab Beranda difokuskan — supaya kartu MUNCUL setelah login
  // di tab Akun lalu kembali ke Beranda (tab lama tidak re-mount, `useEffect`
  // sekali-jalan tidak cukup). Logout → data dikosongkan.
  useFocusEffect(
    useCallback(() => {
      let hidup = true;
      if (!SesiWarga.sudahMasuk) {
        setData(null);
        return;
      }
      setGalat(null);
      LanggananSayaCache.muat()
        .then((d) => hidup && setData(d))
        .catch((e) => hidup && setGalat(ApiException.is(e) ? e.message : 'Gagal memuat.'));
      return () => {
        hidup = false;
      };
    }, []),
  );

  if (!SesiWarga.sudahMasuk) return null;

  if (galat != null) {
    return (
      <Card className="gap-0" style={styles.galatCard}>
        <Text style={[styles.galatTeks, { color: colors.mutedForeground }]}>{galat}</Text>
      </Card>
    );
  }

  if (data == null || data.length === 0) return <View style={styles.penahan} />;

  return (
    <View style={styles.wrap}>
      <SectionHeader
        judul="Langganan Saya"
        aksi={
          <Text onPress={() => router.push('/KelolaLangganan')} style={[styles.kelola, { color: colors.primary }]} suppressHighlighting>
            Kelola
          </Text>
        }
      />
      {data.length === 1 ? (
        <KartuLangganan langganan={data[0]} onPress={() => router.push('/KelolaLangganan')} />
      ) : (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} snapToInterval={LEBAR - 36 + 12} decelerationRate="fast">
          {data.map((l, i) => (
            <View key={l.id} style={[styles.slide, { width: LEBAR - 36 }, i < data.length - 1 && styles.slideGap]}>
              <KartuLangganan langganan={l} onPress={() => router.push('/KelolaLangganan')} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },
  penahan: { height: 0 },
  galatCard: { padding: 14, marginBottom: 20 },
  galatTeks: { fontSize: 13 },
  kelola: { fontSize: 13, fontWeight: '600' },
  slide: {},
  slideGap: { marginRight: 12 },
});
