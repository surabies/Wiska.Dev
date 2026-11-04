/**
 * beranda-screen.tsx — Beranda aplikasi PUBLIK (padanan beranda_publik_screen.dart):
 * hero navy + kartu langganan (bila login) + tiket aktif + grid layanan +
 * catatan. Tombol akun / chip status → pindah ke tab Akun.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gauge, MessageSquareWarning, ReceiptText, Search } from 'lucide-react-native';
import { MasterPalette as P, PremiumBackground, SectionHeader, useTheme } from '@/components';
import { ApiConfig, SesiWarga } from '@workspace/mobile-core';

import { LanggananSayaSection } from './components/LanggananSayaSection';
import { useSesiVersi } from '@/features/shared/SesiStore';
import { BerandaHero } from './components/BerandaHero';
import { CatatanLayanan } from './components/CatatanLayanan';
import { QuickActionGrid, type QuickAction } from './components/QuickActionGrid';
import { TiketAktifSection } from './components/TiketAktifSection';

function sapaanSekarang(): string {
  const jam = new Date().getHours();
  if (jam < 10) return 'Selamat pagi,';
  if (jam < 15) return 'Selamat siang,';
  if (jam < 18) return 'Selamat sore,';
  return 'Selamat malam,';
}

export function BerandaScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  useSesiVersi(); // Render ulang saat login/keluar.
  const akun = SesiWarga.akun;

  const bukaAkun = () => router.navigate('/Akun');

  const aksi: QuickAction[] = [
    { ikon: ReceiptText, label: 'Cek Tagihan', gradasi: [P.sky300, P.sky600], onPress: () => router.push('/CekTagihan') },
    { ikon: Gauge, label: 'Lapor Meter', gradasi: [P.teal, P.teal600], onPress: () => router.push('/LaporMeter') },
    { ikon: MessageSquareWarning, label: 'Pengaduan', gradasi: [P.rose400, P.rose600], onPress: () => router.push('/Pengaduan') },
    { ikon: Search, label: 'Lacak Tiket', gradasi: [P.emerald400, P.emerald600], onPress: () => router.push('/LacakTiket') },
  ];

  return (
    <PremiumBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <BerandaHero
          sapaan={sapaanSekarang()}
          nama={akun?.name ?? 'Warga Tirtawening'}
          demo={ApiConfig.isDemo}
          trailing={<TombolAkun masuk={akun != null} onPress={bukaAkun} />}
          content={akun == null ? <StatusAkunChip onPress={bukaAkun} /> : undefined}
        />

        <View style={styles.body}>
          <LanggananSayaSection />
          <TiketAktifSection />
          <SectionHeader judul="Layanan" />
          <QuickActionGrid aksi={aksi} />
          <View style={styles.catatan}>
            <CatatanLayanan
              butir={[
                { ikon: 'information-circle', judul: 'Satu laporan meter per bulan', isi: 'laporan mandiri diverifikasi petugas sebelum jadi angka resmi tagihan.' },
                { ikon: 'call', judul: 'Gangguan 24 jam', isi: 'kebocoran besar atau air mati area luas — pilih kategori Kebocoran agar diprioritaskan.' },
              ]}
            />
          </View>
        </View>
      </ScrollView>
    </PremiumBackground>
  );
}

/** Tombol akun pojok kanan-atas hero. */
function TombolAkun({ masuk, onPress }: { masuk: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tombolAkun}>
      <Ionicons name={masuk ? 'person-circle' : 'person-add'} size={20} color="#FFFFFF" />
    </Pressable>
  );
}

/** Chip ajakan masuk (hanya untuk pengunjung anonim). */
function StatusAkunChip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.statusChip}>
      <Ionicons name="person-circle-outline" size={18} color="#E0F2FE" />
      <Text style={styles.statusTeks}>Masuk atau daftar supaya laporan Anda tersimpan otomatis.</Text>
      <Ionicons name="chevron-forward" size={16} color="#FFFFFF99" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 96 },
  body: { paddingHorizontal: 18, paddingTop: 14 },
  catatan: { marginTop: 14 },
  tombolAkun: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF1A', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF1F', alignItems: 'center', justifyContent: 'center' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FFFFFF14', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF24' },
  statusTeks: { flex: 1, fontSize: 12.5, fontWeight: '500', color: '#E0F2FE' },
});
