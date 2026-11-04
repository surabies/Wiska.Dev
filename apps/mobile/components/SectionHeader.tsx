/**
 * section-header.tsx — judul seksi kecil huruf kapital berjarak (padanan
 * `SectionHeader` di core/widgets/section_header.dart). Pemisah kelompok
 * konten di beranda/kelola langganan.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme/ThemeContext';

export function SectionHeader({ judul, aksi }: { judul: string; aksi?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.judul, { color: colors.mutedForeground }]}>{judul.toUpperCase()}</Text>
      {aksi}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 8 },
  judul: { flex: 1, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
});
