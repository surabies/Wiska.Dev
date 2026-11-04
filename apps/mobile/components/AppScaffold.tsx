/**
 * app-scaffold.tsx — kerangka halaman gaya iOS (padanan `AppScaffold` di
 * core/widgets/app_scaffold.dart): latar gradien premium, nav bar
 * translusen/blur menempel atas (kembali · judul · aksi, hairline di
 * bawahnya), konten di tengah maks 560 (nyaman juga di tablet).
 *
 * DECOUPLED dari navigasi: layar yang ingin tombol kembali cukup mengoper
 * `onBack` (mis. `() => router.back()`). Tanpa `onBack`, tombol kembali tidak
 * muncul — persis seperti Flutter memeriksa `Navigator.canPop()`.
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from './theme/ThemeContext';
import { PremiumBackground } from './PremiumBackground';

export interface AppScaffoldProps {
  title: string;
  subtitle?: string;
  body: ReactNode;
  trailing?: ReactNode;
  onBack?: () => void;
  /** Overlay (mis. <Dialog>) — dirender di atas scaffold; Modal-nya berportal. */
  children?: ReactNode;
}

export function AppScaffold({ title, subtitle, body, trailing, onBack, children }: AppScaffoldProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <PremiumBackground>
      <View style={styles.column}>
        {/* Nav bar buram MEMANJANG ke belakang status bar; tinggi status bar
            ditambahkan sebagai padding atas di dalamnya (bukan SafeArea
            pembungkus — biar tidak "menggantung" terpisah dari ikon sistem). */}
        <BlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.navBar, { borderBottomColor: colors.iosSeparator }]}
        >
          <View style={[styles.navRow, { paddingTop: insets.top + 4 }]}>
            {onBack ? (
              <Pressable hitSlop={8} onPress={onBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
                <Ionicons name="chevron-back" size={24} color={colors.systemBlue} />
              </Pressable>
            ) : (
              <View style={styles.backSpacer} />
            )}
            <View style={styles.titleWrap}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>
                {title}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
          </View>
        </BlurView>

        {/* KeyboardAvoidingView: saat keyboard muncul di HP, area body mengecil
            supaya ScrollView bisa menggeser field yang sedang diisi ke atas
            keyboard (bukan tertutup). iOS = 'padding'; Android mengandalkan
            windowSoftInputMode 'resize' (app.json). Bungkus SELURUH kolom (nav
            + body), jadi offset = 0. */}
        <KeyboardAvoidingView
          style={[styles.bodyArea, { paddingBottom: insets.bottom }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.bodyConstraint}>{body}</View>
        </KeyboardAvoidingView>
      </View>
      {children}
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1 },
  navBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 4,
    gap: 4,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backSpacer: { width: 12 },
  pressed: { opacity: 0.5 },
  titleWrap: { flex: 1, paddingLeft: 4 },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.4 },
  subtitle: { fontSize: 11.5, marginTop: 1 },
  trailing: { marginRight: 8 },
  bodyArea: { flex: 1, alignItems: 'center' },
  bodyConstraint: { flex: 1, width: '100%', maxWidth: 560 },
});
