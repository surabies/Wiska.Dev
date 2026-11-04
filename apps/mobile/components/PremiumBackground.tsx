/**
 * premium-background.tsx — LATAR HALAMAN PREMIUM (padanan `PremiumBackground`
 * di `core/widgets/glass_panel.dart` project lama, sama seperti versi yang
 * sudah dipakai di `apps/mobile-publik/components/premium-background.tsx`):
 * gradien vertikal lembut + DUA "cahaya" radial samar di pojok yang memudar
 * ke transparan.
 *
 * Sempat diratakan jadi satu warna polos (lihat riwayat git) mengikuti
 * dashboard web yang tidak punya gradien — dikembalikan atas permintaan
 * eksplisit untuk halaman yang sering dilihat petugas. `app/catat.tsx` dan
 * `features/auth/masuk-screen.tsx` sudah lebih dulu mengimpor komponen ini
 * (mengharapkan efeknya), jadi keduanya otomatis ikut mendapat gradien +
 * cahaya begitu file ini dipulihkan — bukan efek samping tak terduga.
 *
 * Cahaya memakai RadialGradient asli via react-native-svg (bukan lingkaran
 * solid beropacity rendah) — sama seperti implementasi publik, supaya
 * glow-nya lembut persis versi Flutter (`_Cahaya` RadialGradient warna→alpha0).
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from './theme/ThemeContext';

// Flutter memakai lingkaran 320×320 di balik tepi layar; ukuran & posisi sama.
const GLOW = 320;

export function PremiumBackground({ children }: { children: ReactNode }) {
  const { isDark } = useTheme();

  const gradient = isDark
    ? (['#020617', '#010409'] as const) // slate-950 → hampir hitam
    : (['#F8FAFC', '#F1F5F9'] as const); // slate-50 → slate-100

  return (
    <LinearGradient colors={gradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.fill}>
      {/* Cahaya atas-kanan (light: sky, dark: teal) — padanan _Cahaya #1. */}
      <Glow
        id="glow-atas-petugas"
        color={isDark ? '#2DD4BF' : '#38BDF8'}
        peak={isDark ? 0.15 : 0.2}
        style={{ top: -120, right: -80 }}
      />
      {/* Cahaya bawah-kiri (light: teal, dark: sky) — padanan _Cahaya #2. */}
      <Glow
        id="glow-bawah-petugas"
        color={isDark ? '#0EA5E9' : '#5EEAD4'}
        peak={isDark ? 0.12 : 0.15}
        style={{ bottom: -140, left: -100 }}
      />

      {children}
    </LinearGradient>
  );
}

/** Satu cahaya: radial gradient warna (di tengah) → transparan (di tepi). */
function Glow({ id, color, peak, style }: { id: string; color: string; peak: number; style: ViewStyle }) {
  return (
    <View style={[styles.glow, { pointerEvents: 'none' }, style]}>
      <Svg width={GLOW} height={GLOW}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={peak} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={GLOW} height={GLOW} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  glow: { position: 'absolute', width: GLOW, height: GLOW },
});
