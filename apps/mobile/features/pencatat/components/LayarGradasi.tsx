/**
 * layar-gradasi.tsx — kerangka layar dengan HEADER BERGRADASI.
 *
 * KENAPA ADA. Sebelumnya beranda membangun header bergradasinya sendiri
 * sementara layar lain memakai kerangka lama yang cuma punya bar polos.
 * Akibatnya nyata: varian header yang sudah disetujui untuk layar catat tidak
 * pernah sampai ke kode, dan gradasinya "hilang" tanpa ada yang menghapusnya.
 * Satu kerangka menutup celah itu — kalau gradasinya berubah, ia berubah di
 * semua layar sekaligus.
 *
 * Anatominya, dari atas:
 *
 *   ┌ gradasi ────────────────────────────┐
 *   │ [kiri]  judul            [kanan]    │
 *   │         subjudul                    │
 *   ├ strip (opsional, varian G2) ────────┤
 *   │ alamat                        #12   │
 *   └─────────────────────────────────────┘
 *
 * STRIP memakai varian **G2**: latar `permukaan` yang solid dengan garis
 * pemisah — bukan lapisan gelap di atas gradasi. Kontras alamatnya paling
 * tinggi di antara lima varian, dan nomor urut bisa memakai warna primer.
 *
 * `mengambang` dirender sebagai saudara ScrollView, bukan anaknya, supaya
 * tombol simpan tidak hanyut bersama konten.
 */
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Berat,
  JANGKAUAN_SCAN,
  MasterPalette as P,
  Spasi,
  Teks,
  useTheme,
  useRuangDock,
} from '@/components';

export function LayarGradasi({
  judul,
  subjudul,
  kiri,
  kanan,
  strip,
  children,
  gulir = true,
  onSegarkan,
  sedangMuat = false,
  mengambang,
  latarTransparan = false,
}: {
  judul: string;
  subjudul?: string | null;
  /** Tombol di sudut kiri header (kembali / akun). */
  kiri?: ReactNode;
  /** Penanda atau aksi di sudut kanan (GPS, segarkan, lencana offline). */
  kanan?: ReactNode;
  /** Baris menempel di bawah gradasi — alamat, seksi, atau progres. */
  strip?: ReactNode;
  children: ReactNode;
  /** false = layar memasang penggulirnya sendiri (FlatList). */
  gulir?: boolean;
  onSegarkan?: () => void;
  sedangMuat?: boolean;
  mengambang?: ReactNode;
  /**
   * true = jangan cat latar `colors.background` sendiri — dipakai saat layar
   * ini dibungkus `<PremiumBackground>` dari luar (mis. beranda-screen.tsx)
   * supaya gradien+cahayanya tidak tertutup latar polos. Default false =
   * perilaku lama, aman untuk semua layar lain yang belum dibungkus.
   */
  latarTransparan?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const ruangDock = useRuangDock();

  return (
    <View style={[gaya.layar, { backgroundColor: latarTransparan ? 'transparent' : colors.background }]}>
      <LinearGradient
        colors={[P.emerald, P.teal600, P.sky600]}
        locations={[0, 0.46, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top }}
      >
        <View style={gaya.barAtas}>
          {kiri}
          <View style={gaya.teksKepala}>
            <Text numberOfLines={1} style={gaya.judul}>
              {judul}
            </Text>
            {subjudul != null && subjudul.length > 0 ? (
              <Text numberOfLines={1} style={gaya.subjudul}>
                {subjudul}
              </Text>
            ) : null}
          </View>
          {kanan}
        </View>
      </LinearGradient>

      {strip != null ? (
        <View
          style={[gaya.strip, { backgroundColor: colors.permukaan, borderBottomColor: colors.border }]}
        >
          {strip}
        </View>
      ) : null}

      {/* `behavior="padding"` DI KEDUA PLATFORM, termasuk Android.

          Versi sebelumnya memberi `undefined` di Android dengan alasan
          `softwareKeyboardLayoutMode: "resize"` sudah menanganinya — artinya
          KeyboardAvoidingView di sini TIDAK melakukan apa pun di Android.
          Asumsi itu sudah tidak berlaku: sejak edge-to-edge diwajibkan
          Android 15+ (targetSdk 36), jendela TIDAK LAGI menyusut, keyboard
          menimpa isi, dan aplikasi harus menangani inset-nya sendiri.

          Akibatnya kolom di bagian bawah — usulan perbaikan data lapangan di
          catat-screen, catatan kunjungan di anomali — mendarat persis di balik
          keyboard dan tidak bisa digulir naik. Petugas mengetik ke kolom yang
          tidak terlihat. Layar masuk sudah diperbaiki lebih dulu dan memuat
          catatan yang sama; cangkang ini tertinggal, sehingga SELURUH layar
          yang memakainya ikut membawa bug-nya. */}
      <KeyboardAvoidingView style={gaya.isi} behavior="padding">
        {gulir ? (
          <ScrollView
            // Dock bawah kini MENGAMBANG di atas konten (position:absolute),
            // supaya lekukannya menampilkan halaman sungguhan alih-alih
            // sepetak warna datar. Karena itu React Navigation TIDAK lagi
            // menyusutkan area layar ini, dan ruangnya harus disisakan sendiri
            // — `useRuangDock()` sudah termasuk safe-area.
            //
            // Tambahannya DITURUNKAN dari geometri dock, bukan ditebak: dulu
            // 26 dp, padahal tombol Scan menyembul 28 dp di atas body ditambah
            // 8 dp lekukan. Maksud komentarnya sudah benar sejak awal, hanya
            // angkanya 10 dp kurang — dan itu baru terlihat begitu ada isi
            // yang benar-benar mencapai dasar.
            contentContainerStyle={[gaya.gulungan, { paddingBottom: JANGKAUAN_SCAN + Spasi.sm + ruangDock }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            // Menggulirkan sendiri kolom yang sedang difokus ke atas keyboard,
            // melengkapi padding di atas: padding menyisakan ruang, ini yang
            // memastikan kolomnya benar-benar terlihat.
            automaticallyAdjustKeyboardInsets
            refreshControl={
              onSegarkan ? (
                <RefreshControl
                  refreshing={sedangMuat}
                  onRefresh={onSegarkan}
                  tintColor={colors.mutedForeground}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={gaya.isi}>{children}</View>
        )}
        {mengambang != null ? (
          <View style={gaya.lapisMengambang} pointerEvents="box-none">
            {mengambang}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Isi strip baku: teks kiri yang dipotong, nilai tegas di ujung kanan. */
export function IsiStrip({ kiri, kanan }: { kiri: string; kanan?: string | null }) {
  const { colors } = useTheme();
  return (
    <>
      <Text numberOfLines={1} style={[gaya.stripKiri, { color: colors.foreground }]}>
        {kiri}
      </Text>
      {kanan != null && kanan.length > 0 ? (
        <Text style={[gaya.stripKanan, { color: colors.primary }]}>{kanan}</Text>
      ) : null}
    </>
  );
}

/** Padding sisi isi — diekspor supaya layar `gulir={false}` bisa menyamainya. */
export const PADDING_ISI = Spasi.lg;

const gaya = StyleSheet.create({
  layar: { flex: 1 },
  barAtas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    paddingHorizontal: Spasi.lg,
    paddingTop: Spasi.md + 2,
    paddingBottom: Spasi.md,
  },
  teksKepala: { flex: 1, minWidth: 0 },
  judul: { fontSize: Teks.base, fontWeight: Berat.semi, color: '#FFFFFF' },
  subjudul: { fontSize: Teks.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    paddingHorizontal: Spasi.lg,
    paddingVertical: Spasi.sm + 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stripKiri: { flex: 1, minWidth: 0, fontSize: Teks.sm },
  stripKanan: { fontSize: Teks.sm, fontWeight: Berat.tebal },

  isi: { flex: 1 },
  gulungan: { padding: PADDING_ISI, gap: Spasi.md },
  lapisMengambang: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
