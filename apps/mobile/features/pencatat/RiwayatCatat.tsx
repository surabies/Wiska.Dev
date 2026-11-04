/**
 * riwayat-screen.tsx — seluruh hasil catat AKUN INI pada periode berjalan,
 * beserta status verifikasinya. Padanan `riwayat_screen.dart` (`tv_today_reading`
 * + daftar read Aurora, ditambah status berjenjang yang Aurora tidak punya).
 *
 * Menggabungkan DUA sumber dengan sengaja: baris yang masih ANTRE di
 * perangkat dan baris yang sudah ada di server. Tanpa penggabungan itu,
 * "riwayat" akan bohong tepat pada saat paling penting — sore hari setelah
 * seharian bekerja offline, ketika daftar server masih kosong.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  RotateCw,
  TriangleAlert,
  WifiOff,
  XCircle,
} from 'lucide-react-native';
import {
  ApiException,
  dicatatHariIni,
  formatWaktuLokal,
  labelDari,
  labelKondisiMeter,
  labelPeriode,
  type LaporanSaya,
  type StatusVerifLaporan,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Berat,
  GlassPanel,
  MasterPalette as P,
  Spasi,
  Teks,
  TinggiBaris,
  UkuranIkon,
  useTheme,
  Tekan,
} from '@/components';
import { IsiStrip, LayarGradasi, PADDING_ISI } from '@/features/pencatat/components/LayarGradasi';
import { CompactStat, type Ikon } from '@/features/pencatat/components/WorkspacePetugas';
import { periodeCatatSekarang, riwayatSaya } from './lib/RepositoryBacaMeter';

const IKON_STATUS: Record<StatusVerifLaporan, Ikon> = {
  ANTRE: WifiOff,
  MENUNGGU: Clock,
  DIVERIFIKASI: CheckCircle2,
  DITOLAK: XCircle,
};

const LABEL_STATUS: Record<StatusVerifLaporan, string> = {
  ANTRE: 'Antre di perangkat',
  MENUNGGU: 'Menunggu verifikasi',
  DIVERIFIKASI: 'Diverifikasi',
  DITOLAK: 'Ditolak',
};

export function RiwayatScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [daftar, setDaftar] = useState<LaporanSaya[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      setDaftar(await riwayatSaya());
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal memuat riwayat.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const angka = useMemo(() => {
    const hitung = (s: StatusVerifLaporan) => daftar.filter((l) => l.statusVerif === s).length;
    return {
      total: daftar.length,
      hariIni: daftar.filter(dicatatHariIni).length,
      antre: hitung('ANTRE'),
      ditolak: hitung('DITOLAK'),
    };
  }, [daftar]);

  const periode = periodeCatatSekarang();

  // Kepala daftar sebagai ELEMEN (bukan fungsi komponen) — lihat catatan yang
  // sama di pelanggan-rute-screen.tsx.
  const kepala = (
    <View style={styles.kepala}>
      <View style={styles.statBaris}>
        <CompactStat label="Dicatat periode ini" nilai={String(angka.total)} ikon={CheckCircle2} />
        <CompactStat label="Hari ini" nilai={String(angka.hariIni)} ikon={Clock} />
      </View>
      <View style={[styles.statBaris, styles.jarakKecil]}>
        <CompactStat
          label="Antre kirim"
          nilai={String(angka.antre)}
          ikon={WifiOff}
          bahaya={angka.antre > 0}
        />
        <CompactStat
          label="Ditolak"
          nilai={String(angka.ditolak)}
          ikon={XCircle}
          bahaya={angka.ditolak > 0}
        />
      </View>

      {galat != null ? (
        <View style={styles.jarak}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Gagal memuat</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {daftar.length > 0 ? (
        <Text style={[styles.judulDaftar, { color: colors.foreground }]}>Daftar pencatatan</Text>
      ) : null}
    </View>
  );

  return (
    <LayarGradasi
      judul="Riwayat Catat"
      subjudul={`Hasil kerja Anda · ${labelPeriode(periode)}`}
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
      kanan={
        <Tekan
          onPress={() => void muat()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Segarkan"
          style={({ pressed }) => pressed && styles.ditekan}
        >
          <RotateCw size={UkuranIkon.sedang} color="#FFFFFF" />
        </Tekan>
      }
      strip={
        <IsiStrip
          kiri={`${angka.total} dicatat periode ini`}
          kanan={angka.hariIni > 0 ? `${angka.hariIni} hari ini` : null}
        />
      }
      gulir={false}
    >
      <FlatList
        data={daftar}
        keyExtractor={(l, i) => `${l.nomorLangganan}-${l.id ?? i}`}
        ListHeaderComponent={kepala}
        contentContainerStyle={{
          paddingHorizontal: PADDING_ISI,
          paddingTop: PADDING_ISI,
          paddingBottom: insets.bottom + Spasi.xl,
        }}
        // Sebulan kerja satu petugas = ribuan baris; jendela render dijaga
        // sempit seperti di daftar pelanggan rute.
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshing={memuat}
        onRefresh={() => void muat()}
        ListEmptyComponent={
          memuat ? (
            <View style={styles.tengah}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <Text style={[styles.kosong, { color: colors.mutedForeground }]}>
              Belum ada hasil catat pada periode ini. Mulai dari menu Baca Meter.
            </Text>
          )
        }
        renderItem={({ item }) => <BarisRiwayat laporan={item} />}
      />
    </LayarGradasi>
  );
}

function BarisRiwayat({ laporan }: { laporan: LaporanSaya }) {
  const { colors } = useTheme();
  const Ikon = IKON_STATUS[laporan.statusVerif];
  const warna =
    laporan.statusVerif === 'DIVERIFIKASI'
      ? P.emerald600
      : laporan.statusVerif === 'DITOLAK'
        ? colors.destructive
        : colors.mutedForeground;

  const pemakaian =
    laporan.pemakaian ??
    (laporan.standAkhir != null && laporan.standAwal != null
      ? laporan.standAkhir - laporan.standAwal
      : null);

  return (
    <GlassPanel padding={Spasi.lg} style={styles.baris}>
      <View style={styles.barisAtas}>
        <Ikon size={UkuranIkon.sedang} color={warna} />
        <Text style={[styles.barisNomor, { color: colors.foreground }]}>
          {laporan.nomorLangganan}
        </Text>
        <Text style={[styles.barisStatus, { color: warna }]}>
          {LABEL_STATUS[laporan.statusVerif]}
        </Text>
      </View>

      {laporan.namaPelanggan != null ? (
        <Text numberOfLines={1} style={[styles.barisNama, { color: colors.foreground }]}>
          {laporan.namaPelanggan}
        </Text>
      ) : null}

      <Text style={[styles.barisRincian, { color: colors.mutedForeground }]}>
        Stand {laporan.standAwal ?? '—'} → {laporan.standAkhir ?? '—'}
        {pemakaian != null ? ` · ${pemakaian} m³` : ''}
        {laporan.kondisi != null ? ` · ${labelDari(labelKondisiMeter, laporan.kondisi)}` : ''}
      </Text>

      {laporan.tanggalCatat != null ? (
        <Text style={[styles.barisWaktu, { color: colors.mutedForeground }]}>
          Dicatat {formatWaktuLokal(laporan.tanggalCatat)}
        </Text>
      ) : null}

      {laporan.pesanGagal != null ? (
        <Text style={[styles.barisPesan, { color: colors.destructive }]}>
          Ditolak server: {laporan.pesanGagal}
        </Text>
      ) : null}

      {laporan.catatanVerif != null ? (
        <Text style={[styles.barisPesan, { color: colors.mutedForeground }]}>
          Catatan verifikator: {laporan.catatanVerif}
        </Text>
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  ditekan: { opacity: 0.7 },
  kepala: { paddingBottom: Spasi.xs },
  statBaris: { flexDirection: 'row', gap: Spasi.md },
  jarakKecil: { marginTop: Spasi.md },
  jarak: { marginTop: Spasi.lg },
  tengah: { paddingVertical: Spasi.xxl + Spasi.lg, alignItems: 'center' },
  kosong: {
    fontSize: Teks.sm,
    textAlign: 'center',
    paddingVertical: Spasi.xxl,
    lineHeight: TinggiBaris.sm,
  },
  judulDaftar: {
    fontSize: Teks.base,
    fontWeight: Berat.tebal,
    marginTop: Spasi.xl,
    marginBottom: Spasi.md,
  },
  baris: { marginBottom: Spasi.md },
  barisAtas: { flexDirection: 'row', alignItems: 'center', gap: Spasi.sm },
  barisNomor: { flex: 1, fontSize: Teks.sm, fontWeight: Berat.semi },
  barisStatus: { fontSize: Teks.xs, fontWeight: Berat.semi },
  barisNama: { fontSize: Teks.sm, marginTop: Spasi.xs },
  barisRincian: { fontSize: Teks.xs, marginTop: Spasi.xs },
  barisWaktu: { fontSize: Teks.xs, marginTop: Spasi.xs },
  barisPesan: { fontSize: Teks.xs, marginTop: Spasi.sm, lineHeight: TinggiBaris.xs },
});
