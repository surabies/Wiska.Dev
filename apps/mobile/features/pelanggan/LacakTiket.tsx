/**
 * lacak-tiket-screen.tsx — Lacak Tiket (publik). Padanan
 * features/public/pengaduan/lacak_tiket_screen.dart.
 *
 * Nomor tiket TW-YYMM-XXXXXX menjadi kunci akses; menampilkan status terkini +
 * linimasa publik + aksi pelapor (konfirmasi/nilai atau buka-kembali) + chat.
 * `nomorAwal` (dari param rute) dipakai Laporan Saya untuk taut-langsung.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Text as UIText } from '@/components/ui/text';
import {
  AppScaffold,
  MasterPalette as P,
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
  type LacakTiketResult,
  type TicketTimelineEntry,
} from '@workspace/mobile-core';

import { buatLaporPengaduanRepository, type LaporPengaduanRepository } from './lib/RepositoryPengaduan';

const RE_TIKET = /^TW-\d{4}-[A-Za-z0-9]{6}$/;

export function LacakTiketScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ nomor?: string }>();
  const nomorAwal = typeof params.nomor === 'string' ? params.nomor : undefined;

  const [repo] = useState(buatLaporPengaduanRepository);
  const [nomor, setNomor] = useState(nomorAwal ?? '');
  const [errNomor, setErrNomor] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<LacakTiketResult | null>(null);

  const lacak = async (nomorLangsung?: string) => {
    const target = (nomorLangsung ?? nomor).trim().toUpperCase();
    if (!RE_TIKET.test(target)) {
      setErrNomor('Format nomor tiket: TW-YYMM-XXXXXX.');
      return;
    }
    setErrNomor(null);
    setMemuat(true);
    setGalat(null);
    setHasil(null);
    try {
      setHasil(await repo.lacak(target));
    } catch (e) {
      setGalat(ApiException.is(e) ? e.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setMemuat(false);
    }
  };

  // Taut-langsung: cari otomatis saat dibuka dengan nomor awal.
  useEffect(() => {
    if (nomorAwal && RE_TIKET.test(nomorAwal.trim().toUpperCase())) void lacak(nomorAwal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppScaffold
      title="Lacak Tiket"
      subtitle="Pantau status pengaduan Anda"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card>
            <CardHeader>
              <CardTitle>Nomor Tiket</CardTitle>
              <CardDescription>
                Masukkan nomor tiket dari tanda terima pengaduan Anda, format TW-YYMM-XXXXXX.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <View style={styles.form}>
                <Field value={nomor} onChangeText={setNomor} placeholder="TW-2607-XXXXXX" autoCapitalize="characters" error={errNomor} />
                <Button onPress={() => lacak()} disabled={memuat} className="h-11 w-full">
                  {memuat ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Ionicons name="search" size={16} color={colors.primaryForeground} />
                  )}
                  <UIText>{memuat ? 'Mencari…' : 'Lacak'}</UIText>
                </Button>
              </View>
            </CardContent>
          </Card>

          {galat != null ? (
            <View style={styles.spacer}>
              <Alert icon={TriangleAlert} variant="destructive">
                <AlertTitle>Tidak ditemukan</AlertTitle>
                <AlertDescription>{galat}</AlertDescription>
              </Alert>
            </View>
          ) : null}

          {hasil != null ? (
            <View style={styles.hasil}>
              <DetailTiket hasil={hasil} />
              {hasil.bisaDinilai || hasil.bisaDibukaKembali ? (
                <AksiPelapor repo={repo} nomorTiket={hasil.nomorTiket} bisaDinilai={hasil.bisaDinilai} bisaDibukaKembali={hasil.bisaDibukaKembali} onSelesai={() => lacak(hasil.nomorTiket)} />
              ) : null}
              {hasil.bisaChat || hasil.riwayat.some((e) => e.aksi === 'CHAT') ? (
                <ChatTiket repo={repo} nomorTiket={hasil.nomorTiket} entri={hasil.riwayat.filter((e) => e.aksi === 'CHAT')} bisaChat={hasil.bisaChat} onTerkirim={() => lacak(hasil.nomorTiket)} />
              ) : null}
              <Linimasa entri={hasil.riwayat.filter((e) => e.aksi !== 'CHAT')} />
            </View>
          ) : null}
        </ScrollView>
      }
    />
  );
}

function DetailTiket({ hasil }: { hasil: LacakTiketResult }) {
  const { colors } = useTheme();
  const fotoValid = hasil.fotoPenyelesaianUrl != null && hasil.fotoPenyelesaianUrl.startsWith('http');
  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <CardTitle>{hasil.judul}</CardTitle>
            <CardDescription>
              {`${hasil.nomorTiket} · ${labelDari(labelJenisPengaduan, hasil.jenis)}`}
            </CardDescription>
          </View>
          <StatusBadge label={labelDari(labelStatusPengaduanWarga, hasil.status)} tone={toneStatusPengaduan(hasil.status)} />
        </View>
      </CardHeader>
      <CardContent>
      <View style={styles.detail}>
        {hasil.ditugaskanKe != null ? (
          <BarisIkon ikon="person-circle" teks={`Ditangani: ${hasil.ditugaskanKe}`} />
        ) : null}
        {hasil.sla?.targetSelesaiAt != null ? (
          <BarisIkon
            ikon="time-outline"
            warna={hasil.sla.melanggar ? colors.destructive : colors.mutedForeground}
            teks={`Target selesai: ${formatWaktuLokal(hasil.sla.targetSelesaiAt)}`}
          />
        ) : null}
        {hasil.catatanPenyelesaian != null ? (
          <Text style={[styles.detailTeks, { color: colors.foreground }]}>Penyelesaian: {hasil.catatanPenyelesaian}</Text>
        ) : null}
        {fotoValid ? (
          <Image source={{ uri: hasil.fotoPenyelesaianUrl! }} style={styles.fotoBukti} resizeMode="cover" />
        ) : null}
        {hasil.status === 'SELESAI' && hasil.konfirmasiBatasAt != null ? (
          <BarisIkon
            ikon="timer-outline"
            warna={P.rose600}
            teks={`Konfirmasi sebelum ${formatWaktuLokal(hasil.konfirmasiBatasAt)} — lewat itu tiket ditutup otomatis.`}
          />
        ) : null}
      </View>
      </CardContent>
    </Card>
  );
}

function BarisIkon({ ikon, teks, warna }: { ikon: React.ComponentProps<typeof Ionicons>['name']; teks: string; warna?: string }) {
  const { colors } = useTheme();
  const c = warna ?? colors.mutedForeground;
  return (
    <View style={styles.barisIkon}>
      <Ionicons name={ikon} size={14} color={c} />
      <Text style={[styles.barisIkonTeks, { color: c }]}>{teks}</Text>
    </View>
  );
}

type ModeAksi = 'pilih' | 'nilai' | 'buka';

function AksiPelapor({
  repo,
  nomorTiket,
  bisaDinilai,
  bisaDibukaKembali,
  onSelesai,
}: {
  repo: LaporPengaduanRepository;
  nomorTiket: string;
  bisaDinilai: boolean;
  bisaDibukaKembali: boolean;
  onSelesai: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<ModeAksi>('pilih');
  const [rating, setRating] = useState(0);
  const [komentar, setKomentar] = useState('');
  const [alasan, setAlasan] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const kirimNilai = async () => {
    if (rating === 0) return;
    setMengirim(true);
    setGalat(null);
    try {
      await repo.konfirmasi(nomorTiket, { rating, komentar: komentar.trim() || undefined });
      await onSelesai();
    } catch (e) {
      setGalat(ApiException.is(e) ? e.message : 'Gagal.');
    } finally {
      setMengirim(false);
    }
  };

  const kirimBukaKembali = async () => {
    if (alasan.trim().length < 10) {
      setGalat('Ceritakan apa yang masih bermasalah (minimal 10 karakter).');
      return;
    }
    setMengirim(true);
    setGalat(null);
    try {
      await repo.bukaKembali(nomorTiket, alasan.trim());
      await onSelesai();
    } catch (e) {
      setGalat(ApiException.is(e) ? e.message : 'Gagal.');
    } finally {
      setMengirim(false);
    }
  };

  if (mode === 'nilai') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seberapa puas Anda dengan penanganannya?</CardTitle>
        </CardHeader>
        <CardContent>
        <View style={styles.aksiBody}>
          <View style={styles.bintangRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} disabled={mengirim} onPress={() => setRating(n)} hitSlop={4}>
                <Ionicons name="star" size={30} color={n <= rating ? P.rose400 : colors.mutedForeground} style={n <= rating ? undefined : styles.bintangRedup} />
              </Pressable>
            ))}
          </View>
          <Field value={komentar} onChangeText={setKomentar} placeholder="Ceritakan pengalaman Anda (opsional)" multiline editable={!mengirim} />
          {galat != null ? (
            <Alert icon={TriangleAlert} variant="destructive">
              <AlertTitle>Gagal</AlertTitle>
              <AlertDescription>{galat}</AlertDescription>
            </Alert>
          ) : null}
          <View style={styles.aksiTombol}>
            <View style={styles.aksiUtama}>
              <Button onPress={kirimNilai} disabled={mengirim || rating === 0} className="h-11 w-full">
                {mengirim ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Ionicons name="thumbs-up" size={16} color={colors.primaryForeground} />
                )}
                <UIText>{mengirim ? 'Mengirim…' : 'Kirim & tutup tiket'}</UIText>
              </Button>
            </View>
            <Button variant="ghost" disabled={mengirim} onPress={() => setMode('pilih')} className="h-11">
              <UIText>Batal</UIText>
            </Button>
          </View>
        </View>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'buka') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Apa yang masih bermasalah?</CardTitle>
        </CardHeader>
        <CardContent>
        <View style={styles.aksiBody}>
          <Field value={alasan} onChangeText={setAlasan} placeholder="Mis. air sempat mengalir tapi mati lagi keesokan harinya…" multiline editable={!mengirim} description="Tiket yang sama akan dibuka kembali — riwayat penanganannya tidak hilang." />
          {galat != null ? (
            <Alert icon={TriangleAlert} variant="destructive">
              <AlertTitle>Gagal</AlertTitle>
              <AlertDescription>{galat}</AlertDescription>
            </Alert>
          ) : null}
          <View style={styles.aksiTombol}>
            <View style={styles.aksiUtama}>
              <Button variant="destructive" onPress={kirimBukaKembali} disabled={mengirim} className="h-11 w-full">
                {mengirim ? (
                  <ActivityIndicator size="small" color={colors.destructiveForeground} />
                ) : (
                  <Ionicons name="refresh" size={16} color={colors.destructiveForeground} />
                )}
                <UIText>{mengirim ? 'Mengirim…' : 'Buka kembali tiket'}</UIText>
              </Button>
            </View>
            <Button variant="ghost" disabled={mengirim} onPress={() => setMode('pilih')} className="h-11">
              <UIText>Batal</UIText>
            </Button>
          </View>
        </View>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apakah masalah Anda sudah benar-benar selesai?</CardTitle>
        <CardDescription>Tiket ini baru ditutup setelah Anda yang mengonfirmasi — bukan petugas.</CardDescription>
      </CardHeader>
      <CardContent>
      <View style={styles.pilihRow}>
        {bisaDinilai ? (
          <Button onPress={() => setMode('nilai')} className="h-11">
            <Ionicons name="thumbs-up" size={16} color={colors.primaryForeground} />
            <UIText>Ya, sudah selesai</UIText>
          </Button>
        ) : null}
        {bisaDibukaKembali ? (
          <Button variant="outline" onPress={() => setMode('buka')} className="h-11">
            <Ionicons name="refresh" size={16} color={colors.foreground} />
            <UIText>Belum, masih bermasalah</UIText>
          </Button>
        ) : null}
      </View>
      </CardContent>
    </Card>
  );
}

function ChatTiket({
  repo,
  nomorTiket,
  entri,
  bisaChat,
  onTerkirim,
}: {
  repo: LaporPengaduanRepository;
  nomorTiket: string;
  entri: TicketTimelineEntry[];
  bisaChat: boolean;
  onTerkirim: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const [pesan, setPesan] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const kirim = async () => {
    if (pesan.trim().length === 0) return;
    setMengirim(true);
    setGalat(null);
    try {
      await repo.kirimChat(nomorTiket, pesan.trim());
      setPesan('');
      await onTerkirim();
    } catch (e) {
      setGalat(ApiException.is(e) ? e.message : 'Gagal.');
    } finally {
      setMengirim(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Percakapan dengan Petugas</CardTitle>
        <CardDescription>
          {bisaChat ? 'Balasan petugas muncul di sini setiap kali Anda memuat ulang tiket.' : 'Tiket sudah ditutup — percakapan berakhir.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
      <View style={styles.chatBody}>
        {entri.length === 0 ? (
          <Text style={[styles.kosong, { color: colors.mutedForeground }]}>Belum ada pesan.</Text>
        ) : (
          entri.map((e, i) => <BubbleChat key={i} entri={e} />)
        )}
        {bisaChat ? (
          <View style={styles.chatInput}>
            <View style={styles.chatField}>
              <Field value={pesan} onChangeText={setPesan} placeholder="Tulis pesan…" editable={!mengirim} />
            </View>
            <Button onPress={kirim} disabled={mengirim} className="h-11">
              {mengirim ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Ionicons name="paper-plane" size={15} color={colors.primaryForeground} />
              )}
              <UIText>Kirim</UIText>
            </Button>
          </View>
        ) : null}
        {galat != null ? <Text style={[styles.chatGalat, { color: colors.destructive }]}>{galat}</Text> : null}
      </View>
      </CardContent>
    </Card>
  );
}

function BubbleChat({ entri }: { entri: TicketTimelineEntry }) {
  const { colors, isDark } = useTheme();
  const dariPelapor = entri.olehNama === 'Pelapor';
  return (
    <View style={[styles.bubbleWrap, { alignItems: dariPelapor ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: dariPelapor ? (isDark ? P.sky900 : P.sky100) : colors.secondary,
            borderBottomLeftRadius: dariPelapor ? 12 : 3,
            borderBottomRightRadius: dariPelapor ? 3 : 12,
          },
        ]}
      >
        <Text style={[styles.bubbleNama, { color: dariPelapor ? (isDark ? P.sky300 : P.sky700) : colors.mutedForeground }]}>
          {dariPelapor ? 'Anda' : (entri.olehNama ?? 'Petugas')}
        </Text>
        <Text style={[styles.bubbleTeks, { color: dariPelapor ? (isDark ? P.sky100 : P.sky900) : colors.foreground }]}>
          {entri.catatan ?? ''}
        </Text>
        {entri.createdAt != null ? (
          <Text style={[styles.bubbleWaktu, { color: colors.mutedForeground }]}>{formatWaktuLokal(entri.createdAt)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Linimasa({ entri }: { entri: TicketTimelineEntry[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.linimasaWrap}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Linimasa Penanganan</Text>
      {entri.length === 0 ? (
        <Text style={[styles.kosong, { color: colors.mutedForeground }]}>Belum ada pembaruan.</Text>
      ) : (
        <Card className="gap-0 p-4">
          {entri.map((e, i) => (
            <BarisLinimasa key={i} entri={e} terakhir={i === entri.length - 1} />
          ))}
        </Card>
      )}
    </View>
  );
}

function BarisLinimasa({ entri, terakhir }: { entri: TicketTimelineEntry; terakhir: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.linimasaBaris}>
      <View style={styles.linimasaRel}>
        <View style={[styles.titik, { backgroundColor: terakhir ? colors.primary : colors.mutedForeground }]} />
        {!terakhir ? <View style={[styles.garis, { backgroundColor: colors.border }]} /> : null}
      </View>
      <View style={[styles.linimasaKonten, terakhir ? null : styles.linimasaKontenGap]}>
        <Text style={[styles.linimasaJudul, { color: colors.foreground }]}>
          {entri.statusKe == null ? entri.aksi : labelDari(labelStatusPengaduanWarga, entri.statusKe)}
        </Text>
        {entri.catatan != null ? <Text style={[styles.linimasaCatatan, { color: colors.mutedForeground }]}>{entri.catatan}</Text> : null}
        <Text style={[styles.linimasaMeta, { color: colors.mutedForeground }]}>
          {entri.olehNama ?? '-'}
          {entri.createdAt != null ? ` · ${formatWaktuLokal(entri.createdAt)}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  form: { marginTop: 12, gap: 12 },
  spacer: { marginTop: 16 },
  hasil: { marginTop: 16, gap: 16 },
  detail: { marginTop: 10, gap: 6 },
  detailTeks: { fontSize: 14, lineHeight: 20 },
  fotoBukti: { height: 140, width: '100%', borderRadius: 10 },
  barisIkon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barisIkonTeks: { flex: 1, fontSize: 13 },
  aksiBody: { marginTop: 10, gap: 10 },
  bintangRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  bintangRedup: { opacity: 0.4 },
  aksiTombol: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aksiUtama: { flex: 1 },
  pilihRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chatBody: { marginTop: 10, gap: 4 },
  chatInput: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 },
  chatField: { flex: 1 },
  chatGalat: { fontSize: 12.5, marginTop: 4 },
  kosong: { fontSize: 14, lineHeight: 20 },
  bubbleWrap: { marginBottom: 8 },
  bubble: { maxWidth: 280, paddingHorizontal: 12, paddingVertical: 8, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  bubbleNama: { fontSize: 10.5, fontWeight: '700' },
  bubbleTeks: { fontSize: 14, marginTop: 2, lineHeight: 19 },
  bubbleWaktu: { fontSize: 9.5, marginTop: 2 },
  linimasaWrap: { gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  linimasaBaris: { flexDirection: 'row' },
  linimasaRel: { alignItems: 'center', width: 12 },
  titik: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  garis: { width: 2, flex: 1, marginTop: 2 },
  linimasaKonten: { flex: 1, marginLeft: 12 },
  linimasaKontenGap: { paddingBottom: 16 },
  linimasaJudul: { fontSize: 14, fontWeight: '600' },
  linimasaCatatan: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  linimasaMeta: { fontSize: 11, marginTop: 2 },
});
