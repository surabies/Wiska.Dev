// Placeholder sementara tiap tab — memvalidasi tema (gradien premium, warna
// palet master) + navigasi dock sebelum konten nyata diisi per modul.
// Akan diganti oleh BerandaPublikScreen / LaporanSayaScreen / AkunTabContent.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumBackground, useTheme } from '@/components';

export function ScreenPlaceholder({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  /** Aksi opsional (mis. tombol menuju layar yang sudah jadi). */
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <PremiumBackground>
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={[styles.badge, { color: colors.mutedForeground }]}>TIRTAWENING · PUBLIK</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.note, { color: colors.mutedForeground }]}>{note}</Text>
        {children != null ? <View style={styles.actions}>{children}</View> : null}
      </View>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  badge: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  note: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  actions: { marginTop: 24, alignSelf: 'stretch', paddingHorizontal: 16 },
});
