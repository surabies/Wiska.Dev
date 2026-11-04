/**
 * pelanggan-rute-screen.tsx — daftar pelanggan SATU rute yang sedang
 * dikerjakan. Padanan `pelanggan_rute_screen.dart` (pola
 * `daftarPelangganUnRead/Read` Aurora).
 *
 * Urut nomor urut rute, tab Belum/Sudah dibaca, dan pencarian — semuanya
 * dibatasi ke rute ini. Data dibaca dari CACHE LOKAL (rutenya sudah diunduh
 * di layar sebelumnya), jadi ringan dan jalan penuh tanpa sinyal.
 *
 * Daftar tab aktif juga menjadi URUTAN KUNJUNGAN untuk tombol
 * sebelumnya/berikutnya di layar catat — itu sebabnya urutannya tidak boleh
 * diacak oleh pencarian.
 *
 * FLATLIST ADALAH SATU-SATUNYA PENGGULIR DI SINI, dan itu bukan detail gaya.
 * Sebelumnya FlatList dipasang dengan `scrollEnabled={false}` di dalam
 * ScrollView milik kerangka halaman. Pola itu mematikan virtualisasi:
 * VirtualizedList menghitung jendela render dari peristiwa gulir penggulir
 * yang MEMILIKINYA, dan ketika ia tidak menggulir, tidak ada yang memberitahu
 * baris mana yang perlu ada. Untuk rute berisi 2.500-an pelanggan (dan itu
 * ukuran rute yang normal di sini — IWAN memegang 2.552) hasilnya daftar yang
 * berat sekaligus tidak lengkap. Karena itu kerangka dipanggil dengan
 * `gulir={false}` dan seluruh chrome layar (progres, pencarian, tab) pindah ke
 * `ListHeaderComponent`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { CheckCircle2, ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { labelPeriode, type PelangganRute, type RuteSaya } from '@workspace/mobile-core';
import { Input } from '@/components/ui/input';
import {
  Radius,
  Berat,
  GlassPanel,
  Kelas,
  MasterPalette as P,
  Spasi,
  Teks,
  TinggiBaris,
  TinggiKontrol,
  UkuranIkon,
  useTheme,
  Tekan,
} from '@/components';
import { IsiStrip, LayarGradasi, PADDING_ISI } from '@/features/pencatat/components/LayarGradasi';
import { periodeCatatSekarang, ruteSaya } from './lib/RepositoryBacaMeter';

/**
 * Tinggi satu baris, dipakai `getItemLayout`. Karena semua baris berukuran
 * SAMA (nama & alamat dipotong `numberOfLines={1}`), tingginya bisa dihitung
 * alih-alih diukur — FlatList jadi bisa melompat ke posisi mana pun tanpa
 * merender baris di antaranya. Nilainya: padding atas+bawah + dua baris teks.
 */
const TINGGI_BARIS = Spasi.md * 2 + 44;

export function PelangganRuteScreen({
  kodeRute,
  onBack,
  onBukaCatat,
}: {
  kodeRute: string;
  onBack: () => void;
  onBukaCatat: (nomorLangganan: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [paket, setPaket] = useState<RuteSaya | null>(null);
  const [kunci, setKunci] = useState('');
  const [tabSudah, setTabSudah] = useState(false);

  // Cache saja: rutenya sudah diunduh di layar sebelumnya, dan mencatat
  // memperbarui DAO sehingga statusnya langsung tampak di sini.
  const muat = useCallback(async () => {
    setPaket(await ruteSaya({ segarkan: false }).catch(() => null));
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  const pelangganRute = useMemo(
    () => (paket?.pelanggan ?? []).filter((p) => p.ruteKode === kodeRute),
    [paket, kodeRute],
  );

  const target = pelangganRute.length;
  const terbaca = pelangganRute.filter((p) => p.sudahDicatat).length;

  /** Daftar tab aktif — juga urutan kunjungan untuk tombol berikutnya. */
  const daftarTab = useMemo(
    () => pelangganRute.filter((p) => p.sudahDicatat === tabSudah),
    [pelangganRute, tabSudah],
  );

  const tersaring = useMemo(() => {
    const k = kunci.trim().toLowerCase();
    if (k.length === 0) return daftarTab;
    return daftarTab.filter(
      (p) =>
        p.nomorLangganan.includes(k) ||
        p.nama.toLowerCase().includes(k) ||
        (p.alamat ?? '').toLowerCase().includes(k),
    );
  }, [daftarTab, kunci]);

  const seksi = paket?.rutes.find((r) => r.kode === kodeRute)?.seksiCater;
  const periode = paket?.periode ?? periodeCatatSekarang();

  /*
   * Kepala daftar dioper sebagai ELEMEN (bukan fungsi komponen). Kalau ia
   * ditulis `ListHeaderComponent={() => <View>…}`, setiap render membuat tipe
   * komponen BARU sehingga React melepas lalu memasang ulang isinya — dan
   * field pencarian kehilangan fokus setiap satu huruf diketik. Sebagai
   * elemen, tipenya tetap View dan rekonsiliasinya biasa saja.
   */
  const kepala = (
    <View style={styles.kepala}>

      <View style={styles.cari}>
        <Input
          value={kunci}
          onChangeText={setKunci}
          placeholder="Cari nomor langganan / nama / alamat…"
          autoCapitalize="none"
          className={`${Kelas.input} pl-11`}
        />
        <View style={styles.ikonCari} pointerEvents="none">
          <Search size={UkuranIkon.sedang} color={colors.mutedForeground} />
        </View>
      </View>

      <View style={styles.tabBaris}>
        <TombolTab
          label={`Belum dibaca (${target - terbaca})`}
          aktif={!tabSudah}
          onPress={() => setTabSudah(false)}
        />
        <TombolTab
          label={`Sudah dibaca (${terbaca})`}
          aktif={tabSudah}
          onPress={() => setTabSudah(true)}
        />
      </View>
    </View>
  );

  return (
    <LayarGradasi
      judul={`Rute ${kodeRute}`}
      subjudul={seksi ?? 'Rute pencatatan'}
      kiri={
        <Tekan
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={({ pressed }) => pressed && styles.ditekan}
        >
          <ChevronLeft size={22} color="#FFFFFF" />
        </Tekan>
      }
      // Progres rute naik ke strip: angka yang paling sering dicek petugas
      // sepanjang hari, dan di sini ia tidak ikut tergulir bersama daftar.
      strip={<IsiStrip kiri={`${labelPeriode(periode)} · ${target} sambungan`} kanan={`${terbaca}/${target}`} />}
      gulir={false}
    >
      {paket == null ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tersaring}
          keyExtractor={(p) => p.nomorLangganan}
          ListHeaderComponent={kepala}
          contentContainerStyle={{
            paddingHorizontal: PADDING_ISI,
            paddingTop: PADDING_ISI,
            paddingBottom: insets.bottom + Spasi.xl,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          getItemLayout={(_, index) => ({
            length: TINGGI_BARIS,
            offset: TINGGI_BARIS * index,
            index,
          })}
          // Rute penuh = ribuan baris. Jendela render dijaga sempit supaya
          // menggulir cepat tidak menahan thread JS di HP kelas menengah yang
          // dipakai petugas.
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          ListEmptyComponent={
            <Text style={[styles.kosong, { color: colors.mutedForeground }]}>
              {kunci.trim().length > 0
                ? 'Tidak ada yang cocok dengan pencarian Anda.'
                : tabSudah
                  ? 'Belum ada pelanggan yang dicatat di rute ini.'
                  : 'Seluruh pelanggan rute ini sudah dibaca. Kerja bagus!'}
            </Text>
          }
          renderItem={({ item }) => (
            <BarisPelanggan
              pelanggan={item}
              onPress={() => onBukaCatat(item.nomorLangganan)}
            />
          )}
        />
      )}
    </LayarGradasi>
  );
}

function TombolTab({
  label,
  aktif,
  onPress,
}: {
  label: string;
  aktif: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Tekan
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        {
          backgroundColor: aktif ? colors.primary : colors.muted,
          borderColor: aktif ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.tabTeks, { color: aktif ? colors.primaryForeground : colors.foreground }]}
      >
        {label}
      </Text>
    </Tekan>
  );
}

function BarisPelanggan({
  pelanggan,
  onPress,
}: {
  pelanggan: PelangganRute;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Tekan onPress={onPress} accessibilityRole="button" style={styles.baris}>
      {({ pressed }) => (
        <View
          style={{
            ...styles.barisIsi,
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          }}
        >
          <View style={[styles.urut, { backgroundColor: colors.permukaan, borderColor: colors.border }]}>
            <Text style={[styles.urutTeks, { color: colors.foreground }]}>
              {pelanggan.urutan ?? '-'}
            </Text>
          </View>

          <View style={styles.barisTeks}>
            <Text numberOfLines={1} style={[styles.barisNama, { color: colors.foreground }]}>
              {pelanggan.nama}
            </Text>
            {/*
              ALAMAT berdiri sendiri di baris kedua, bukan disambung dengan nomor
              langganan lewat titik tengah. Ini layar untuk MENCARI RUMAH: alamat
              yang harus terbaca lebih dulu, dan menyambungnya membuat awalannya
              terdorong keluar oleh nomor 11 digit yang jarang dibaca di jalan.
            */}
            <Text numberOfLines={1} style={[styles.barisAlamat, { color: colors.mutedForeground }]}>
              {pelanggan.alamat ?? pelanggan.nomorLangganan}
            </Text>
          </View>

          {pelanggan.sudahDicatat ? (
            <CheckCircle2 size={UkuranIkon.besar} color={colors.primary} />
          ) : pelanggan.standLalu != null ? (
            <View style={styles.kolomStand}>
              <Text style={[styles.standLabel, { color: colors.mutedForeground }]}>lalu</Text>
              <Text style={[styles.standNilai, { color: colors.foreground }]}>
                {pelanggan.standLalu}
              </Text>
            </View>
          ) : (
            <ChevronRight size={UkuranIkon.sedang} color={colors.mutedForeground} />
          )}
        </View>
      )}
    </Tekan>
  );
}

const styles = StyleSheet.create({
  ditekan: { opacity: 0.7 },
  tengah: { paddingVertical: Spasi.xxl + Spasi.lg, alignItems: 'center' },
  kepala: { paddingBottom: Spasi.xs },

  progresBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spasi.md,
  },
  progresLabel: { fontSize: Teks.sm, fontWeight: Berat.medium },
  progresAngka: { fontSize: Teks.xs },

  cari: { marginTop: Spasi.md, justifyContent: 'center' },
  ikonCari: { position: 'absolute', left: Spasi.md },

  tabBaris: {
    flexDirection: 'row',
    gap: Spasi.sm,
    marginTop: Spasi.md,
    marginBottom: Spasi.md,
  },
  tab: {
    flex: 1,
    height: TinggiKontrol.baku,
    justifyContent: 'center',
    borderRadius: Radius.kontrol,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    paddingHorizontal: Spasi.sm,
  },
  tabTeks: { fontSize: Teks.xs, fontWeight: Berat.semi },

  kosong: {
    fontSize: Teks.sm,
    textAlign: 'center',
    paddingVertical: Spasi.xxl,
    lineHeight: TinggiBaris.sm,
  },

  // Tinggi dikunci supaya cocok dengan TINGGI_BARIS di getItemLayout.
  baris: {
    height: TINGGI_BARIS - Spasi.sm,
    marginBottom: Spasi.sm,
  },
  barisIsi: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    paddingHorizontal: Spasi.md,
    borderRadius: Radius.kartu,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  urut: {
    width: 30,
    height: 30,
    borderRadius: Radius.kecil,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  urutTeks: { fontSize: Teks.xs, fontWeight: Berat.tebal },
  barisTeks: { flex: 1, minWidth: 0 },
  barisNama: { fontSize: Teks.sm, fontWeight: Berat.medium },
  barisAlamat: { fontSize: Teks.xs, marginTop: 1 },
  kolomStand: { alignItems: 'flex-end' },
  standLabel: { fontSize: Teks.xs },
  standNilai: { fontSize: Teks.sm, fontWeight: Berat.semi },
});
