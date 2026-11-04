/**
 * MasukTerpadu.tsx — Layar masuk satu pintu (Enterprise Unified Login).
 * Menerima akun Petugas Pencatat, Teknisi Gangguan, Supervisor, hingga Warga/Pelanggan.
 * Dilengkapi pintasan akun pengujian untuk memudahkan demonstrasi dan evaluasi.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, LogIn, Sparkles, TriangleAlert, UserCheck, Wrench, ShieldCheck, Home } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiException } from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text as UIText } from '@/components/ui/text';
import {
  MasterPalette as P,
  PremiumBackground,
  Radius,
  Spasi,
  useTheme,
} from '@/components';
import { SesiPengguna } from './SesiPengguna';

interface AkunUji {
  label: string;
  sub: string;
  identifier: string;
  sandi: string;
  warna: string;
  ikon: React.ComponentType<{ size: number; color: string }>;
}

const DAFTAR_AKUN_UJI: AkunUji[] = [
  {
    label: 'Pencatat',
    sub: 'Petugas Baca Meter',
    identifier: 'pencatat',
    sandi: 'Password123!',
    warna: '#06B6D4',
    ikon: Sparkles,
  },
  {
    label: 'Teknisi',
    sub: 'Staf Gangguan Lapangan',
    identifier: 'teknisi',
    sandi: 'Password123!',
    warna: '#F43F5E',
    ikon: Wrench,
  },
  {
    label: 'Supervisor',
    sub: 'Pengawas Operasional',
    identifier: 'supervisor',
    sandi: 'Password123!',
    warna: '#8B5CF6',
    ikon: ShieldCheck,
  },
  {
    label: 'Warga',
    sub: 'Pelanggan Rekening',
    identifier: 'warga',
    sandi: 'Password123!',
    warna: '#0284C7',
    ikon: Home,
  },
];

export function MasukTerpaduScreen({ onSukses }: { onSukses: () => void }) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [identitas, setIdentitas] = useState('');
  const [sandi, setSandi] = useState('');
  const [sandiTerlihat, setSandiTerlihat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const isiOtomatis = (akun: AkunUji) => {
    setIdentitas(akun.identifier);
    setSandi(akun.sandi);
    setGalat(null);
  };

  const masuk = async () => {
    const id = identitas.trim();
    if (id.length === 0 || sandi.length === 0) {
      setGalat('Harap isi username atau email serta kata sandi.');
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      await SesiPengguna.masuk({ identifier: id, password: sandi });
      onSukses();
    } catch (err) {
      setGalat(ApiException.is(err) ? err.message : 'Gagal masuk. Periksa kembali kredensial Anda.');
    } finally {
      setSibuk(false);
    }
  };

  return (
    <PremiumBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.wadah}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Identitas Brand */}
          <View style={styles.header}>
            <View style={styles.logoWadah}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>TIRTAWENING</Text>
            <Text style={styles.brandSubtitle}>Portal Seluler Terpadu Operasional & Pelanggan</Text>
          </View>

          {/* Kartu Masuk */}
          <View style={[styles.kartu, { backgroundColor: isDark ? '#1E293BE6' : '#FFFFFFFA' }]}>
            <Text style={[styles.kartuJudul, { color: colors.foreground }]}>Masuk ke Akun Anda</Text>
            <Text style={[styles.kartuKeterangan, { color: colors.mutedForeground }]}>
              Gunakan akun petugas atau akun warga terdaftar
            </Text>

            {galat != null ? (
              <Alert icon={TriangleAlert} variant="destructive" className="mb-4">
                <AlertTitle>Gagal Masuk</AlertTitle>
                <AlertDescription>{galat}</AlertDescription>
              </Alert>
            ) : null}

            {/* Input Identifier */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>Email atau Username</Text>
              <Input
                placeholder="nama@tirtawening.co.id atau username"
                value={identitas}
                onChangeText={setIdentitas}
                autoCapitalize="none"
                editable={!sibuk}
                className="h-12 bg-white/5 border-white/10"
              />
            </View>

            {/* Input Sandi */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>Kata Sandi</Text>
              <View style={styles.barisSandi}>
                <Input
                  placeholder="••••••••"
                  value={sandi}
                  onChangeText={setSandi}
                  secureTextEntry={!sandiTerlihat}
                  editable={!sibuk}
                  className="h-12 flex-1 bg-white/5 border-white/10"
                />
                <Pressable
                  onPress={() => setSandiTerlihat((v) => !v)}
                  style={styles.tombolMata}
                >
                  {sandiTerlihat ? (
                    <EyeOff size={20} color={colors.mutedForeground} />
                  ) : (
                    <Eye size={20} color={colors.mutedForeground} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Tombol Masuk Utama */}
            <Button
              onPress={masuk}
              disabled={sibuk}
              className="h-12 mt-3 w-full bg-cyan-600 hover:bg-cyan-500"
            >
              {sibuk ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <LogIn size={18} color="#FFFFFF" />
              )}
              <UIText className="font-semibold text-white ml-2">
                {sibuk ? 'Memverifikasi...' : 'Masuk Sekarang'}
              </UIText>
            </Button>

            {/* Tautan Alternatif */}
            <View style={styles.barisTautan}>
              <Pressable onPress={() => router.push('/Daftar')}>
                <Text style={styles.tautanDaftar}>
                  Belum punya akun? <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Daftar Akun Warga</Text>
                </Text>
              </Pressable>
              <Pressable onPress={() => router.replace('/')} style={{ marginTop: 8 }}>
                <Text style={[styles.tautanTamu, { color: colors.mutedForeground }]}>
                  Lanjutkan sebagai Tamu (Akses Publik)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Pintasan Akun Pengujian (Testing Quick-Fill) */}
          <View style={styles.seksiUji}>
            <View style={styles.seksiUjiHeader}>
              <UserCheck size={16} color="#06B6D4" />
              <Text style={styles.seksiUjiJudul}>Pintasan Akun Uji Coba</Text>
            </View>
            <Text style={styles.seksiUjiKeterangan}>
              Ketuk untuk mengisi kredensial seed secara otomatis:
            </Text>
            <View style={styles.gridUji}>
              {DAFTAR_AKUN_UJI.map((akun) => {
                const Ikon = akun.ikon;
                return (
                  <Pressable
                    key={akun.label}
                    onPress={() => isiOtomatis(akun)}
                    style={[styles.tombolUji, { borderColor: akun.warna + '40' }]}
                  >
                    <View style={[styles.ikonUjiWadah, { backgroundColor: akun.warna + '20' }]}>
                      <Ikon size={16} color={akun.warna} />
                    </View>
                    <View style={styles.infoUji}>
                      <Text style={[styles.labelUji, { color: akun.warna }]}>{akun.label}</Text>
                      <Text style={styles.subUji} numberOfLines={1}>{akun.sub}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  wadah: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWadah: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#38BDF840',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    boxShadow: '0 8px 24px rgba(6, 182, 212, 0.25)',
  },
  logo: { width: 44, height: 44 },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#F8FAFC',
  },
  brandSubtitle: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  kartu: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#94A3B82E',
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.4)',
  },
  kartuJudul: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  kartuKeterangan: {
    fontSize: 12.5,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  barisSandi: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tombolMata: {
    position: 'absolute',
    right: 12,
    padding: 6,
  },
  barisTautan: {
    marginTop: 18,
    alignItems: 'center',
  },
  tautanDaftar: {
    fontSize: 13,
    color: '#94A3B8',
  },
  tautanTamu: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  seksiUji: {
    width: '100%',
    maxWidth: 420,
    marginTop: 24,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#0F172A80',
    borderWidth: 1,
    borderColor: '#33415560',
  },
  seksiUjiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  seksiUjiJudul: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  seksiUjiKeterangan: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginBottom: 12,
  },
  gridUji: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tombolUji: {
    flex: 1,
    minWidth: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#1E293B60',
    borderWidth: 1,
  },
  ikonUjiWadah: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoUji: {
    flex: 1,
  },
  labelUji: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  subUji: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
});
