/**
 * lapor-pengaduan-screen.tsx — Lapor Pengaduan (publik, tanpa login). Padanan
 * features/public/pengaduan/lapor_pengaduan_screen.dart.
 *
 * Pelapor tidak harus pelanggan (mis. warga melihat pipa bocor di jalan).
 * Balasan berisi nomor tiket TW-YYMM-XXXXXX untuk melacak status.
 * BOCOR_PIPA_DINAS wajib koordinat. Foto & video bukti opsional (foto
 * dikompres ke anggaran ukuran oleh `kompresFoto`, TANPA watermark — detail
 * lebih berharga daripada stempel).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MapPin, TriangleAlert } from 'lucide-react-native';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SelectField, type SelectFieldOption } from '@/components/ui/select-field';
import { Text as UIText } from '@/components/ui/text';
import { AppDialog } from '@/components/ui/app-dialog';
import { AppScaffold, PhotoBox, useTheme } from '@/components';
import {
  ApiException,
  ComplaintDraft,
  formatTanggalUtc,
  labelJenisPengaduan,
  labelKlasifikasiPengaduan,
  SesiWarga,
} from '@workspace/mobile-core';

import { LaporanSayaCache } from '@/features/pelanggan/lib/RepositoryLaporanWarga';
import { LanggananSayaCache } from '@/features/pelanggan/lib/RepositoryLangganan';
import { ambilFoto, ambilVideo, MediaError, type SumberMedia } from '@/features/shared/MediaLokal';
import { buatLaporPengaduanRepository } from './lib/RepositoryPengaduan';

const OPSI_KLASIFIKASI: SelectFieldOption[] = Object.entries(labelKlasifikasiPengaduan).map(([value, label]) => ({ value, label }));
const OPSI_JENIS: SelectFieldOption[] = Object.entries(labelJenisPengaduan).map(([value, label]) => ({ value, label }));

export function LaporPengaduanScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [repo] = useState(buatLaporPengaduanRepository);

  // ── State form ────────────────────────────────────────────────────────
  const [klasifikasi, setKlasifikasi] = useState('BUKAN_NILAI_TAGIHAN_REKENING');
  const [jenis, setJenis] = useState<string | null>(null);
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [alamatKejadian, setAlamatKejadian] = useState('');
  const [pelapor, setPelapor] = useState(SesiWarga.akun?.name ?? '');
  const [kontakPelapor, setKontakPelapor] = useState('');
  const [nomorLangganan, setNomorLangganan] = useState(LanggananSayaCache.utama?.nomorLangganan ?? '');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [dialogMedia, setDialogMedia] = useState<'foto' | 'video' | null>(null);
  const [tanda, setTanda] = useState<{ nomorTiket: string; pesan: string; targetSelesaiAt: Date | null } | null>(null);

  const wajibKoordinat = jenis === 'BOCOR_PIPA_DINAS';

  const validasi = (): boolean => {
    const e: Record<string, string> = {};
    if (jenis == null) e.jenis = 'Pilih jenis pengaduan.';
    if (judul.trim().length < 5) e.judul = 'Judul minimal 5 karakter.';
    if (deskripsi.trim().length < 10) e.deskripsi = 'Ceritakan lebih detail (minimal 10 karakter).';
    if (wajibKoordinat) {
      const a = Number(lat);
      const o = Number(lng);
      if (lat.trim() === '' || Number.isNaN(a) || a < -90 || a > 90) e.lat = 'Latitude tidak valid.';
      if (lng.trim() === '' || Number.isNaN(o) || o < -180 || o > 180) e.lng = 'Longitude tidak valid.';
    }
    if (pelapor.trim().length < 2) e.pelapor = 'Nama pelapor wajib diisi.';
    if (kontakPelapor.trim().length < 5) e.kontakPelapor = 'Kontak wajib diisi agar petugas bisa menghubungi.';
    if (nomorLangganan.length > 0 && nomorLangganan.length !== 11) e.nomorLangganan = 'Bila diisi, nomor langganan harus 11 digit.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const kirim = async () => {
    if (!validasi()) return;
    setMengirim(true);
    setGalat(null);
    try {
      const draft = new ComplaintDraft(
        klasifikasi,
        jenis!,
        judul.trim(),
        deskripsi.trim(),
        pelapor.trim(),
        kontakPelapor.trim(),
        alamatKejadian.trim() || null,
        nomorLangganan.trim() || null,
        wajibKoordinat ? Number(lat) : null,
        wajibKoordinat ? Number(lng) : null,
      );
      const receipt = await repo.kirim(draft, { fotoUri, videoUri });
      // Tiket baru membuat daftar tersimpan usang.
      LaporanSayaCache.reset();
      // Reset form.
      setJenis(null);
      setJudul('');
      setDeskripsi('');
      setLat('');
      setLng('');
      setAlamatKejadian('');
      setFotoUri(null);
      setVideoUri(null);
      setErrors({});
      setTanda({ nomorTiket: receipt.nomorTiket, pesan: receipt.pesan, targetSelesaiAt: receipt.targetSelesaiAt });
    } catch (err) {
      if (ApiException.is(err)) {
        setGalat(err.details && err.details.length > 0 ? err.details.map((d) => d.message).join('\n') : err.message);
      } else {
        setGalat('Terjadi kesalahan. Coba lagi.');
      }
    } finally {
      setMengirim(false);
    }
  };

  const pilihMedia = async (sumber: SumberMedia) => {
    const jenisMedia = dialogMedia;
    setDialogMedia(null);
    try {
      if (jenisMedia === 'foto') {
        const uri = await ambilFoto(sumber);
        if (uri) setFotoUri(uri);
      } else if (jenisMedia === 'video') {
        const uri = await ambilVideo(sumber);
        if (uri) setVideoUri(uri);
      }
    } catch (e) {
      setGalat(e instanceof MediaError ? e.message : 'Gagal mengambil media.');
    }
  };

  const sudahLogin = SesiWarga.sudahMasuk;

  return (
    <AppScaffold
      title="Lapor Pengaduan"
      subtitle="Sampaikan gangguan layanan air"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <SelectField label="Klasifikasi Pengaduan" placeholder="Pilih klasifikasi…" options={OPSI_KLASIFIKASI} value={klasifikasi} onValueChange={(v) => setKlasifikasi(v ?? 'BUKAN_NILAI_TAGIHAN_REKENING')} />
            <SelectField label="Jenis Pengaduan" placeholder="Pilih jenis…" options={OPSI_JENIS} value={jenis} onValueChange={setJenis} error={errors.jenis} />
            <Field label="Judul" placeholder="Ringkasan singkat masalah" value={judul} onChangeText={setJudul} error={errors.judul} />
            <Field label="Keterangan" placeholder="KEBERATAN BAYAR" value={deskripsi} onChangeText={setDeskripsi} error={errors.deskripsi} multiline />

            {wajibKoordinat ? (
              <>
                <Alert icon={MapPin}>
                  <AlertTitle>Lokasi wajib untuk kebocoran</AlertTitle>
                  <AlertDescription>Isi koordinat titik kebocoran agar petugas dapat menemukannya. Salin dari aplikasi peta di ponsel Anda.</AlertDescription>
                </Alert>
                <View style={styles.row}>
                  <View style={styles.col}>
                    <Field label="Latitude" placeholder="-6.9147" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" error={errors.lat} />
                  </View>
                  <View style={styles.col}>
                    <Field label="Longitude" placeholder="107.6098" value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" error={errors.lng} />
                  </View>
                </View>
              </>
            ) : null}

            <Field label="Alamat Kejadian (opsional)" placeholder="Jalan, RT/RW, patokan terdekat" value={alamatKejadian} onChangeText={setAlamatKejadian} />

            <View style={styles.mediaGroup}>
              <Text style={[styles.mediaLabel, { color: colors.foreground }]}>Foto Bukti (opsional)</Text>
              <PhotoBox uri={fotoUri} onPress={mengirim ? undefined : () => setDialogMedia('foto')} />
              <Text style={[styles.mediaHint, { color: colors.mutedForeground }]}>Satu foto kondisi di lapangan sangat membantu petugas menyiapkan alat sebelum berangkat.</Text>
            </View>

            <View style={styles.mediaGroup}>
              <Text style={[styles.mediaLabel, { color: colors.foreground }]}>Video Bukti (opsional)</Text>
              <VideoBox terisi={videoUri != null} onPress={mengirim ? undefined : () => setDialogMedia('video')} />
              <Text style={[styles.mediaHint, { color: colors.mutedForeground }]}>Klip pendek 30–60 detik (maks 60) — mis. aliran air bocor. Ditampilkan dalam kualitas teroptimasi.</Text>
            </View>

            <Field label="Nama Pelapor" placeholder="Nama lengkap Anda" value={pelapor} onChangeText={setPelapor} error={errors.pelapor} />
            <Field label="Nomor HP / Kontak" placeholder="08xxxxxxxxxx" value={kontakPelapor} onChangeText={setKontakPelapor} keyboardType="phone-pad" error={errors.kontakPelapor} />
            <Field
              label="Nomor Langganan (opsional)"
              placeholder="11 digit, bila Anda pelanggan"
              description="Membantu petugas menautkan pengaduan ke data langganan."
              value={nomorLangganan}
              onChangeText={(t) => setNomorLangganan(t.replace(/\D/g, '').slice(0, 11))}
              keyboardType="number-pad"
              error={errors.nomorLangganan}
            />

            {galat != null ? (
              <Alert icon={TriangleAlert} variant="destructive">
                <AlertTitle>Gagal mengirim</AlertTitle>
                <AlertDescription>{galat}</AlertDescription>
              </Alert>
            ) : null}

            <Button onPress={kirim} disabled={mengirim} className="h-11 w-full">
              {mengirim ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Ionicons name="paper-plane" size={16} color={colors.primaryForeground} />
              )}
              <UIText>{mengirim ? 'Mengirim…' : 'Kirim Pengaduan'}</UIText>
            </Button>
          </View>
        </ScrollView>
      }
    >
      {/* Dialog pilih sumber foto/video */}
      <AppDialog
        visible={dialogMedia != null}
        onDismiss={() => setDialogMedia(null)}
        title={dialogMedia === 'video' ? 'Video Bukti' : 'Foto Bukti'}
        description={
          dialogMedia === 'video'
            ? 'Klip pendek (maksimal 60 detik) — mis. suara/aliran air bocor.'
            : 'Satu foto kondisi di lapangan sangat membantu petugas menyiapkan alat sebelum berangkat.'
        }
        actions={
          <>
            <Button onPress={() => pilihMedia('kamera')} className="h-11 w-full">
              <UIText>Kamera</UIText>
            </Button>
            <Button variant="outline" onPress={() => pilihMedia('galeri')} className="h-11 w-full">
              <UIText>Galeri</UIText>
            </Button>
            {(dialogMedia === 'foto' && fotoUri != null) || (dialogMedia === 'video' && videoUri != null) ? (
              <Button
                variant="destructive"
                className="h-11 w-full"
                onPress={() => {
                  if (dialogMedia === 'foto') setFotoUri(null);
                  else setVideoUri(null);
                  setDialogMedia(null);
                }}
              >
                <UIText>Hapus</UIText>
              </Button>
            ) : null}
          </>
        }
      />

      {/* Dialog sukses */}
      <AppDialog
        visible={tanda != null}
        onDismiss={() => setTanda(null)}
        title="Pengaduan Diterima"
        description={
          tanda != null
            ? `${tanda.pesan}\n\nNomor tiket Anda:\n${tanda.nomorTiket}` +
              (tanda.targetSelesaiAt ? `\n\nTarget penyelesaian: ${formatTanggalUtc(tanda.targetSelesaiAt)}` : '') +
              (sudahLogin
                ? '\n\nLaporan ini otomatis tersimpan di akun Anda — buka "Laporan Saya" kapan saja.'
                : '\n\nBelum punya akun? Daftar supaya laporan Anda tersimpan otomatis.')
            : ''
        }
        actions={
          <>
            {!sudahLogin ? (
              <Button
                variant="outline"
                className="h-11 w-full"
                onPress={() => {
                  setTanda(null);
                  router.push('/Daftar');
                }}
              >
                <UIText>Daftar Akun</UIText>
              </Button>
            ) : null}
            <Button onPress={() => setTanda(null)} className="h-11 w-full">
              <UIText>Selesai</UIText>
            </Button>
          </>
        }
      />
    </AppScaffold>
  );
}

/**
 * Kotak pemilih video — pola sama seperti PhotoBox tapi tanpa pratinjau bingkai
 * (thumbnail video butuh paket tambahan); cukup menandai "sudah terpilih".
 */
function VideoBox({ terisi, onPress }: { terisi: boolean; onPress?: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.videoBox,
        { backgroundColor: colors.muted, borderColor: terisi ? colors.primary : colors.border, borderRadius: radius.sm },
      ]}
    >
      <Ionicons
        name={terisi ? 'checkmark-circle' : 'videocam'}
        size={24}
        color={terisi ? colors.primary : colors.mutedForeground}
      />
      <Text style={[styles.videoText, { color: colors.mutedForeground }]}>
        {terisi ? 'Video siap dikirim · ketuk untuk ganti' : 'Ambil / pilih video'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  form: { gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  mediaGroup: { gap: 8 },
  mediaLabel: { fontSize: 14, fontWeight: '600' },
  mediaHint: { fontSize: 11, lineHeight: 16 },
  videoBox: {
    height: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  videoText: { fontSize: 13 },
});
