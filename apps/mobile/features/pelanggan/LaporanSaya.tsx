/**
 * laporan-saya-screen.tsx — daftar tiket pengaduan milik akun yang login
 * (padanan laporan_saya_screen.dart). Baris diklik → /lacak-tiket?nomor=…
 * (layar itu sudah punya seluruh detail + aksi; tidak diduplikasi di sini).
 *
 * Memuat via LaporanSayaCache (blok Tiket Aktif beranda membaca daftar yang
 * sama). 401 = sesi berakhir → arahkan masuk.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Text as UIText } from '@/components/ui/text';
import {
  AppScaffold,
  GlassPanel,
  IconButton,
  StatusBadge,
  toneStatusPengaduan,
  useTheme,
} from '@/components';
import {
  ApiException,
  formatWaktuLokal,
  labelDari,
  labelJenisPengaduan,
  labelStatusPengaduanWarga,
  SesiWarga,
  type ComplaintTicketModel,
} from '@workspace/mobile-core';

import { tandaiSesiBerubah, useSesiVersi } from '@/features/shared/SesiStore';
import { LaporanSayaCache } from './lib/RepositoryLaporanWarga';

export function LaporanSayaScreen({ tab = false }: { tab?: boolean } = {}) {
  const router = useRouter();
  const { colors } = useTheme();
  useSesiVersi(); // Tab: ikut berubah saat login/keluar.
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<ApiException | Error | null>(null);
  const [tiket, setTiket] = useState<ComplaintTicketModel[]>([]);

  const muat = useCallback(async (paksa: boolean) => {
    if (!SesiWarga.sudahMasuk) {
      setMemuat(false);
      return;
    }
    setMemuat(true);
    setGalat(null);
    try {
      setTiket(await LaporanSayaCache.muat(paksa));
    } catch (e) {
      setGalat(e instanceof Error ? e : new Error('Gagal memuat.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat(false);
  }, [muat]);

  const perluMasuk = () => router.replace('/Masuk');

  const keluar = async () => {
    await SesiWarga.keluar();
    tandaiSesiBerubah();
    perluMasuk();
  };

  const tidakSah = ApiException.is(galat) && galat.isUnauthorized;
  const akun = SesiWarga.akun;
  const kembali = tab ? undefined : () => router.back();

  // Anonim (umum di mode tab): ajak masuk alih-alih membiarkan 401.
  if (akun == null) {
    return (
      <AppScaffold
        title="Laporan Saya"
        subtitle="Riwayat pengaduan Anda"
        onBack={kembali}
        body={
          <View style={styles.center}>
            <Ionicons name="lock-closed" size={40} color={colors.mutedForeground} />
            <Text style={[styles.kosong, { color: colors.mutedForeground }]}>
              Masuk untuk melihat semua laporan pengaduan yang Anda kirim.
            </Text>
            <View style={styles.retry}>
              <Button onPress={() => (tab ? router.navigate('/Akun') : router.replace('/Masuk'))} className="h-11 w-full">
                <Ionicons name="log-in" size={16} color={colors.primaryForeground} />
                <UIText>Masuk / Daftar</UIText>
              </Button>
            </View>
          </View>
        }
      />
    );
  }

  return (
    <AppScaffold
      title="Laporan Saya"
      subtitle={akun.name ?? 'Riwayat pengaduan Anda'}
      onBack={kembali}
      trailing={<IconButton name="log-out-outline" onPress={keluar} color={colors.systemBlue} />}
      body={
        memuat ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : galat != null ? (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Alert icon={TriangleAlert} variant="destructive">
              <AlertTitle>{tidakSah ? 'Sesi berakhir' : 'Gagal memuat laporan'}</AlertTitle>
              <AlertDescription>
                {tidakSah
                  ? 'Sesi Anda sudah berakhir — masuk kembali untuk melihat laporan Anda.'
                  : ApiException.is(galat)
                    ? galat.message
                    : 'Terjadi kesalahan tak terduga.'}
              </AlertDescription>
            </Alert>
            <View style={styles.retry}>
              <Button
                variant="outline"
                className="h-11 w-full"
                onPress={tidakSah ? perluMasuk : () => muat(true)}
              >
                <Ionicons name={tidakSah ? 'log-in' : 'refresh'} size={16} color={colors.foreground} />
                <UIText>{tidakSah ? 'Masuk Lagi' : 'Coba Lagi'}</UIText>
              </Button>
            </View>
          </ScrollView>
        ) : tiket.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="file-tray" size={40} color={colors.mutedForeground} />
            <Text style={[styles.kosong, { color: colors.mutedForeground }]}>
              Belum ada laporan yang tertaut ke akun ini. Pengaduan yang Anda kirim saat sedang masuk akan muncul di sini.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.list}>
              {tiket.map((t) => (
                <KartuTiketSaya key={t.id} tiket={t} onPress={() => router.push(`/LacakTiket?nomor=${t.nomorTiket}`)} />
              ))}
            </View>
          </ScrollView>
        )
      }
    />
  );
}

function KartuTiketSaya({ tiket, onPress }: { tiket: ComplaintTicketModel; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <GlassPanel>
        <View style={styles.kartuHead}>
          <Text style={[styles.nomor, { color: colors.mutedForeground }]}>{tiket.nomorTiket}</Text>
          <StatusBadge label={labelDari(labelStatusPengaduanWarga, tiket.status)} tone={toneStatusPengaduan(tiket.status)} />
        </View>
        <Text style={[styles.judul, { color: colors.foreground }]}>{tiket.judul}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={2}>
          {labelDari(labelJenisPengaduan, tiket.jenis)}
          {tiket.createdAt != null ? ` · dilaporkan ${formatWaktuLokal(tiket.createdAt)}` : ''}
        </Text>
      </GlassPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  kosong: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  scroll: { padding: 16 },
  retry: { marginTop: 12 },
  list: { gap: 12 },
  kartuHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nomor: { flex: 1, fontSize: 13 },
  judul: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  meta: { fontSize: 13, marginTop: 2 },
});
