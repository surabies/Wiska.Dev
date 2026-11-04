/**
 * daftar-form.tsx — form daftar akun warga, LOGIKA & VALIDASI SAJA. Padanan
 * widgets/daftar_warga_form.dart. POST /api/public/auth/register (role selalu
 * USER) lalu langsung masuk (SesiWarga.daftar menggabungkan register+login).
 *
 * Nomor langganan WAJIB: nomor pertama otomatis jadi langganan UTAMA
 * (biodatanya tampil di beranda). Kartu PratinjauPelanggan muncul di bawah
 * field begitu nomor genap 11 digit.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Text as UIText } from '@/components/ui/text';
import { useTheme } from '@/components';
import { ApiException, SesiWarga, type WargaAkun } from '@workspace/mobile-core';

import { PratinjauPelanggan } from './PratinjauPelanggan';

const PANJANG_PASSWORD_MIN = 8;

export function DaftarWargaForm({
  onSukses,
  onTukarKeMasuk,
}: {
  onSukses: (akun: WargaAkun) => void;
  onTukarKeMasuk?: () => void;
}) {
  const { colors } = useTheme();
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [nomorLangganan, setNomorLangganan] = useState('');
  const [password, setPassword] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const daftar = async () => {
    const e: Record<string, string> = {};
    if (nama.trim().length < 2) e.nama = 'Nama wajib diisi.';
    if (!email.trim().includes('@')) e.email = 'Format email tidak valid.';
    if (!/^\d{11}$/.test(nomorLangganan.trim())) e.nomorLangganan = 'Nomor langganan harus 11 digit angka.';
    if (password.length < PANJANG_PASSWORD_MIN) e.password = `Password minimal ${PANJANG_PASSWORD_MIN} karakter.`;
    if (konfirmasi !== password) e.konfirmasi = 'Konfirmasi password tidak sama.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setMengirim(true);
    setGalat(null);
    try {
      const akun = await SesiWarga.daftar({
        nama: nama.trim(),
        email: email.trim().toLowerCase(),
        password,
        nomorLangganan: nomorLangganan.trim(),
      });
      onSukses(akun);
    } catch (err) {
      setGalat(ApiException.is(err) ? err.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setMengirim(false);
    }
  };

  return (
    <View style={styles.form}>
      <Field label="Nama lengkap" placeholder="Nama Anda" value={nama} onChangeText={setNama} error={errors.nama} />
      <Field label="Email" placeholder="nama@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
      <View>
        <Field
          label="Nomor langganan"
          placeholder="11 digit, contoh: 00000100119"
          description="Ada di lembar tagihan air Anda. Bisa menambah nomor lain setelah mendaftar."
          value={nomorLangganan}
          onChangeText={(t) => setNomorLangganan(t.replace(/\D/g, '').slice(0, 11))}
          keyboardType="number-pad"
          error={errors.nomorLangganan}
        />
        <PratinjauPelanggan nomor={nomorLangganan} />
      </View>
      <Field label="Password" placeholder="••••••••" description={`Minimal ${PANJANG_PASSWORD_MIN} karakter.`} value={password} onChangeText={setPassword} secureTextEntry error={errors.password} />
      <Field label="Konfirmasi password" placeholder="••••••••" value={konfirmasi} onChangeText={setKonfirmasi} secureTextEntry error={errors.konfirmasi} />
      {galat != null ? (
        <Alert icon={TriangleAlert} variant="destructive">
          <AlertTitle>Gagal mendaftar</AlertTitle>
          <AlertDescription>{galat}</AlertDescription>
        </Alert>
      ) : null}
      <Button onPress={daftar} disabled={mengirim} className="h-11 w-full">
        {mengirim ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Ionicons name="person-add" size={16} color={colors.primaryForeground} />
        )}
        <UIText>{mengirim ? 'Mendaftar…' : 'Daftar akun'}</UIText>
      </Button>
      {onTukarKeMasuk != null ? (
        <Pressable disabled={mengirim} onPress={onTukarKeMasuk} style={styles.tautan}>
          <Text style={[styles.tautanTeks, { color: colors.mutedForeground }]}>
            Sudah punya akun? <Text style={{ color: colors.primary, fontWeight: '600' }}>Masuk</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  tautan: { alignItems: 'center', paddingVertical: 4 },
  tautanTeks: { fontSize: 13 },
});
