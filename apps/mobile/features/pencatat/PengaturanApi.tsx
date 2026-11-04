/**
 * pengaturan-api-screen.tsx — ganti server backend (produksi/lokal) di app
 * yang sudah ter-install. Layar ini TIDAK ditautkan dari menu mana pun —
 * satu-satunya jalan masuk adalah ketuk rahasia di AkunScreen. Lihat
 * `packages/mobile-core/src/network/api-config.ts` untuk kenapa override
 * runtime ini perlu ada (EXPO_PUBLIC_API_BASE_URL menetap saat build, tidak
 * bisa dipakai mengarahkan app yang sudah di tangan petugas).
 *
 * DUA LAPIS PERTAHANAN sebelum URL bisa diganti:
 *   1. Kode akses diverifikasi SERVER (POST /api/mobile/dev-access/verify) —
 *      tidak ada rahasia yang ikut ter-build ke bundel JS, jadi tidak bisa
 *      dibongkar lewat reverse-engineering APK, dan kodenya bisa diputar
 *      kapan saja lewat env var Vercel.
 *   2. Verifikasi TIDAK disimpan — dibuka ulang dari nol setiap kali layar
 *      ini diakses, walau dalam sesi yang sama.
 *
 * Mengganti server SELALU memaksa keluar (token lama tidak valid di backend
 * lain) dan mengembalikan ke layar masuk, tempat pita peringatan non-produksi
 * tampil.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, KeyRound, ServerCog, TriangleAlert } from 'lucide-react-native';
import {
  ApiClient,
  ApiConfig,
  ApiException,
  SesiPetugas,
  setApiOverride,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text as UIText } from '@/components/ui/text';
import { Berat, Radius, Spasi, useTheme, Tekan } from '@/components';
import { DialogKonfirmasi } from '@/features/pencatat/components/DialogKonfirmasi';

function normalisasiUrl(u: string): string {
  return u.trim().replace(/\/+$/, '');
}

function urlValid(u: string): boolean {
  return /^https?:\/\/.+/.test(u);
}

export function PengaturanApiScreen({
  onSelesai,
  onBack,
}: {
  onSelesai: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [terverifikasi, setTerverifikasi] = useState(false);
  const [kode, setKode] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const [pilihan, setPilihan] = useState<'produksi' | 'kustom'>('produksi');
  const [urlKustom, setUrlKustom] = useState('');
  const [tanyaSimpan, setTanyaSimpan] = useState(false);

  const verifikasiKode = async () => {
    if (kode.trim().length === 0) {
      setGalat('Isi kode akses terlebih dahulu.');
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      await ApiClient.post(`${ApiConfig.devAccessPath}/verify`, {
        body: { kode: kode.trim() },
        parse: (d) => d as { valid: boolean },
      });
      setTerverifikasi(true);
    } catch (err) {
      setGalat(ApiException.is(err) ? err.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setSibuk(false);
    }
  };

  const urlTujuan = pilihan === 'produksi' ? null : normalisasiUrl(urlKustom);
  const bisaSimpan = pilihan === 'produksi' || (urlTujuan != null && urlValid(urlTujuan));

  return (
    <View style={[gaya.layar, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={gaya.barAtas}>
        <Tekan
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={({ pressed }) => pressed && gaya.ditekan}
        >
          <ChevronLeft size={24} color={colors.primary} />
        </Tekan>
        <Text style={[gaya.judul, { color: colors.foreground }]}>Pengaturan Server</Text>
      </View>

      {/* Layar ini TIDAK memakai LayarGradasi, jadi ia tidak ikut kebagian
          penanganan keyboard di sana — dan tanpa ini kolom URL kustom, yang
          berada paling bawah, mendarat di balik keyboard. Pola sama persis
          dengan masuk-screen: padding di kedua platform (Android 15+ tidak
          lagi menyusutkan jendela) plus penyesuaian inset oleh ScrollView. */}
      <KeyboardAvoidingView style={gaya.fleks} behavior="padding">
        <ScrollView
          contentContainerStyle={gaya.isi}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {!terverifikasi ? (
            <>
              <View style={[gaya.kartu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <KeyRound size={22} color={colors.mutedForeground} />
                <Text style={[gaya.label, { color: colors.foreground }]}>Kode akses</Text>
                <Text style={[gaya.deskripsi, { color: colors.mutedForeground }]}>
                  Layar ini untuk teknisi. Masukkan kode akses untuk melanjutkan.
                </Text>
                <Input
                  value={kode}
                  onChangeText={setKode}
                  placeholder="Kode akses"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!sibuk}
                  onSubmitEditing={verifikasiKode}
                  returnKeyType="go"
                  style={gaya.input}
                />
                {galat != null ? (
                  <Alert icon={TriangleAlert} variant="destructive" style={gaya.alert}>
                    <AlertTitle>Tidak dapat lanjut</AlertTitle>
                    <AlertDescription>{galat}</AlertDescription>
                  </Alert>
                ) : null}
                <Button onPress={verifikasiKode} disabled={sibuk} style={gaya.tombol}>
                  {sibuk ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
                  <UIText>{sibuk ? 'Memeriksa…' : 'Verifikasi'}</UIText>
                </Button>
              </View>
            </>
          ) : (
            <>
              <View style={[gaya.kartu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ServerCog size={22} color={colors.mutedForeground} />
                <Text style={[gaya.label, { color: colors.foreground }]}>Server tujuan</Text>

                <Tekan
                  onPress={() => setPilihan('produksi')}
                  style={[
                    gaya.opsi,
                    { borderColor: pilihan === 'produksi' ? colors.primary : colors.border },
                  ]}
                >
                  <View style={gaya.opsiBaris}>
                    <Text style={[gaya.opsiJudul, { color: colors.foreground }]}>Produksi</Text>
                    {pilihan === 'produksi' ? <Check size={18} color={colors.primary} /> : null}
                  </View>
                  <Text style={[gaya.opsiNilai, { color: colors.mutedForeground }]}>
                    https://tirtawening.vercel.app
                  </Text>
                </Tekan>

                <Tekan
                  onPress={() => setPilihan('kustom')}
                  style={[
                    gaya.opsi,
                    { borderColor: pilihan === 'kustom' ? colors.primary : colors.border },
                  ]}
                >
                  <View style={gaya.opsiBaris}>
                    <Text style={[gaya.opsiJudul, { color: colors.foreground }]}>Kustom (lokal/staging)</Text>
                    {pilihan === 'kustom' ? <Check size={18} color={colors.primary} /> : null}
                  </View>
                  {pilihan === 'kustom' ? (
                    <Input
                      value={urlKustom}
                      onChangeText={setUrlKustom}
                      placeholder="http://192.168.1.10:3001"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      style={gaya.input}
                    />
                  ) : (
                    <Text style={[gaya.opsiNilai, { color: colors.mutedForeground }]}>
                      Mis. server dev di jaringan lokal
                    </Text>
                  )}
                </Tekan>

                <Button
                  onPress={() => setTanyaSimpan(true)}
                  disabled={!bisaSimpan}
                  style={gaya.tombol}
                >
                  <UIText>Simpan & Keluar</UIText>
                </Button>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <DialogKonfirmasi
        visible={tanyaSimpan}
        judul="Ganti Server API"
        deskripsi={
          pilihan === 'produksi'
            ? 'Kembali ke server produksi. Sesi saat ini akan dihapus dan Anda perlu masuk lagi.'
            : `Aplikasi akan menembak "${urlTujuan}" untuk semua permintaan berikutnya. Pastikan ` +
              'server itu bisa dijangkau dari perangkat ini. Sesi saat ini akan dihapus dan Anda ' +
              'perlu masuk lagi.'
        }
        labelKonfirmasi="Ganti & Keluar"
        destruktif
        onTutup={() => setTanyaSimpan(false)}
        onKonfirmasi={async () => {
          await setApiOverride(urlTujuan);
          await SesiPetugas.keluar();
          onSelesai();
        }}
      />
    </View>
  );
}

const gaya = StyleSheet.create({
  layar: { flex: 1 },
  fleks: { flex: 1 },
  ditekan: { opacity: 0.7 },
  barAtas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    paddingHorizontal: Spasi.lg,
    paddingVertical: Spasi.md,
  },
  judul: { fontSize: 17, fontWeight: Berat.semi },
  isi: { padding: Spasi.lg, gap: Spasi.lg },

  kartu: {
    borderRadius: Radius.kartu,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spasi.lg,
    gap: Spasi.sm,
  },
  label: { fontSize: 16, fontWeight: Berat.semi, marginTop: Spasi.xs },
  deskripsi: { fontSize: 13, marginBottom: Spasi.xs },
  input: { marginTop: Spasi.xs },
  alert: { marginTop: Spasi.sm },
  tombol: { marginTop: Spasi.md },

  opsi: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.kontrol,
    padding: Spasi.md,
    marginTop: Spasi.sm,
    gap: Spasi.xs,
  },
  opsiBaris: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  opsiJudul: { fontSize: 14, fontWeight: Berat.semi },
  opsiNilai: { fontSize: 12 },
});
