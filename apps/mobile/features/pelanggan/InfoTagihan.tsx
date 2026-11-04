/**
 * info-tagihan-screen.tsx — alat petugas memeriksa rekening pelanggan DI
 * TEMPAT. Padanan `info_tagihan_screen.dart` (Check Tagihan Aurora).
 *
 * Sengaja memakai endpoint PUBLIK `/api/public/cek-tagihan` dan tampilan
 * hasil yang sama persis dengan aplikasi warga. Alasannya bukan hemat kode:
 * kalau petugas dan pelanggan melihat rincian yang berbeda untuk tagihan yang
 * sama, perdebatan di depan rumah tidak akan pernah selesai.
 */
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  ChevronLeft,
  Search,
  TriangleAlert,
} from 'lucide-react-native';
import { ApiException, type CekTagihanResult } from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text as UIText } from '@/components/ui/text';
import {
  Berat,
  GlassPanel,
  Kelas,
  Spasi,
  Teks,
  TinggiBaris,
  UkuranIkon,
  useTheme,
  Tekan,
} from '@/components';
import { LayarGradasi } from '@/features/pencatat/components/LayarGradasi';
import { buatCekTagihanRepository } from './lib/RepositoryInfoTagihan';
import { HasilCekTagihanView } from './components/HasilInfoTagihan';

const repo = buatCekTagihanRepository();

export function InfoTagihanScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [nomor, setNomor] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<CekTagihanResult | null>(null);

  const cek = async () => {
    const bersih = nomor.trim();
    // Server mencocokkan PERSIS 11 digit; menahannya di sini menghemat satu
    // perjalanan bolak-balik di sinyal lapangan yang lambat.
    if (bersih.length !== 11) {
      setGalat('Nomor langganan harus 11 digit.');
      setHasil(null);
      return;
    }
    setMemuat(true);
    setGalat(null);
    setHasil(null);
    try {
      setHasil(await repo.cekTagihan(bersih));
    } catch (err) {
      setGalat(
        err instanceof ApiException ? err.message : 'Tidak dapat memeriksa tagihan sekarang.',
      );
    } finally {
      setMemuat(false);
    }
  };

  return (
    <LayarGradasi
      judul="Info Tagihan"
      subjudul="Periksa rekening pelanggan di lokasi"
      kiri={
        onBack ? (
          <Tekan
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            style={({ pressed }) => pressed && styles.ditekan}
          >
            <ChevronLeft size={22} color="#FFFFFF" />
          </Tekan>
        ) : null
      }
    >
      <GlassPanel padding={14}>
        <Text style={[styles.label, { color: colors.foreground }]}>Nomor langganan</Text>
        <Input
          value={nomor}
          onChangeText={(v) => setNomor(v.replace(/[^0-9A-Za-z]/g, '').toUpperCase())}
          placeholder="11 digit, mis. 00000100119"
          keyboardType="number-pad"
          autoCapitalize="characters"
          maxLength={11}
          onSubmitEditing={cek}
          returnKeyType="search"
        />
        <Button onPress={cek} disabled={memuat} className={`mt-3 ${Kelas.tombol}`}>
          {memuat ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Search size={UkuranIkon.kecil} color={colors.primaryForeground} />
          )}
          <UIText>{memuat ? 'Memeriksa…' : 'Cek Tagihan'}</UIText>
        </Button>
        <Text style={[styles.catatan, { color: colors.mutedForeground }]}>
          Angka yang tampil sama persis dengan yang dilihat pelanggan di aplikasi warga.
        </Text>
      </GlassPanel>

      {galat != null ? (
        <View style={styles.jarak}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Tidak ditemukan</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {hasil != null ? (
        <View style={styles.jarak}>
          <HasilCekTagihanView hasil={hasil} />
        </View>
      ) : null}
    </LayarGradasi>
  );
}

const styles = StyleSheet.create({
  ditekan: { opacity: 0.7 },
  label: { fontSize: Teks.sm, fontWeight: '500', marginBottom: Spasi.sm },
  catatan: { fontSize: Teks.xs, marginTop: Spasi.md, lineHeight: TinggiBaris.xs },
  jarak: { marginTop: Spasi.lg },
});
