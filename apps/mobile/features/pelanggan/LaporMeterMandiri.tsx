/**
 * lapor-meter-screen.tsx — Lapor Meter Mandiri (publik). Padanan
 * features/public/lapor_meter/lapor_meter_screen.dart.
 *
 * Pelanggan memfoto & melaporkan angka meternya sendiri. Laporan masuk
 * berstatus MENUNGGU sampai petugas memverifikasi. Foto meter WAJIB (server
 * menolak 400 tanpanya). Ada dialog konfirmasi sebelum kirim — angka keliru
 * memengaruhi tagihan.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { TriangleAlert } from 'lucide-react-native';
import { jendelaLaporMandiri } from '@workspace/domain/lapor-mandiri';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Text as UIText } from '@/components/ui/text';
import { AppDialog } from '@/components/ui/app-dialog';
import { AppScaffold, PhotoBox, useTheme } from '@/components';
import { ApiException, labelPeriode, SesiWarga } from '@workspace/mobile-core';

import { LanggananSayaCache } from './lib/RepositoryLangganan';
import { ambilFoto, MediaError, type SumberMedia } from '@/features/shared/MediaLokal';
import { buatLaporMeterRepository } from './lib/RepositoryLaporMeter';

export function LaporMeterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  // Dihitung sekali saat layar dibuka. Tidak perlu reaktif: warga tidak akan
  // menatap layar ini melewati tengah malam, dan server tetap gerbangnya.
  const [jendela] = useState(() => jendelaLaporMandiri());
  const [repo] = useState(buatLaporMeterRepository);

  const [nomorLangganan, setNomorLangganan] = useState(LanggananSayaCache.utama?.nomorLangganan ?? '');
  const [stand, setStand] = useState('');
  const [namaPelapor, setNamaPelapor] = useState(SesiWarga.akun?.name ?? '');
  const [nomorPelapor, setNomorPelapor] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [memprosesFoto, setMemprosesFoto] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [dialogFoto, setDialogFoto] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [koordinat, setKoordinat] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mengambilLokasi, setMengambilLokasi] = useState(false);
  const [sukses, setSukses] = useState<{ periode: number; standDilaporkan: number; pesan: string } | null>(null);

  const validasi = (): boolean => {
    const e: Record<string, string> = {};
    if (nomorLangganan.length !== 11) e.nomorLangganan = 'Nomor langganan harus tepat 11 digit angka.';
    if (stand.length === 0) e.stand = 'Angka meter wajib diisi.';
    else {
      const n = Number(stand);
      if (Number.isNaN(n) || n < 0 || n > 9999999) e.stand = 'Angka meter tidak valid.';
    }
    if (namaPelapor.trim().length < 2) e.namaPelapor = 'Nama pelapor wajib diisi (minimal 2 karakter).';
    if (nomorPelapor.trim().length < 5) e.nomorPelapor = 'Nomor HP wajib diisi agar petugas bisa menghubungi.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pilihFoto = async (sumber: SumberMedia) => {
    setDialogFoto(false);
    setMemprosesFoto(true);
    setGalat(null);
    try {
      const uri = await ambilFoto(sumber);
      if (uri) {
        setFotoUri(uri);
        // Ambil lokasi di latar belakang begitu foto berhasil diambil, supaya
        // saat konfirmasi dikirim koordinat sudah siap tanpa jeda tambahan.
        ambilLokasi();
      }
    } catch (e) {
      setGalat(e instanceof MediaError ? e.message : 'Gagal mengambil foto. Coba pilih dari Galeri.');
    } finally {
      setMemprosesFoto(false);
    }
  };

  const ambilLokasi = async () => {
    setMengambilLokasi(true);
    try {
      const izin = await Location.requestForegroundPermissionsAsync();
      if (izin.status !== 'granted') return; // Diam-diam dilewati — lokasi bersifat opsional, bukan syarat wajib.
      const posisi = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setKoordinat({ latitude: posisi.coords.latitude, longitude: posisi.coords.longitude });
    } catch {
      // Gagal ambil lokasi tidak menghalangi pengiriman laporan.
    } finally {
      setMengambilLokasi(false);
    }
  };

  const konfirmasiLaluKirim = () => {
    if (!validasi()) return;
    if (fotoUri == null) {
      setGalat('Foto meter wajib dilampirkan sebagai bukti. Ketuk kotak foto di atas untuk mengambilnya.');
      return;
    }
    setGalat(null);
    setKonfirmasi(true);
  };

  const kirim = async () => {
    setKonfirmasi(false);
    setMengirim(true);
    setGalat(null);
    try {
      const tanda = await repo.kirim({
        nomorLangganan,
        standDilaporkan: Number(stand),
        namaPelapor: namaPelapor.trim(),
        nomorPelapor: nomorPelapor.trim(),
        fotoUri,
        latitude: koordinat?.latitude ?? null,
        longitude: koordinat?.longitude ?? null,
      });
      setStand('');
      setFotoUri(null);
      setKoordinat(null);
      setErrors({});
      setSukses({ periode: tanda.periode, standDilaporkan: tanda.standDilaporkan, pesan: tanda.pesan });
    } catch (e) {
      setGalat(ApiException.is(e) ? e.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setMengirim(false);
    }
  };

  return (
    <AppScaffold
      title="Lapor Meter Mandiri"
      subtitle="Laporkan angka meter bulan ini"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            {/* Jendela tanggal 1-25. Saat tertutup formulirnya TIDAK
                disembunyikan — warga tetap boleh melihat isinya — tetapi
                tombol kirim dimatikan dan alasannya dijelaskan di depan,
                bukan setelah mereka selesai memotret meter. */}
            {!jendela.boleh ? (
              <Alert icon={TriangleAlert}>
                <AlertTitle>Pelaporan sedang ditutup</AlertTitle>
                <AlertDescription>{jendela.pesan}</AlertDescription>
              </Alert>
            ) : jendela.sisaHari !== null && jendela.sisaHari <= 5 ? (
              <Alert icon={TriangleAlert}>
                <AlertDescription>{jendela.pesan}</AlertDescription>
              </Alert>
            ) : null}
            <Field
              label="Nomor Langganan"
              placeholder="11 digit nomor langganan"
              value={nomorLangganan}
              onChangeText={(t) => setNomorLangganan(t.replace(/\D/g, '').slice(0, 11))}
              keyboardType="number-pad"
              error={errors.nomorLangganan}
            />
            <Field
              label="Angka Meter Saat Ini (m³)"
              placeholder="Contoh: 1245"
              description="Tulis angka HITAM pada meter air, tanpa angka merah di belakang koma."
              value={stand}
              onChangeText={(t) => setStand(t.replace(/\D/g, '').slice(0, 7))}
              keyboardType="number-pad"
              error={errors.stand}
            />

            <View style={styles.fotoGroup}>
              <Text style={styles.fotoLabel}>
                <Text style={{ color: colors.foreground }}>Foto Meter</Text>
                <Text style={{ color: colors.destructive }}> *wajib</Text>
              </Text>
              <Animated.View key={fotoUri ?? 'kosong'} entering={FadeIn.duration(250)}>
                <PhotoBox uri={fotoUri} memproses={memprosesFoto} onPress={memprosesFoto ? undefined : () => setDialogFoto(true)} />
              </Animated.View>
              {fotoUri != null ? (
                <Text style={[styles.lokasiInfo, { color: colors.mutedForeground }]}>
                  {mengambilLokasi
                    ? 'Mengambil lokasi…'
                    : koordinat != null
                      ? 'Lokasi terlampir sebagai bukti tambahan.'
                      : 'Lokasi tidak tersedia (izin ditolak atau GPS mati) — laporan tetap bisa dikirim.'}
                </Text>
              ) : null}
            </View>

            <Field label="Nama Pelapor" placeholder="Nama lengkap Anda" value={namaPelapor} onChangeText={setNamaPelapor} error={errors.namaPelapor} />
            <Field label="Nomor HP" placeholder="08xxxxxxxxxx" value={nomorPelapor} onChangeText={setNomorPelapor} keyboardType="phone-pad" error={errors.nomorPelapor} />

            {galat != null ? (
              <Alert icon={TriangleAlert} variant="destructive">
                <AlertTitle>Gagal mengirim</AlertTitle>
                <AlertDescription>{galat}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              onPress={konfirmasiLaluKirim}
              disabled={mengirim || !jendela.boleh}
              className="h-11 w-full"
            >
              {mengirim ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Ionicons name="paper-plane" size={16} color={colors.primaryForeground} />
              )}
              <UIText>
                {mengirim
                  ? 'Mengirim…'
                  : !jendela.boleh
                    ? `Dibuka lagi ${jendela.bukaBerikutnya}`
                    : 'Kirim Laporan'}
              </UIText>
            </Button>
          </View>
        </ScrollView>
      }
    >
      <AppDialog
        visible={dialogFoto}
        onDismiss={() => setDialogFoto(false)}
        title="Foto Meter"
        description="Ambil foto angka meter dengan jelas."
        actions={
          <>
            <Button onPress={() => pilihFoto('kamera')} className="h-11 w-full">
              <UIText>Kamera</UIText>
            </Button>
            <Button variant="outline" onPress={() => pilihFoto('galeri')} className="h-11 w-full">
              <UIText>Galeri</UIText>
            </Button>
            {fotoUri != null ? (
              <Button variant="destructive" className="h-11 w-full" onPress={() => { setFotoUri(null); setDialogFoto(false); }}>
                <UIText>Hapus</UIText>
              </Button>
            ) : null}
          </>
        }
      />

      <AppDialog
        visible={konfirmasi}
        onDismiss={() => setKonfirmasi(false)}
        title="Konfirmasi Laporan"
        description="Periksa kembali data berikut sebelum dikirim. Angka meter yang keliru dapat memengaruhi tagihan Anda."
        actions={
          <>
            <Button onPress={kirim} className="h-11 w-full">
              <UIText>Kirim Laporan</UIText>
            </Button>
            <Button variant="outline" onPress={() => setKonfirmasi(false)} className="h-11 w-full">
              <UIText>Periksa Lagi</UIText>
            </Button>
          </>
        }
      >
        <Animated.View entering={FadeInDown.duration(200)} style={styles.konfirmasi}>
          <BarisKonfirmasi label="No. Langganan" nilai={nomorLangganan} />
          <BarisKonfirmasi label="Angka Meter" nilai={`${stand} m³`} />
          <BarisKonfirmasi label="Pelapor" nilai={namaPelapor} />
          <BarisKonfirmasi label="Kontak" nilai={nomorPelapor} />
          <BarisKonfirmasi label="Lokasi" nilai={koordinat != null ? 'Terlampir' : 'Tidak tersedia'} />
        </Animated.View>
      </AppDialog>

      <AppDialog
        visible={sukses != null}
        onDismiss={() => setSukses(null)}
        title="Laporan Terkirim"
        description={
          sukses != null
            ? `${sukses.pesan}\n\nPeriode: ${labelPeriode(sukses.periode)}\nAngka dilaporkan: ${sukses.standDilaporkan} m³`
            : ''
        }
        actions={
          <Button onPress={() => setSukses(null)} className="h-11 w-full">
            <UIText>Selesai</UIText>
          </Button>
        }
      />
    </AppScaffold>
  );
}

function BarisKonfirmasi({ label, nilai }: { label: string; nilai: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.barisKonf}>
      <Text style={[styles.barisKonfLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.barisKonfNilai, { color: colors.foreground }]}>{nilai}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  form: { gap: 16 },
  fotoGroup: { gap: 8 },
  fotoLabel: { fontSize: 14, fontWeight: '600' },
  lokasiInfo: { fontSize: 12, marginTop: 4 },
  konfirmasi: { paddingVertical: 8, gap: 4 },
  barisKonf: { flexDirection: 'row', paddingVertical: 3 },
  barisKonfLabel: { width: 110, fontSize: 13 },
  barisKonfNilai: { flex: 1, fontSize: 14 },
});