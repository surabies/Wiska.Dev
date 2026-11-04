/**
 * scroll-aman.tsx — daftar bergulir yang menghormati area aman perangkat
 * dan membatasi lebar isinya.
 *
 * Ada supaya tiap layar tidak mengulang tiga hal yang sama: padding notch di
 * atas, padding gesture-bar di bawah, dan batas lebar 560 agar teks tidak
 * membentang selebar tablet (jarak baca yang melelahkan).
 */
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/components';

export function ScrollAman({
  children,
  maxWidth = 560,
  onSegarkan,
  sedangMuat = false,
  padding = 20,
}: {
  children: ReactNode;
  maxWidth?: number;
  onSegarkan?: () => void;
  sedangMuat?: boolean;
  padding?: number;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={styles.tengah}>
      <ScrollView
        style={[styles.penuh, { maxWidth }]}
        contentContainerStyle={{
          paddingHorizontal: padding,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
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
    </View>
  );
}

const styles = StyleSheet.create({
  tengah: { flex: 1, alignItems: 'center' },
  penuh: { flex: 1, width: '100%' },
});
