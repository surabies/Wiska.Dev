/**
 * workspace.tsx — kerangka & kepingan UI ruang kerja petugas. Padanan
 * `features/staff/dashboard/workspace_widgets.dart`.
 *
 * Dipakai bersama oleh ruang kerja Pencatat Meter dan Petugas Gangguan
 * supaya keduanya terasa satu aplikasi, bukan dua yang ditempel.
 */
import type { ComponentType, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, RotateCw, type LucideProps } from 'lucide-react-native';
import { formatUkuranByte } from '@workspace/mobile-core';
import {
  Radius,
  Berat,
  GlassPanel,
  PremiumBackground,
  Spasi,
  Teks,
  TinggiBaris,
  TinggiKontrol,
  UkuranIkon,
  useTheme,
} from '@/components';

export type Ikon = ComponentType<LucideProps>;

// ── Kerangka halaman ───────────────────────────────────────────────────

/**
 * Kerangka ruang kerja: latar premium, bar atas (kembali · judul · segarkan),
 * konten di tengah maks 560 (nyaman juga di tablet).
 *
 * `onSegarkan` dipasang ke tombol DAN pull-to-refresh. Di lapangan tarik-ke-
 * bawah jauh lebih sering dipakai daripada menemukan tombol kecil di pojok.
 *
 * DUA HAL YANG DULU HILANG DAN SEKARANG ADA DI SINI:
 *
 * 1. **Papan ketik.** Layar catat punya tiga field (stand akhir, no HP,
 *    usulan) di dalam ScrollView polos, tanpa satu pun penangan papan ketik —
 *    jadi papan ketik menutup persis field yang sedang diketik. Android sudah
 *    `softwareKeyboardLayoutMode: "resize"` (app.json) sehingga jendelanya
 *    mengecil sendiri; iOS TIDAK, dan di sanalah KeyboardAvoidingView
 *    diperlukan. `keyboardDismissMode="on-drag"` melengkapinya: menggulir =
 *    menutup papan ketik, gerakan yang paling wajar saat tangan penuh.
 *
 * 2. **`gulir={false}`.** Layar yang isinya SATU daftar panjang tidak boleh
 *    memakai ScrollView ini — daftar ber-virtualisasi di dalam ScrollView
 *    kehilangan virtualisasinya (lihat pelanggan-rute-screen: satu rute bisa
 *    2.500 pelanggan). Dengan `gulir={false}` kerangka hanya menyediakan bar
 *    atas + batas lebar, dan layar memasang FlatList-nya sendiri sebagai
 *    satu-satunya penggulir.
 */
export function WorkspaceScaffold({
  judul,
  subjudul,
  children,
  onBack,
  onSegarkan,
  sedangMuat = false,
  gulir = true,
}: {
  judul: string;
  subjudul: string;
  children: ReactNode;
  onBack?: () => void;
  onSegarkan?: () => void;
  sedangMuat?: boolean;
  /** false = layar memasang penggulirnya sendiri (FlatList). */
  gulir?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <PremiumBackground>
      <KeyboardAvoidingView
        style={styles.kolom}
        // Android sudah dilayani `softwareKeyboardLayoutMode: "resize"`;
        // menambah padding di atasnya justru menggeser layar dua kali.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.kolom, { paddingTop: insets.top }]}>
          <View style={styles.barAtas}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.tombolIkon, pressed && styles.ditekan]}
              >
                <ChevronLeft size={26} color={colors.primary} />
              </Pressable>
            ) : (
              <View style={styles.spasiKiri} />
            )}
            <View style={styles.judulWrap}>
              <Text numberOfLines={1} style={[styles.judul, { color: colors.foreground }]}>
                {judul}
              </Text>
              <Text numberOfLines={1} style={[styles.subjudul, { color: colors.mutedForeground }]}>
                {subjudul}
              </Text>
            </View>
            {onSegarkan ? (
              <Pressable
                onPress={onSegarkan}
                style={({ pressed }) => [styles.tombolIkon, pressed && styles.ditekan]}
              >
                <RotateCw size={UkuranIkon.sedang} color={colors.mutedForeground} />
              </Pressable>
            ) : (
              <View style={styles.spasiKiri} />
            )}
          </View>

          <View style={styles.areaIsi}>
            {gulir ? (
              <ScrollView
                style={styles.batasLebar}
                contentContainerStyle={[styles.isi, { paddingBottom: insets.bottom + Spasi.xl }]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
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
              <View style={[styles.batasLebar, styles.isiTanpaGulir]}>{children}</View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </PremiumBackground>
  );
}

/**
 * Padding isi yang dipakai ScrollView bawaan kerangka — diekspor supaya
 * layar `gulir={false}` bisa memberi FlatList-nya padding yang PERSIS sama.
 * Tanpa ini, satu layar akan bergeser beberapa piksel dari tetangganya dan
 * tidak akan pernah ada yang tahu kenapa.
 */
export const paddingIsiWorkspace = {
  paddingHorizontal: Spasi.xl - Spasi.xs, // 20 — sisi nyaman untuk kartu
  paddingTop: Spasi.sm,
} as const;

/** Judul seksi kecil (huruf kapital berjarak). */
export function WorkspaceSection({ judul, aksi }: { judul: string; aksi?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.seksi}>
      <Text style={[styles.seksiJudul, { color: colors.mutedForeground }]}>
        {judul.toUpperCase()}
      </Text>
      {aksi}
    </View>
  );
}

// ── Ikon squircle bergradasi ───────────────────────────────────────────

/** Ikon squircle bergradasi ala macOS — penanda visual tiap aplikasi kerja. */
export function SquircleIcon({
  ikon: Ikon,
  gradasi,
  ukuran = 56,
}: {
  ikon: Ikon;
  gradasi: readonly [string, string];
  ukuran?: number;
}) {
  return (
    <LinearGradient
      colors={gradasi}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.squircle,
        { width: ukuran, height: ukuran, borderRadius: ukuran * 0.29 },
      ]}
    >
      <Ikon size={ukuran * 0.46} color="#FFFFFF" strokeWidth={2.2} />
    </LinearGradient>
  );
}

// ── Launchpad ──────────────────────────────────────────────────────────

/** Satu pintasan aplikasi kerja di grid Launchpad. */
export function LaunchpadItem({
  ikon,
  label,
  gradasi,
  badge,
  onPress,
}: {
  ikon: Ikon;
  label: string;
  gradasi: readonly [string, string];
  /** Angka kecil di pojok ikon (mis. jumlah antrean). */
  badge?: string | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.launchpad, pressed && styles.ditekan]}
    >
      <View>
        <SquircleIcon ikon={ikon} gradasi={gradasi} ukuran={54} />
        {badge != null && badge.length > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
            <Text style={styles.badgeTeks} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.launchpadLabel, { color: colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Statistik kompak ───────────────────────────────────────────────────

export function CompactStat({
  label,
  nilai,
  ikon: Ikon,
  bahaya = false,
  style,
}: {
  label: string;
  nilai: string;
  ikon: Ikon;
  bahaya?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const warna = bahaya ? colors.destructive : colors.foreground;
  return (
    <GlassPanel padding={0} style={{ ...styles.statPanel, ...style }}>
      <View style={styles.statBaris}>
        <Ikon size={UkuranIkon.kecil} color={bahaya ? colors.destructive : colors.mutedForeground} />
        <Text numberOfLines={1} style={[styles.statLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.statNilai, { color: warna }]}>{nilai}</Text>
    </GlassPanel>
  );
}

/** Pil kecil (ikon + label) untuk chip ringkasan di kartu portal. */
export function MiniStat({
  ikon: Ikon,
  label,
  bahaya = false,
}: {
  ikon: Ikon;
  label: string;
  bahaya?: boolean;
}) {
  const { colors } = useTheme();
  const warna = bahaya ? colors.destructive : colors.mutedForeground;
  return (
    <View style={[styles.pil, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Ikon size={UkuranIkon.kecil - 2} color={warna} />
      <Text style={[styles.pilTeks, { color: warna, fontWeight: bahaya ? '600' : '400' }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Indikator penyimpanan ──────────────────────────────────────────────

/**
 * Padanan bar "sisa memori" dashboard Aurora, difokuskan ulang ke risiko
 * lapangan yang sebenarnya: berapa banyak hasil catat (beserta foto bukti)
 * menumpuk BELUM terunggah, dan berapa besar berkasnya di perangkat.
 *
 * Aurora memperingatkan saat catatan belum-upload melewati 500; ambang yang
 * sedikit lebih awal dipakai di sini supaya peringatannya masih sempat
 * ditindaklanjuti sebelum petugas kehabisan ruang.
 */
const AMBANG_PERHATIAN = 400;

export function IndikatorPenyimpanan({
  jumlahAntrean,
  totalByteFoto,
  ikonAman: IkonAman,
  ikonAntre: IkonAntre,
  ikonBahaya: IkonBahaya,
}: {
  jumlahAntrean: number;
  totalByteFoto: number;
  ikonAman: Ikon;
  ikonAntre: Ikon;
  ikonBahaya: Ikon;
}) {
  const { colors } = useTheme();
  const aman = jumlahAntrean === 0;
  const perhatian = jumlahAntrean >= AMBANG_PERHATIAN;
  const warna = perhatian ? colors.destructive : aman ? colors.success : colors.foreground;
  const Ikon = perhatian ? IkonBahaya : aman ? IkonAman : IkonAntre;

  const judul = aman
    ? 'Penyimpanan aman'
    : perhatian
      ? 'Segera upload — antrean menumpuk'
      : 'Antrean menunggu upload';
  const rincian = aman
    ? 'Tidak ada hasil catat yang menunggu diunggah.'
    : `${jumlahAntrean} laporan · ${formatUkuranByte(totalByteFoto)} foto bukti tersimpan di perangkat.`;

  return (
    <GlassPanel padding={0} style={styles.indikator}>
      <Ikon size={UkuranIkon.besar} color={warna} />
      <View style={styles.indikatorTeks}>
        <Text style={[styles.indikatorJudul, { color: warna }]}>{judul}</Text>
        <Text style={[styles.indikatorRincian, { color: colors.mutedForeground }]}>{rincian}</Text>
      </View>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  kolom: { flex: 1 },
  barAtas: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spasi.xs,
    paddingVertical: Spasi.xs,
    gap: Spasi.xs,
  },
  // 48×48: target ketuk penuh, bukan 34 seperti sebelumnya. Tombol kembali
  // adalah tombol yang paling sering dicari saat tangan sedang penuh.
  tombolIkon: {
    width: TinggiKontrol.baku,
    height: TinggiKontrol.baku,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Penyeimbang lebar tombol ikon supaya judul benar-benar di tengah.
  spasiKiri: { width: TinggiKontrol.baku },
  ditekan: { opacity: 0.55 },
  judulWrap: { flex: 1 },
  judul: { fontSize: Teks.base, fontWeight: Berat.semi, letterSpacing: -0.3 },
  subjudul: { fontSize: Teks.xs, marginTop: 1 },

  areaIsi: { flex: 1, alignItems: 'center' },
  batasLebar: { flex: 1, width: '100%', maxWidth: 560 },
  isi: paddingIsiWorkspace,
  isiTanpaGulir: { paddingTop: paddingIsiWorkspace.paddingTop },

  seksi: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spasi.lg,
    paddingBottom: Spasi.md,
    gap: Spasi.sm,
  },
  seksiJudul: { flex: 1, fontSize: Teks.xs, fontWeight: Berat.tebal, letterSpacing: 1.2 },

  squircle: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },

  launchpad: { width: '33.333%', alignItems: 'center', gap: Spasi.sm, paddingVertical: Spasi.xs },
  launchpadLabel: { fontSize: Teks.xs, fontWeight: Berat.medium },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: Radius.kontrol,
    paddingHorizontal: Spasi.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTeks: { color: '#FFFFFF', fontSize: Teks.xs, fontWeight: Berat.tebal },

  statPanel: { paddingHorizontal: Spasi.md, paddingVertical: Spasi.md, flex: 1 },
  statBaris: { flexDirection: 'row', alignItems: 'center', gap: Spasi.xs + 2 },
  statLabel: { flex: 1, fontSize: Teks.xs },
  statNilai: { fontSize: Teks.xl2, fontWeight: Berat.tebal, marginTop: Spasi.xs },

  pil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.xs,
    paddingHorizontal: Spasi.sm,
    paddingVertical: Spasi.xs,
    borderRadius: Radius.bundar,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pilTeks: { fontSize: Teks.xs },

  indikator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    paddingHorizontal: Spasi.lg,
    paddingVertical: Spasi.md,
  },
  indikatorTeks: { flex: 1 },
  indikatorJudul: { fontSize: Teks.sm, fontWeight: Berat.semi },
  indikatorRincian: { fontSize: Teks.xs, lineHeight: TinggiBaris.xs, marginTop: 2 },
});
